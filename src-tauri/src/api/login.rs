use serde_json::json;
use std::collections::HashMap;
use tauri::{Emitter, State, Window};
use tokio::sync::Mutex;

use std::env;
use url::Url;

use tauri_plugin_oauth::{OauthConfig, start_with_config};
use tauri_plugin_store::StoreExt; // needed to access store

use super::data::{Profile, SpotifySuccessfulResponse};

use crate::state::SessionState;

use log::{debug, error, info};

#[tauri::command]
pub async fn init_login(
    _state: State<'_, Mutex<SessionState>>,
    code_challenge: String,
) -> Result<String, String> {
    let mut url = Url::parse("https://accounts.spotify.com/authorize").unwrap();
    const REDIRECT_URI: &str = "http://127.0.0.1:1420/";

    const CLIENT_ID: &str = env!("CLIENT_ID");

    url.query_pairs_mut()
        .append_pair("response_type", "code")
        .append_pair("client_id", CLIENT_ID)
        .append_pair("scope", "playlist-read-private streaming") // should be fine immutable
        .append_pair("code_challenge_method", "S256")
        .append_pair("code_challenge", &code_challenge)
        .append_pair("redirect_uri", REDIRECT_URI);

    // println!("{}", url.as_str().to_string());
    Ok(url.as_str().to_string())
    // println!("{}", url.as_str());
    // const scope = 'playlist-read-private streaming';
}

fn verify(url: &str) -> Option<String> {
    // TODO: this isn't really verifying the url, just extracting the
    // code... find way to verify (refer to comment at end of function)
    let url = Url::parse(url).ok()?;
    if url.path() != "/" {
        // all this really does that spotify doesn't is block one of the
        // registered redirect uris :P
        println!("this line was triggered");
        return None;
    }

    let mut code = None;
    for (k, v) in url.query_pairs() {
        // reference a dereferenced var?? I'm not sure what this is lmao
        match &*k {
            "code" => code = Some(v.into_owned()),
            _ => {}
        }
    }
    // I omitted the state checking since spotify doesn't implement it
    // ... there must be another way to validate it?
    code
}

#[tauri::command]
pub async fn start_response_server(window: Window) -> Result<u16, String> {
    // thank you Joshua
    // https://medium.com/@Joshua_50036/implementing-oauth-in-tauri-3c12c3375e04

    let cfg = OauthConfig {
        ports: Some(vec![1420]),
        response: Some("OAuth finished. You may close this tab.".into()),
    };

    start_with_config(cfg, move |url| {
        if let Some(code) = verify(&url) {
            let _ = window.emit("code", code);
        }
    })
    .map_err(|err| err.to_string())
}

#[tauri::command]
pub async fn finish_login(
    app: tauri::AppHandle,
    state: State<'_, Mutex<SessionState>>,
    code_verifier: String,
    code: String,
) -> Result<String, String> {
    let client = reqwest::Client::new();

    const CLIENT_ID: &str = env!("CLIENT_ID");

    let mut params = HashMap::new();
    params.insert("client_id", CLIENT_ID.to_string());
    params.insert("grant_type", "authorization_code".to_string());
    params.insert("code", code);
    params.insert("redirect_uri", "http://127.0.0.1:1420/".to_string());
    params.insert("code_verifier", code_verifier);

    let response = client
        .post("https://accounts.spotify.com/api/token")
        .form(&params)
        .send()
        .await
        .expect("error");

    let body = response.json::<SpotifySuccessfulResponse>().await;

    if body.is_err() {
        println!("failed");
        Err("err".to_string())
    } else {
        // response is for sure successful, unwrap and save the contents
        let response = body.unwrap();
        debug !("Logged In! -- access_token:\n{}", response.access_token);
        debug!("Logged In! -- refresh_token:\n{}", response.refresh_token);
        debug!("Logged In! -- token_type:\n{}", response.token_type);
        debug!("Logged In! -- scope:\n{}", response.scope);
        debug!("Logged In! -- expires_in:\n{}", response.expires_in);

        let store = app.store("store.json").unwrap();
        store.set("access_token", json!(response.access_token.clone()));
        store.set("refresh_token", json!(response.refresh_token.clone()));
        let _ = store.save();

        let mut state = state.lock().await;
        state.access_token = Some(response.access_token);
        state.refresh_token = Some(response.refresh_token);

        Ok(state.access_token.clone().unwrap())
    }
}

pub async fn refresh_tokens(retoken: String) -> Result<(String, String), String> {
    info!("Retokening...");
    let client = reqwest::Client::new();

    const CLIENT_ID: &str = env!("CLIENT_ID");

    let mut params = HashMap::new();
    params.insert("client_id", CLIENT_ID.to_string());
    params.insert("grant_type", "refresh_token".to_string());
    params.insert("refresh_token", retoken);

    let response = match client
        .post("https://accounts.spotify.com/api/token")
        .form(&params)
        .send()
        .await {
            Ok(r) => r,
            Err(e) => {
                error!("[retokening] retokening request failed: {}", e);
                return Err("Retokening failed from base request".to_string());
            }
    };

    let status = (response.status().as_u16()) as i16;
    let bytes = response.bytes().await.unwrap(); // new solution for debug

    if status >= 400 {
        error!("[retokening] retokening rejected: {}", String::from_utf8_lossy(&bytes).into_owned());
        Err("Retokening failed due to error code".to_string())
    } else {
        // assuming this will always be successful for now
        let body: SpotifySuccessfulResponse = serde_json::from_slice(&bytes).unwrap();
        Ok((body.access_token.clone(), body.refresh_token.clone()))
    }
}

#[tauri::command]
pub async fn log_off(
    app: tauri::AppHandle,
    state: State<'_, Mutex<SessionState>>,
) -> Result<Profile, String> {
    let store = app.store("store.json").unwrap();
    store.set("access_token", json!(None::<String>));
    store.set("refresh_token", json!(None::<String>));

    let _ = store.save();

    let mut state = state.lock().await;

    state.access_token = None;
    state.refresh_token = None;

    let default = Profile {
        name: "Not Logged In (Jo Doe)".to_string(),
        pfp: "https://upload.wikimedia.org/wikipedia/commons/a/ac/Default_pfp.jpg".to_string(),
        logged_in: false,
    };

    return Ok(default);
}
