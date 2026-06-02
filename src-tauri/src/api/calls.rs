use std::collections::HashMap;
use std::env;
use bytes::Bytes;

use tauri::State;
use tokio::sync::{Mutex, MutexGuard};
use serde_json::{json};
use tauri_plugin_store::StoreExt;  // needed to access store
use url::Url;

use super::data::{
    GetProfileResponse,
    Profile,
    GetPlaylistItemsResponse,
    PlaylistItem,
    PlaylistPage
};
use super::login::refresh_tokens;
use crate::api::data::{ApiError, GetPlaylistDeetsResponse};
use crate::state::SessionState;
use reqwest::header::AUTHORIZATION;


const ROOT_PATH: &str = "https://api.spotify.com/v1";

// TODO:
// 2. storing login keys (DONE but make more secure)
// 4. response structs

async fn call(url: String, token: String, params: Option<Vec<(&str, String)>>) -> reqwest::Response {
    let client = reqwest::Client::new();

    let mut req = client
        .get(url);

    if let Some(details) = params {
        req = req.query(&details);
    }

    req
        .header(AUTHORIZATION, format!("Bearer {}", token))
        .send()
        .await
        .expect("WHAT BROKE? manage it please")
}


// these are separate functions ONLY because of token refreshing
// I don't want to implement Box::pin or whatever that is for recursive
// asynchronous functions... this will do
async fn call_with_state(app: &tauri::AppHandle, state: &mut MutexGuard<'_, SessionState>, path: &str, params: Option<Vec<(&str, String)>>) -> Result<reqwest::Response, ()> {
    let url = format!("{}{}", ROOT_PATH, path);

    // lesson: need to explicitly make references to not consume 'common property'
    // alternatives are .clone() (clone entirely for ownership) and .take() (to remove)
    let token = state.access_token.as_deref().unwrap_or("").to_string();
    let retoken = state.refresh_token.as_deref().unwrap_or("").to_string();

    // I'm assuming if one's gone, the other's gone
    if token == "" {
        return Err(());
    }

    println!("{:?}", url.clone());

    let mut response = call(url.clone(), token.clone(), params.clone()).await;
    let mut headers = response.headers();
    let mut status = (response.status().as_u16()) as i16;

    // this part is for retokening/token refresh
    if status == 401 && let Some(check) = headers.get("www-authenticate") {
        let er = check.to_str().expect("error failed to deserialize, exiting");

        // magic string
        // this failed once for some reason. Restarting fixed it however
        if er == "Bearer realm=\"spotify\", error=\"invalid_token\", error_description=\"The access token expired\"" {
            let (new_token, new_retoken) = refresh_tokens(retoken.to_string()).await.expect("Retokening failed somehow");

            // comment this out for testing
            let store = app.store("store.json").unwrap();
            store.set("access_token", json!(new_token.clone()));
            store.set("refresh_token", json!(new_retoken.clone()));

            let _ = store.save();

            state.access_token = Some(new_token);
            state.refresh_token = Some(new_retoken);

            response = call(url.clone(), token.clone(), params.clone()).await;  // I can use it (? operator) here!! cuz it propogates to the upper functions Result response!!!!!
            headers = response.headers();
            status = (response.status().as_u16()) as i16;
        }
    }
    // separate branches so refresh can only happen max once per request

    if status >= 400 {
        println!("!! UNCATEGORIZED ERROR !!");
        println!("{:?}", response.url().as_str());
        println!("{}", status);
        println!("response: ");
        println!("{:?}", &response);
        println!("text body: ");
        let bytes_body = response.bytes().await.unwrap();
        println!("{}", std::str::from_utf8(&bytes_body).expect("unformattable :("));
        Err(())
    } else {
        Ok(response)
    }
}


// TODO: how to access store without app handle?
#[tauri::command]
pub async fn get_profile(app: tauri::AppHandle, state: State<'_, Mutex<SessionState>>) -> Result<Profile, String> {
    let mut state = state.lock().await;

    let res = call_with_state(&app, &mut state, "/me", None).await;
    let value: Profile = match res {
        Ok(resp) => {
            let unwrapped = resp.json::<GetProfileResponse>().await.expect("what now");
            let ret = Profile {
                name: unwrapped.display_name.clone(),
                pfp: unwrapped.images[0].url.clone(),
                logged_in: true,
            };
            ret
        }
        Err(_) => {
            let default = Profile {
                name: "Not Logged In (Jo Doe)".to_string(),
                pfp: "https://upload.wikimedia.org/wikipedia/commons/a/ac/Default_pfp.jpg"
                    .to_string(),
                logged_in: false,
            };
            default
        }
    };

    Ok(value)
}

#[tauri::command]
pub async fn get_initial_playlist(state: State<'_, Mutex<SessionState>>) -> Result<Option<String>, String> {
    let state = state.lock().await;

    Ok(state.playlist_code.clone())
}

#[tauri::command]
pub async fn get_current_playlist_details(app: tauri::AppHandle, state: State<'_, Mutex<SessionState>>) -> Result<Option<GetPlaylistDeetsResponse>, String> {
    let mut state = state.lock().await;

    if state.playlist_code.is_none() {
        return Ok(None);
    }

    let pl_code = state.playlist_code.clone().unwrap();

    let res = call_with_state(
        &app,
        &mut state,
        format!("/playlists/{}", pl_code).as_str(),
        None
    ).await;

    match res {
        Ok(resp) => {
            let unwrapped = resp.json::<GetPlaylistDeetsResponse>().await.expect("Playlist response parsing failed");
            Ok(Some(unwrapped))
        }
        Err(_) => {
            Err("Retrieving playlist failed".to_string())
        }
    }
}

#[tauri::command]
pub async fn set_playlist(app: tauri::AppHandle, state: State<'_, Mutex<SessionState>>, pl_code: Option<String>) -> Result<(), String> {
    let mut state = state.lock().await;

    state.playlist_code = pl_code.clone();

    if let Ok(store) = app.store("store.json") {
        if let Some(code) = pl_code {
            store.set("playlist_code", json!(code));
        }
        let _ = store.save();
    }

    Ok(())
}

// TODO: how to access store without app handle?
#[tauri::command]
pub async fn get_playlist_items(app: tauri::AppHandle, state: State<'_, Mutex<SessionState>>, offset: i32, limit: i32) -> Result<PlaylistPage, String> {
    let mut state = state.lock().await;

    if state.playlist_code.is_none() {
        return Err("No playlist to retrieve from!".to_string());
    }

    let pl_code = state.playlist_code.clone().unwrap();

    let params = vec![
        ("limit", limit.to_string()),
        ("offset", offset.to_string()),
        // TODO fix this (the data doesn't match what I'm expecting)
        // ("fields", "items(track(name,href,album(name,href,image)))".to_string())
    ];

    let res = call_with_state(
        &app,
        &mut state,
        format!("/playlists/{}/items", pl_code).as_str(),
        Some(params)
    ).await;

    match res {
        Ok(resp) => {
            // println!("{:?}", resp.url().as_str());
            // let bb = resp.bytes().await.unwrap();
            // println!("{:?}", std::str::from_utf8(&bb));
            // let unwrapped = serde_json::from_slice::<GetPlaylistItemsResponse>(&bb).unwrap();
            let unwrapped = resp.json::<GetPlaylistItemsResponse>().await.expect("playlist retrieval failed");
            // println!("{:?}", unwrapped.items[0]);
            let listing = PlaylistPage {
                limit: unwrapped.limit,
                offset: unwrapped.offset,
                items: unwrapped.items.iter().map(|i| {
                    PlaylistItem {
                        id: i.item.id.clone(),
                        title: i.item.name.clone(),
                        href: i.item.href.clone(),
                        icon: i.item.album.images[0].url.clone()
                    }
                }).collect()
            };
            Ok(listing)
        }
        Err(_) => {
            // let default = Profile {
            //     name: "Not Logged In (Jo Doe)".to_string(),
            //     pfp: "https://upload.wikimedia.org/wikipedia/commons/a/ac/Default_pfp.jpg"
            //         .to_string(),
            //     logged_in: false,
            // };
            println!("TWINJEMIN");
            Err("Some error happened retrieving playlist items".to_string())
        }
    }
}

