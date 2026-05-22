use tauri::State;
use tokio::sync::{Mutex, MutexGuard};
use serde_json::{json};
use tauri_plugin_store::StoreExt;  // needed to access store

use super::data::{GetProfileResponse, Profile};
use super::login::refresh_tokens;
use crate::state::SessionState;
use reqwest::header::AUTHORIZATION;

// pub enum Response {

// }

const ROOT_PATH: &str = "https://api.spotify.com/v1";

// TODO:
// 2. storing login keys (DONE but make more secure)
// 3. getting new login keys through refresh token
// 4. response structs

async fn call(url: String, token: String) -> reqwest::Response {
    let client = reqwest::Client::new();

    client
        .get(url)
        .header(AUTHORIZATION, format!("Bearer {}", token))
        .send()
        .await
        .expect("WHAT BROKE? manage it please")
}


// these are separate functions ONLY because of token refreshing
// I don't want to implement Box::pin or whatever that is for recursive
// asynchronous functions... this will do
async fn call_with_state(app: &tauri::AppHandle, state: &mut MutexGuard<'_, SessionState>, path: &str) -> Result<reqwest::Response, ()> {
    let url = format!("{}{}", ROOT_PATH, path);

    // lesson: need to explicitly make references to not consume 'common property'
    // alternatives are .clone() (clone entirely for ownership) and .take() (to remove)
    let token = state.access_token.as_deref().unwrap_or("").to_string();
    let retoken = state.refresh_token.as_deref().unwrap_or("").to_string();

    // I'm assuming if one's gone, the other's gone
    if token == "" {
        return Err(());
    }

    let mut response = call(url.clone(), token.clone()).await;
    let status = (response.status().as_u16()) as i16;

    if status == 400 {  // || true {  // this is to force a token refresh
        let (new_token, new_retoken) = refresh_tokens(retoken.to_string()).await.expect("kablooey");

        // comment this out for testing
        let store = app.store("store.json").unwrap();
        store.set("access_token", json!(new_token.clone()));
        store.set("refresh_token", json!(new_retoken.clone()));

        let _ = store.save();

        state.access_token = Some(new_token);
        state.refresh_token = Some(new_retoken);

        response = call(url.clone(), token.clone()).await;  // I can use it here!! cuz it propogates to the upper functions Result response!!!!!
    }
    // separate branches so refresh can only happen max once per request

    if status > 400 {
        Err(())
    } else {
        Ok(response)
    }
}

// TODO: how to access store without app handle?
#[tauri::command]
pub async fn get_profile(app: tauri::AppHandle, state: State<'_, Mutex<SessionState>>) -> Result<Profile, String> {
    let mut state = state.lock().await;

    let res = call_with_state(&app, &mut state, "/me").await;
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
