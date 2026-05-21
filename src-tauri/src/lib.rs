use tauri::Manager;
use tauri::State;
use tokio::sync::Mutex;

use std::fs::File;
use std::io::BufReader;

use serde_json::Value;
use tauri_plugin_store::StoreExt;  // needed to access store

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
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_oauth::init())
        .setup(|app| {
            // from https://v2.tauri.app/plugin/store/
            // temporary solution-- should investigate encrypting both keys

            // this seems to be a pattern for asynchronous initialization (in tauri)
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if let Ok(store) = app_handle.store("store.json") {
                    let access_token: Option<String>;
                    let refresh_token: Option<String>;

                    if store.get("access_token").is_none() {
                        access_token = None;
                        // store.set("access_token".to_string(), json!("Guest User"));
                    } else {
                        access_token = Some(store.get("access_token").unwrap().as_str().unwrap().to_string());
                    }

                    if store.get("refresh_token").is_none() {
                        refresh_token = None;
                        // store.set("refresh_token".to_string(), json!("Guest User"));
                    } else {
                        refresh_token = Some(store.get("refresh_token").unwrap().as_str().unwrap().to_string());
                    }

                    let _ = store.save();

                    app_handle.manage(Mutex::new(SessionState {
                        access_token: access_token,
                        refresh_token: refresh_token,
                        playlist_url: read_res["final_list_destination"].to_string(),
                    }));
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // api_auth_response_login,
            get_sorting_playlist,
            api::calls::get_profile,
            api::login::init_login,
            api::login::finish_login,
            api::login::start_server,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
