use tauri::Manager;
use tauri::State;
use tokio::sync::Mutex;
use std::collections::HashMap;
use serde::Deserialize;

use std::fs::File;
use std::io::BufReader;

use serde_json::Value;

use reqwest::header::AUTHORIZATION;

use dotenvy::dotenv;
use std::env;

mod state;
use state::SessionState;
mod api;


#[derive(Deserialize)]
struct SpotifySuccessfulResponse {
    access_token: String,
    token_type: String,
    expires_in: i32,
    refresh_token: String,
    scope: String
}

#[tauri::command]
async fn get_sorting_playlist(state: State<'_, Mutex<SessionState>>) -> Result<String, String> {
    let state = state.lock().await;

    Ok(state.playlist_url.clone())
}

// TODO: ...what is 'static?
#[tauri::command]
async fn api_auth_response_login(state: State<'_, Mutex<SessionState>>, code_verifier: String, code: String) -> Result<String, String> {
    // TODO: url encode, make more dynamic
    let client = reqwest::Client::new();

    let client_id = env::var("CLIENT_ID")
        .expect("[environment variables] CLIENT_ID must be set");

    let mut params = HashMap::new();
    params.insert("client_id", client_id);
    params.insert("grant_type", "authorization_code".to_string());
    params.insert("code", code);
    params.insert("redirect_uri", "http://127.0.0.1:1420/".to_string());
    params.insert("code_verifier", code_verifier);

    let response = client.post("https://accounts.spotify.com/api/token")
        .form(&params)
        .send()
        .await
        .expect("error");
    // println!("{:?}", &response);
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

// #[tauri::command]
// async fn get_login_info(state: State<'_, Mutex<SessionState>>) -> Result<String, String> {
//     // duh duh duh

//     let client = reqwest::Client::new();


//     Ok("Not Logged In")
// }


#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let file = File::open("CONFIG.json").expect("gng");
    let reader = BufReader::new(file);
    let read_res: Value = serde_json::from_reader(reader).expect("crap");

    // TODO: this is most likely redundant
    dotenv().ok(); 

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        // TODO: how do we want to store tokens long term (refresh tokens, save to js file (that one's probably not safe))
        .manage(Mutex::new(SessionState {
            access_token: None,
            refresh_token: None,
            playlist_url: read_res["final_list_destination"].to_string()
        }))
        .invoke_handler(tauri::generate_handler![
            api_auth_response_login,
            get_sorting_playlist,
            api::calls::get_profile,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
