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


#[tauri::command]
async fn get_sorting_playlist(state: State<'_, Mutex<SessionState>>) -> Result<String, String> {
    let state = state.lock().await;

    Ok(state.playlist_url.clone())
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
            // api_auth_response_login,
            get_sorting_playlist,
            api::calls::get_profile,
            api::login::init_login,
            api::login::finish_login,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
