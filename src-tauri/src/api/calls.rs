use tauri::Manager;
use tauri::State;
use tokio::sync::Mutex;
use std::collections::HashMap;


use serde_json::Value;
use reqwest::header::AUTHORIZATION;
use super::data::GetProfileResponse;
use crate::state::SessionState;


// pub enum Response {

// }

const ROOT_PATH: &str = "https://api.spotify.com/v1";


// TODO:
// 1. storing login keys
// 2. getting new login keys through refresh token
// 3. response structs
// 4. make log-ins server side


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
pub async fn api_get_profile(
    state: State<'_, Mutex<SessionState>>
) -> Result<Vec<String>, String> {
    let state = state.lock().await;
    // lesson: need to explicitly make references to not consume 'common property'
    // alternatives are .clone() (clone entirely for ownership) and .take() (to remove)
    let token = state.access_token.as_deref().unwrap_or("dud token");  // TODO: should raise if there isn't anything

    let res = call("/me", token).await;
    let value: Vec<String> = match res {
        Ok(resp) => {
            let unwrapped = resp.json::<GetProfileResponse>().await.expect("what now");
            let mut ret = Vec::new();
            ret.push(unwrapped.display_name.clone());
            ret.push(unwrapped.images[0].url.clone());
            ret
        },
        Err(_) => {
            let mut default = Vec::new();
            default.push("Not Logged In (Jo Doe)".to_string());
            default.push("https://upload.wikimedia.org/wikipedia/commons/a/ac/Default_pfp.jpg".to_string());
            default
        }
    };

    Ok(value)


    // let response = client.get("https://api.spotify.com/v1/me")
    //     .header(AUTHORIZATION, format!("Bearer {}", token))
    //     .send()
    //     .await
    //     .expect("error, ruh roh");

    // println!("{:?}", response.text().await);
    // println!("{:?}", response.json::<GetProfileResponse>().await);


    // if body.is_err() {
    //     println!("failed");
    //     Err("err".to_string())
    // } else {
    //     // response is for sure successful, unwrap and save the contents
    //     let response = body.unwrap();
        

    //     println!("access_token:\n{}", response.access_token);
    //     println!("refresh_token:\n{}", response.refresh_token);

    //     let mut state = state.lock().await;

    //     state.access_token = Some(response.access_token);
    //     state.refresh_token = Some(response.refresh_token);

    //     Ok(state.access_token.clone().unwrap())
    // }
}