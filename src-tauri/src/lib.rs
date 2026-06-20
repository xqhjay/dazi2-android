// 防止 Android 警告
#![allow(dead_code)]

mod db;
mod models;
mod commands;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_haptics::init())
        .setup(|app| {
            let app_data_dir = app.path().app_data_dir().expect("no app data dir");
            std::fs::create_dir_all(&app_data_dir).ok();
            db::init_db(&app_data_dir).expect("db init failed");
            // 复制内置字集到 app data（首次）
            copy_builtin_charsets(app, &app_data_dir);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::practice::save_record,
            commands::practice::get_records,
            commands::practice::get_recent_stats,
            commands::practice::get_trend,
            commands::practice::get_overview,
            commands::charset::list_charsets,
            commands::charset::load_charset,
            commands::charset::import_charset,
            commands::charset::set_default_charset,
            commands::charset::get_default_charset,
            commands::stats::get_error_chars,
            commands::stats::update_char_mastery,
            commands::stats::get_char_mastery,
            commands::achievement::check_achievements,
            commands::achievement::list_achievements,
            commands::checkin::do_checkin,
            commands::checkin::get_checkin_status,
            commands::settings::get_setting,
            commands::settings::set_setting,
            commands::settings::get_all_settings,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn copy_builtin_charsets(app: &tauri::App, app_data_dir: &std::path::Path) {
    let target_dir = app_data_dir.join("charsets");
    std::fs::create_dir_all(&target_dir).ok();
    let resource_dir = app.path().resource_dir().expect("no resource dir");
    let builtin_dir = resource_dir.join("charsets");
    if !builtin_dir.exists() {
        return;
    }
    if let Ok(entries) = std::fs::read_dir(&builtin_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().map(|e| e == "json").unwrap_or(false) {
                let dest = target_dir.join(path.file_name().unwrap());
                if !dest.exists() {
                    std::fs::copy(&path, &dest).ok();
                }
            }
        }
    }
}
