use tauri::Manager;
use tauri::State;
use tokio::sync::Mutex;
use std::collections::HashMap;
use serde::Deserialize;

use std::fs::File;
use std::io::BufReader;

use serde_json::Value;

pub struct SessionState {
    pub access_token: Option<String>,
    pub refresh_token: Option<String>,
    pub playlist_url: String

}

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

    Ok(state.playlist_url)
}


// TODO: ...what is 'static?
#[tauri::command]
async fn retrieve_auth(state: State<'_, Mutex<SessionState>>, code_verifier: String, code: String) -> Result<String, String> {
    // TODO: url encode, make more dynamic
    let client = reqwest::Client::new();

    let mut params = HashMap::new();
    params.insert("client_id", "0c337be3f1164b81ac0fb432845ae93d");
    params.insert("grant_type", "authorization_code");
    params.insert("code", &code);
    params.insert("redirect_uri", "http://127.0.0.1:1420");
    params.insert("code_verifier", &code_verifier);

    let response = client.post("https://accounts.spotify.com/api/token")
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

// #[tauri::command]
// async fn get_login_info(state: State<'_, Mutex<SessionState>>) -> Result<String, String> {
//     // duh duh duh

//     let client = reqwest::Client::new();


//     Ok("Not Logged In")
// }


#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let file = File::open("CONFIG.json")?;
    let reader = BufReader::new(file);
    let read_res: Value = serde_json::from_reader(reader)?;

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        // TODO: how do we want to store tokens long term (refresh tokens, save to js file (that one's probably not safe))
        .manage(Mutex::new(SessionState {
            access_token: None,
            refresh_token: None,
            playlist_url: read_res["final_list_destination"]
        }))
        .invoke_handler(tauri::generate_handler![retrieve_auth, get_sorting_playlist])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
