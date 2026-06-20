use crate::db::with_db;
use crate::models::{CharsetMeta, CharsetData};
use rusqlite::params;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

#[derive(Debug, Serialize, Deserialize)]
struct CharsetFile {
    title: String,
    words: Vec<String>,
}

fn charsets_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("charsets");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

#[tauri::command]
pub fn list_charsets(app: AppHandle) -> Result<Vec<CharsetMeta>, String> {
    let dir = charsets_dir(&app)?;
    let mut out = Vec::new();
    if let Ok(entries) = std::fs::read_dir(&dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().map(|e| e == "json").unwrap_or(false) {
                let id = path
                    .file_stem()
                    .map(|s| s.to_string_lossy().to_string())
                    .unwrap_or_default();
                if let Ok(content) = std::fs::read_to_string(&path) {
                    if let Ok(data) = serde_json::from_str::<CharsetFile>(&content) {
                        out.push(CharsetMeta {
                            id: id.clone(),
                            title: data.title,
                            word_count: data.words.len(),
                            builtin: is_builtin(&id),
                        });
                    }
                }
            }
        }
    }
    out.sort_by_key(|c| (!c.builtin, c.title.clone()));
    Ok(out)
}

fn is_builtin(id: &str) -> bool {
    id.starts_with("common-")
}

#[tauri::command]
pub fn load_charset(app: AppHandle, id: String) -> Result<CharsetData, String> {
    let dir = charsets_dir(&app)?;
    let path = dir.join(format!("{}.json", id));
    let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let data: CharsetFile = serde_json::from_str(&content).map_err(|e| e.to_string())?;
    Ok(CharsetData {
        id,
        title: data.title,
        words: data.words,
    })
}

#[tauri::command]
pub fn import_charset(app: AppHandle, title: String, words: Vec<String>) -> Result<String, String> {
    if words.len() < 10 {
        return Err("字集至少需要 10 个字".into());
    }
    let dir = charsets_dir(&app)?;
    // 生成唯一 id
    let ts = chrono::Local::now().format("%Y%m%d%H%M%S").to_string();
    let id = format!("custom-{}", ts);
    let data = CharsetFile { title, words };
    let json = serde_json::to_string_pretty(&data).map_err(|e| e.to_string())?;
    let path = dir.join(format!("{}.json", id));
    std::fs::write(&path, json).map_err(|e| e.to_string())?;
    Ok(id)
}

#[tauri::command]
pub fn set_default_charset(id: String) -> Result<(), String> {
    with_db(|conn| {
        conn.execute(
            "INSERT INTO settings (key, value) VALUES ('default_charset', ?1)
             ON CONFLICT(key) DO UPDATE SET value = ?1",
            params![id],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    })
}

#[tauri::command]
pub fn get_default_charset() -> Result<Option<String>, String> {
    with_db(|conn| {
        let mut stmt = conn
            .prepare("SELECT value FROM settings WHERE key = 'default_charset'")
            .map_err(|e| e.to_string())?;
        let mut rows = stmt
            .query_map([], |row| row.get::<_, String>(0))
            .map_err(|e| e.to_string())?;
        if let Some(r) = rows.next() {
            Ok(Some(r.map_err(|e| e.to_string())?))
        } else {
            Ok(None)
        }
    })
}
