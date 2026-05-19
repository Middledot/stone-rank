use tauri::Manager;
use tauri::State;
use tokio::sync::Mutex;
use std::collections::HashMap;


use serde_json::Value;
use reqwest::header::AUTHORIZATION;
use super::data::{
    GetProfileResponse,
    Profile
};
use crate::state::SessionState;


// pub enum Response {

// }

const ROOT_PATH: &str = "https://api.spotify.com/v1";


// TODO:
// 1. make log-ins server side
// 2. storing login keys
// 3. getting new login keys through refresh token
// 4. response structs


async fn call(
    path: &str,
    token: &str,

) -> Result<reqwest::Response, ()> {
    let client = reqwest::Client::new();
    let url = format!("{}{}", ROOT_PATH, path);

    let response = client.get(url)
        .header(AUTHORIZATION, format!("Bearer {}", token))
        .send()
        .await
        .expect("WHAT BROKE? manage it please");

    let status = (response.status().as_u16()) as i16;

    if status >= 400 {
        Err(())
    } else {
        println!("testing");
        Ok(response)
    }
}


#[tauri::command]
pub async fn get_profile(
    state: State<'_, Mutex<SessionState>>
) -> Result<Profile, String> {
    let state = state.lock().await;
    // lesson: need to explicitly make references to not consume 'common property'
    // alternatives are .clone() (clone entirely for ownership) and .take() (to remove)
    let token = state.access_token.as_deref().unwrap_or("dud token");  // TODO: should raise if there isn't anything

    let res = call("/me", token).await;
    let value: Profile = match res {
        Ok(resp) => {
            let unwrapped = resp.json::<GetProfileResponse>().await.expect("what now");
            let ret = Profile {
                name: unwrapped.display_name.clone(),
                pfp: unwrapped.images[0].url.clone(),
                logged_in: true
            };
            ret
        },
        Err(_) => {
            let default = Profile {
                name: "Not Logged In (Jo Doe)".to_string(),
                pfp: "https://upload.wikimedia.org/wikipedia/commons/a/ac/Default_pfp.jpg".to_string(),
                logged_in: false
            };
            default
        }
    };

    Ok(value)
}