use serde::{Deserialize, Serialize};

#[derive(Serialize, Debug)]
pub struct PlaylistPage {
    pub limit: i32,
    pub offset: i32,
    pub items: Vec<PlaylistItem>,
}

#[derive(Serialize, Debug)]
pub struct PlaylistItem {
    pub id: String,
    pub title: String,
    pub href: String,
    pub icon: String,
    pub artist: String,
}

#[derive(Deserialize, Debug)]
pub struct ImageObjects {
    #[allow(dead_code)]
    pub height: i32,
    #[allow(dead_code)]
    pub width: i32,
    pub url: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct GetPlaylistDeetsResponse {
    pub name: String,
    pub items: PlaylistDeetsItems,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct PlaylistDeetsItems {
    pub total: i32,
}

#[derive(Deserialize, Debug)]
pub struct GetProfileResponse {
    pub display_name: String,
    #[allow(dead_code)]
    pub id: String,
    pub images: Vec<ImageObjects>,
    // href: String,
    // external_urls: ExternalURLsResponse,
    // followers: Option<FollowersResponse>,
}

// track(name,href,album(name,href,image))
#[derive(Deserialize, Debug)]
pub struct GetPlaylistItemsResponse {
    pub limit: i32,
    pub offset: i32,
    pub items: Vec<SuperItem>,
}

#[derive(Deserialize, Debug)]
pub struct SuperItem {
    pub item: Item,
}

#[derive(Deserialize, Debug)]
pub struct Item {
    pub id: Option<String>,
    pub href: Option<String>,
    pub name: String,
    pub artists: Vec<Artist>,
    pub album: Album,
}

#[derive(Deserialize, Debug)]
pub struct Album {
    #[allow(dead_code)]
    pub id: Option<String>,
    #[allow(dead_code)]
    pub href: Option<String>,
    #[allow(dead_code)]
    pub name: String,
    pub images: Vec<ImageObjects>,
}

#[derive(Deserialize, Debug)]
pub struct Artist {
    pub name: String,
}

#[derive(Deserialize)]
pub struct SpotifySuccessfulResponse {
    pub access_token: String,
    pub token_type: String,
    pub expires_in: i32,
    pub refresh_token: String,
    pub scope: String,
}

// === Below here ===
// are structs for responses from server -> backend

#[derive(Serialize, Deserialize, Debug)]
pub struct Profile {
    pub name: String,
    pub pfp: String,
    pub logged_in: bool, // external_urls: ExternalURLsResponse,
                         // followers: Option<FollowersResponse>,
}

// #[derive(Deserialize, Debug)]
// pub struct ApiError {
//     pub inner: Error,
// }

// #[derive(Deserialize, Debug)]
// pub struct Error {
//     pub status: i32,
//     pub message: String,
// }

// #[derive(Deserialize)]
// struct ExternalURLsResponse {
//     spotify: String
// }

// #[derive(Deserialize)]
// struct FollowersResponse {
//     href: Option<String>,
//     total: i32
// }
