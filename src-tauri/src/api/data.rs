use serde::Deserialize;

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



// #[derive(Deserialize)]
// struct ExternalURLsResponse {
//     spotify: String
// }

// #[derive(Deserialize)]
// struct FollowersResponse {
//     href: Option<String>,
//     total: i32
// }

