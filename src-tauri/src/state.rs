use sea_orm::DatabaseConnection;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::Mutex;

#[derive(Debug, Clone)]
pub struct SessionState {
    pub access_token: Option<String>,
    pub refresh_token: Option<String>,
    pub playlist_code: Option<String>,
    #[allow(dead_code)]
    pub app_data_directory: PathBuf,
    pub db: Arc<Mutex<DatabaseConnection>>,
}
