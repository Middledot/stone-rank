use serde::{Deserialize, Serialize};

#[derive(Deserialize, Debug)]
pub struct ImageObjects {
    pub height: i32,
    pub width: i32,
    pub url: String
}



#[derive(Deserialize, Debug)]
pub struct GetProfileResponse {
    pub display_name: String,
    // href: String,
    pub id: String,
    pub images: Vec<ImageObjects>,
    // external_urls: ExternalURLsResponse,
    // followers: Option<FollowersResponse>,
}

#[derive(Deserialize)]
pub struct SpotifySuccessfulResponse {
    pub access_token: String,
    pub token_type: String,
    pub expires_in: i32,
    pub refresh_token: String,
    pub scope: String
}



// === Below here ===
// are structs for responses from server -> backend

#[derive(Serialize, Deserialize, Debug)]
pub struct Profile {
    pub name: String,
    pub pfp: String,
    pub logged_in: bool
    // external_urls: ExternalURLsResponse,
    // followers: Option<FollowersResponse>,
}



// #[derive(Deserialize)]
// struct ExternalURLsResponse {
//     spotify: String
// }

// #[derive(Deserialize)]
// struct FollowersResponse {
//     href: Option<String>,
//     total: i32
// }

