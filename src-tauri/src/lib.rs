use sea_orm::{Database, DatabaseConnection};
use tauri::Manager;
use tokio::sync::Mutex;
use camino::Utf8PathBuf;

use std::path::PathBuf;
use std::sync::Arc;

use tauri_plugin_store::StoreExt; // needed to access store

use std::env;

mod state;
use state::SessionState;
mod api;
mod db;

use migration::{Migrator, MigratorTrait};

async fn pick_database(path: PathBuf) -> Result<DatabaseConnection, sea_orm::DbErr> {
    let utf8_path = Utf8PathBuf::from_path_buf(path).unwrap();

    let new_path = utf8_path.components()
        .map(|c| c.as_str())
        .collect::<Vec<&str>>()
        .join("/");

    let str_path = format!(
        "sqlite://{}/classifier.db?mode=rwc",
        new_path
    );

    let database = Database::connect(str_path)
        .await
        .unwrap();

    // TODO: verify database has correct fields
    Migrator::up(&database, None)
        .await
        .expect("oh no, my migrator broke");

    Ok(database)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // https://aptabase.com/blog/where-to-find-tauri-logs

    tauri::Builder::default()
        .plugin(
            // https://v2.tauri.app/plugin/logging/
            tauri_plugin_log::Builder::new()
                .level(tauri_plugin_log::log::LevelFilter::Info)
                .max_file_size(50_000 /* bytes */)
                .target(tauri_plugin_log::Target::new(
                    tauri_plugin_log::TargetKind::LogDir {
                        file_name: Some("logs".to_string()),
                    },
                ))
                .timezone_strategy(tauri_plugin_log::TimezoneStrategy::UseLocal)
                .format(|out, message, record| {
                    out.finish(format_args!(
                        "[{} {}] {}",
                        record.level(),
                        record.target(),
                        message
                    ))
                })
                .build(),
        )
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_oauth::init())
        .setup(|app| {
            // from https://v2.tauri.app/plugin/store/
            // temporary solution-- should investigate encrypting both keys

            // this seems to be a pattern for asynchronous initialization (in tauri)
            let app_handle = app.handle().clone();
            let data_path = app.path().app_data_dir().unwrap();
            tauri::async_runtime::spawn(async move {
                if let Ok(store) = app_handle.store("store.json") {
                    let database = pick_database(data_path.clone()).await.expect("doesn't work");

                    let access_token: Option<String>;
                    let refresh_token: Option<String>;
                    let playlist_code: Option<String>;

                    if store.get("access_token").is_none() {
                        access_token = None;
                        // store.set("access_token".to_string(), json!("Guest User"));
                    } else {
                        access_token = Some(
                            store
                                .get("access_token")
                                .unwrap()
                                .as_str()
                                .unwrap()
                                .to_string(),
                        );
                    }

                    if store.get("refresh_token").is_none() {
                        refresh_token = None;
                        // store.set("refresh_token".to_string(), json!("Guest User"));
                    } else {
                        refresh_token = Some(
                            store
                                .get("refresh_token")
                                .unwrap()
                                .as_str()
                                .unwrap()
                                .to_string(),
                        );
                    }

                    if store.get("playlist_code").is_none() {
                        playlist_code = None;
                    } else {
                        playlist_code = Some(
                            store
                                .get("playlist_code")
                                .unwrap()
                                .as_str()
                                .unwrap()
                                .to_string(),
                        );
                    }

                    let _ = store.save();

                    app_handle.manage(Mutex::new(SessionState {
                        access_token: access_token,
                        refresh_token: refresh_token,
                        playlist_code: playlist_code,
                        app_data_directory: data_path,
                        db: Arc::new(Mutex::new(database)),
                    }));
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            api::calls::get_initial_playlist,
            api::calls::get_profile,
            api::calls::get_initial_playlist,
            api::calls::set_playlist,
            api::calls::get_current_playlist_details,
            api::calls::get_playlist_items,
            api::calls::get_comment,
            api::calls::save_comment,
            api::login::init_login,
            api::login::finish_login,
            api::login::log_off,
            api::login::start_response_server,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
