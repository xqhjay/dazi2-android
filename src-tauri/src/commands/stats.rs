use crate::db::with_db;
use crate::models::ErrorChar;
use rusqlite::params;

#[tauri::command]
pub fn get_error_chars(limit: Option<i64>) -> Result<Vec<ErrorChar>, String> {
    with_db(|conn| {
        let limit = limit.unwrap_or(100);
        let mut stmt = conn
            .prepare(
                "SELECT char, charset_id, error_count, correct_count, last_practiced_at
                 FROM char_mastery
                 WHERE error_count > 0
                 ORDER BY error_count DESC, correct_count ASC LIMIT ?1",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![limit], |row| {
                Ok(ErrorChar {
                    char: row.get(0)?,
                    charset_id: row.get(1)?,
                    error_count: row.get(2)?,
                    correct_count: row.get(3)?,
                    last_practiced_at: row.get(4)?,
                })
            })
            .map_err(|e| e.to_string())?;
        let mut out = Vec::new();
        for r in rows {
            out.push(r.map_err(|e| e.to_string())?);
        }
        Ok(out)
    })
}

#[tauri::command]
pub fn update_char_mastery(
    charset_id: String,
    cleared_chars: Vec<String>,
    error_chars: Vec<String>,
) -> Result<(), String> {
    use crate::models::now_iso;
    let now = now_iso();
    with_db(|conn| {
        for ch in &cleared_chars {
            let _ = conn.execute(
                "INSERT INTO char_mastery (char, charset_id, correct_count, error_count, last_practiced_at)
                 VALUES (?1, ?2, 1, 0, ?3)
                 ON CONFLICT(char, charset_id) DO UPDATE SET
                   correct_count = correct_count + 1,
                   last_practiced_at = ?3",
                params![ch, charset_id, now],
            );
        }
        for ch in &error_chars {
            let _ = conn.execute(
                "INSERT INTO char_mastery (char, charset_id, correct_count, error_count, last_practiced_at)
                 VALUES (?1, ?2, 0, 1, ?3)
                 ON CONFLICT(char, charset_id) DO UPDATE SET
                   error_count = error_count + 1,
                   last_practiced_at = ?3",
                params![ch, charset_id, now],
            );
        }
        Ok(())
    })
}

#[tauri::command]
pub fn get_char_mastery(charset_id: String, limit: Option<i64>) -> Result<Vec<ErrorChar>, String> {
    with_db(|conn| {
        let limit = limit.unwrap_or(500);
        let mut stmt = conn
            .prepare(
                "SELECT char, charset_id, error_count, correct_count, last_practiced_at
                 FROM char_mastery WHERE charset_id = ?1 LIMIT ?2",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![charset_id, limit], |row| {
                Ok(ErrorChar {
                    char: row.get(0)?,
                    charset_id: row.get(1)?,
                    error_count: row.get(2)?,
                    correct_count: row.get(3)?,
                    last_practiced_at: row.get(4)?,
                })
            })
            .map_err(|e| e.to_string())?;
        let mut out = Vec::new();
        for r in rows {
            out.push(r.map_err(|e| e.to_string())?);
        }
        Ok(out)
    })
}
