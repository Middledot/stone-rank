use serde_json::json;
use tauri::State;
use tauri_plugin_store::StoreExt; // needed to access store
use tokio::sync::{Mutex, MutexGuard};

use super::data::{
    GetPlaylistItemsResponse, GetProfileResponse, PlaylistItem, PlaylistPage, Profile,
};
use super::login::refresh_tokens;
use crate::api::data::{GetPlaylistDeetsResponse};
use crate::db;
use crate::state::SessionState;
use reqwest::header::AUTHORIZATION;

use sea_orm::{ActiveModelTrait, EntityTrait, Set};

use log::{debug, info, error};

const ROOT_PATH: &str = "https://api.spotify.com/v1";

// TODO:
// 2. storing login keys (DONE but make more secure)
// 4. response structs

async fn call(
    url: String,
    token: String,
    params: Option<Vec<(&str, String)>>,
) -> reqwest::Response {
    info!("Call made to {} with parameters {:?}", url.clone(), params.clone());
    let client = reqwest::Client::new();

    let mut req = client.get(url);

    if let Some(details) = params {
        req = req.query(&details);
    }

    req.header(AUTHORIZATION, format!("Bearer {}", token))
        .send()
        .await
        .expect("WHAT BROKE? manage it please")
}

// these are separate functions ONLY because of token refreshing
// I don't want to implement Box::pin or whatever that is for recursive
// asynchronous functions... this will do
async fn call_with_state(
    app: &tauri::AppHandle,
    state: &mut MutexGuard<'_, SessionState>,
    path: &str,
    params: Option<Vec<(&str, String)>>,
) -> Result<reqwest::Response, ()> {
    let url = format!("{}{}", ROOT_PATH, path);

    // lesson: need to explicitly make references to not consume 'common property'
    // alternatives are .clone() (clone entirely for ownership) and .take() (to remove)
    let token = state.access_token.as_deref().unwrap_or("").to_string();
    let retoken = state.refresh_token.as_deref().unwrap_or("").to_string();

    // I'm assuming if one's gone, the other's gone
    if token == "" {
        return Err(());
    }

    let mut response = call(url.clone(), token.clone(), params.clone()).await;
    let headers = response.headers();
    let mut status = (response.status().as_u16()) as i16;

    // this part is for retokening/token refresh
    if status == 401
        && let Some(check) = headers.get("www-authenticate")
    {
        let er = check
            .to_str()
            .expect("error failed to deserialize, exiting");

        // magic string
        // this failed once for some reason. Restarting fixed it however
        if er
            == "Bearer realm=\"spotify\", error=\"invalid_token\", error_description=\"The access token expired\""
        {
            let (new_token, new_retoken) = refresh_tokens(retoken.to_string())
                .await
                .expect("Retokening failed somehow");

            // comment this out for testing
            let store = app.store("store.json").unwrap();
            store.set("access_token", json!(new_token.clone()));
            store.set("refresh_token", json!(new_retoken.clone()));

            let _ = store.save();

            state.access_token = Some(new_token);
            state.refresh_token = Some(new_retoken);

            response = call(url.clone(), state.access_token.clone().unwrap(), params.clone()).await; // I can use it (? operator) here!! cuz it propogates to the upper functions Result response!!!!!
            // headers = response.headers();  // unused
            status = (response.status().as_u16()) as i16;
        }
    }
    // separate branches so refresh can only happen max once per request

    if status >= 400 {
        let req_url = response.url().clone();
        let bytes_body = response.bytes().await.unwrap();
        error!("UNKNOWN ERROR - {} GAVE {} TEXT BODY: {}", req_url.as_str(), status, std::str::from_utf8(&bytes_body).expect("unformattable :("));
        // println!("response: ");
        // println!("{:?}", &response);
        // println!("{:?}", resp.url().as_str());
        // let bb = resp.bytes().await.unwrap();
        // println!("{:?}", std::str::from_utf8(&bb));
        // std::fs::write("./pl-items-test.json",
        //     serde_json::to_string_pretty(
        //         &(serde_json::from_slice::<serde_json::Value>(&bb).unwrap())
        //     ).unwrap()
        // ).expect("Yup Yup");
        // let unwrapped = serde_json::from_slice::<GetPlaylistItemsResponse>(&bb).unwrap();
        Err(())
    } else {
        Ok(response)
    }
}

// TODO: how to access store without app handle?
#[tauri::command]
pub async fn get_profile(
    app: tauri::AppHandle,
    state: State<'_, Mutex<SessionState>>,
) -> Result<Profile, String> {
    let mut state = state.lock().await;

    let default = Profile {
        name: "Not Logged In (Jo Doe)".to_string(),
        pfp: "https://upload.wikimedia.org/wikipedia/commons/a/ac/Default_pfp.jpg"
            .to_string(),
        logged_in: false,
    };

    let res = call_with_state(&app, &mut state, "/me", None).await;
    match res {
        Ok(resp) => {
            match resp.json::<GetProfileResponse>().await {
                Ok(r) => {
                    Ok(
                        Profile {
                            name: r.display_name.clone(),
                            pfp: r.images[0].url.clone(),
                            logged_in: true,
                        }
                    )
                },
                Err(e) => {
                    error!("[get_profile] response serialization failed: {}", e.to_string());
                    Ok(default)
                }
            }
        }
        Err(_) => {
            error!("[get_profile] api call failed");
            Ok(default)
        }
    }
}

#[tauri::command]
pub async fn get_initial_playlist(
    state: State<'_, Mutex<SessionState>>,
) -> Result<Option<String>, String> {
    let state = state.lock().await;

    Ok(state.playlist_code.clone())
}

#[tauri::command]
pub async fn get_current_playlist_details(
    app: tauri::AppHandle,
    state: State<'_, Mutex<SessionState>>,
) -> Result<Option<GetPlaylistDeetsResponse>, String> {
    let mut state = state.lock().await;

    if state.playlist_code.is_none() {
        return Ok(None);
    }

    // can never be None, so unwrap won't fail
    let pl_code = state.playlist_code.clone().unwrap();

    let res = call_with_state(
        &app,
        &mut state,
        format!("/playlists/{}", pl_code).as_str(),
        None,
    )
    .await;

    match res {
        Ok(resp) => {
            match resp.json::<GetPlaylistDeetsResponse>().await {
                Ok(r) => {
                    Ok(Some(r))
                },
                Err(e) => {
                    error!("[get_current_playlist_details] response serialization failed: {}", e.to_string());
                    Ok(None)
                }
            }
        }
        Err(_) => {
            error!("[get_current_playlist_details] api call failed");
            Ok(None)
        },
    }
}

#[tauri::command]
pub async fn set_playlist(
    app: tauri::AppHandle,
    state: State<'_, Mutex<SessionState>>,
    pl_code: Option<String>,
) -> Result<(), String> {
    // TODO: not sure why I made pl_code nullable??
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
pub async fn get_playlist_items(
    app: tauri::AppHandle,
    state: State<'_, Mutex<SessionState>>,
    offset: i32,
    limit: i32,
) -> Result<PlaylistPage, String> {
    let mut state = state.lock().await;

    if state.playlist_code.is_none() {
        return Err("No playlist to retrieve from!".to_string());
    }

    // can never be None, so unwrap won't fail
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
        Some(params),
    )
    .await;

    match res {
        Ok(resp) => {
            match resp.json::<GetPlaylistItemsResponse>().await {
                Ok(r) => {
                    let listing = PlaylistPage {
                        limit: r.limit,
                        offset: r.offset,
                        items: r
                            .items
                            .iter()
                            .map(|i| PlaylistItem {
                                id: i
                                    .item
                                    .id
                                    .clone()
                                    .unwrap_or(uuid::Uuid::new_v4().hyphenated().to_string()),
                                title: i.item.name.clone(),
                                href: i
                                    .item
                                    .href
                                    .clone()
                                    .unwrap_or("https://example.com".to_string()),
                                icon: {
                                    if let Some(imgobj) = i.item.album.images.get(0) {
                                        imgobj.url.clone()
                                    } else {
                                        "https://i.sstatic.net/kOnzy.gif".to_string()
                                    }
                                },
                            })
                            .collect(),
                    };
                    Ok(listing)
                },
                Err(e) => {
                    error!("[get_playlist_items] response serialization failed: {}", e.to_string());
                    Err("Failed to serialize response".to_string())
                }
            }
        }
        Err(_) => {
            error!("[get_playlist_items] api call failed");
            Err("Some error happened retrieving playlist items".to_string())
        }
    }
}

#[tauri::command]
pub async fn get_comment(
    state: State<'_, Mutex<SessionState>>,
    track_id: String,
) -> Result<String, String> {
    let state = state.lock().await;
    let classifier = state.db.lock().await;

    let res_comment: Option<db::comment::Model>
        = match db::comment::Entity::find_by_id(track_id).one(&*classifier).await {
            Ok(r) => r,
            Err(e) => {
                error!("[get_comment] database error: {}", e.to_string());
                return Err("Comment couldn't be retrieved due to database error".to_string())
            }
        };

    if let Some(comment) = res_comment {
        info!("Comment retrieved: {}", &comment.comment);
        return Ok(comment.comment);
    } else {
        info!("No comment retrieved!");
        return Ok("".to_string());
    }
}

#[tauri::command]
pub async fn save_comment(
    state: State<'_, Mutex<SessionState>>,
    track_id: String,
    comment: String,
) -> Result<bool, String> {
    let state = state.lock().await;
    let classifier = state.db.lock().await;

    if comment.len() == 0 {
        // delete comment
        debug!("Deleting comment...");
        match db::comment::Entity::delete_by_id(track_id).exec(&*classifier).await {
            Err(e) => {
                error!("[save_comment] deleting comment led to database error: {}", e.to_string());
                return Ok(false);
            }
            Ok(_) => {},
        };

        return Ok(true);
    } else {
        // insert or update (in two operations for now)
        let db_record = match db::comment::Entity::find_by_id(track_id.clone()).one(&*classifier).await {
            Ok(r) => r,
            Err(e) => {
                error!("[save_comment] checking for comment led to database error: {}", e.to_string());
                return Ok(false);
            }
        };

        if let Some(record) = db_record {
            // record exists; update
            let mut record: db::comment::ActiveModel = record.into();
            record.comment = Set(comment);

            let _: db::comment::Model = match record.update(&*classifier).await {
                Ok(r) => r,
                Err(e) => {
                    error!("[save_comment] updating comment led to database error: {}", e.to_string());
                    return Ok(false);
                }
            };

            return Ok(true);
        } else {
            // record doesn't exist; insert
            let record = db::comment::ActiveModel {
                track_id: Set(track_id),
                comment: Set(comment),
            };

            let _: db::comment::Model = match record.insert(&*classifier).await {
                Ok(r) => r,
                Err(e) => {
                    error!("[save_comment] inserting comment led to database error: {}", e.to_string());
                    return Ok(false);
                }
            };

            return Ok(true);
        }
    }
}
