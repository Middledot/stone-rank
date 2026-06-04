use std::path::PathBuf;
use tokio::sync::Mutex;
use std::sync::Arc;
use sea_orm::DatabaseConnection;

#[derive(Debug, Clone)]
pub struct SessionState {
    pub access_token: Option<String>,
    pub refresh_token: Option<String>,
    pub playlist_code: Option<String>,
    pub app_data_directory: PathBuf,
    pub db: Arc<Mutex<DatabaseConnection>>,
}
