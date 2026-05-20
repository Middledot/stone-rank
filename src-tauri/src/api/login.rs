use std::collections::HashMap;
use tauri::Manager;
use tauri::State;
use tokio::sync::Mutex;

use std::env;
use url::Url;

use super::data::{GetProfileResponse, Profile, SpotifySuccessfulResponse};

use crate::state::SessionState;

#[tauri::command]
pub async fn init_login(
    state: State<'_, Mutex<SessionState>>,
    code_challenge: String,
) -> Result<String, String> {
    let mut url = Url::parse("https://accounts.spotify.com/authorize").unwrap();
    const REDIRECT_URI: &str = "http://127.0.0.1:1420/";

    let client_id = env::var("CLIENT_ID").expect("[environment variables] CLIENT_ID must be set");

    url.query_pairs_mut()
        .append_pair("response_type", "code")
        .append_pair("client_id", &client_id)
        .append_pair("scope", "playlist-read-private streaming") // should be fine immutable
        .append_pair("code_challenge_method", "S256")
        .append_pair("code_challenge", &code_challenge)
        .append_pair("redirect_uri", REDIRECT_URI);

    println!("{}", url.as_str().to_string());
    Ok(url.as_str().to_string())
    // println!("{}", url.as_str());
    // const scope = 'playlist-read-private streaming';
}

#[tauri::command]
pub async fn finish_login(
    state: State<'_, Mutex<SessionState>>,
    code_verifier: String,
    code: String,
) -> Result<String, String> {
    let client = reqwest::Client::new();

    let client_id = env::var("CLIENT_ID").expect("[environment variables] CLIENT_ID must be set");

    let mut params = HashMap::new();
    params.insert("client_id", client_id);
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

        println!("access_token:\n{}", response.access_token);
        println!("refresh_token:\n{}", response.refresh_token);

        let mut state = state.lock().await;

        state.access_token = Some(response.access_token);
        state.refresh_token = Some(response.refresh_token);

        Ok(state.access_token.clone().unwrap())
    }
}
