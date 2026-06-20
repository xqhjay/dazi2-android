use crate::db::with_db;
use crate::models::{now_iso, Overview, PracticeRecord, SavedRecord, TrendPoint};
use rusqlite::params;

#[tauri::command]
pub fn save_record(record: PracticeRecord) -> Result<i64, String> {
    with_db(|conn| {
        conn.execute(
            "INSERT INTO practice_records
             (mode, charset_id, wpm, accuracy, score, duration_sec, cleared_count, error_count, is_passed, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![
                record.mode,
                record.charset_id,
                record.wpm,
                record.accuracy,
                record.score,
                record.duration_sec,
                record.cleared_count,
                record.error_count,
                record.is_passed as i32,
                now_iso(),
            ],
        )
        .map_err(|e| e.to_string())?;
        let id = conn.last_insert_rowid();

        // 更新单字掌握度
        for ch in &record.cleared_chars {
            let _ = conn.execute(
                "INSERT INTO char_mastery (char, charset_id, correct_count, error_count, last_practiced_at)
                 VALUES (?1, ?2, 1, 0, ?3)
                 ON CONFLICT(char, charset_id) DO UPDATE SET
                   correct_count = correct_count + 1,
                   last_practiced_at = ?3",
                params![ch, record.charset_id, now_iso()],
            );
        }
        for ch in &record.error_chars {
            let _ = conn.execute(
                "INSERT INTO char_mastery (char, charset_id, correct_count, error_count, last_practiced_at)
                 VALUES (?1, ?2, 0, 1, ?3)
                 ON CONFLICT(char, charset_id) DO UPDATE SET
                   error_count = error_count + 1,
                   last_practiced_at = ?3",
                params![ch, record.charset_id, now_iso()],
            );
        }
        Ok(id)
    })
}

#[tauri::command]
pub fn get_records(limit: Option<i64>) -> Result<Vec<SavedRecord>, String> {
    with_db(|conn| {
        let limit = limit.unwrap_or(50);
        let mut stmt = conn
            .prepare(
                "SELECT id, mode, charset_id, wpm, accuracy, score, duration_sec,
                        cleared_count, error_count, is_passed, created_at
                 FROM practice_records ORDER BY created_at DESC LIMIT ?1",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![limit], |row| {
                Ok(SavedRecord {
                    id: row.get(0)?,
                    mode: row.get(1)?,
                    charset_id: row.get(2)?,
                    wpm: row.get(3)?,
                    accuracy: row.get(4)?,
                    score: row.get(5)?,
                    duration_sec: row.get(6)?,
                    cleared_count: row.get(7)?,
                    error_count: row.get(8)?,
                    is_passed: row.get::<_, i32>(9)? != 0,
                    created_at: row.get(10)?,
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
pub fn get_overview() -> Result<Overview, String> {
    with_db(|conn| {
        let mut stmt = conn
            .prepare(
                "SELECT
                   COALESCE(SUM(duration_sec),0),
                   COALESCE(SUM(cleared_count),0),
                   COALESCE(AVG(wpm),0),
                   COALESCE(AVG(accuracy),0),
                   COUNT(*)
                 FROM practice_records",
            )
            .map_err(|e| e.to_string())?;
        stmt.query_row([], |row| {
            Ok(Overview {
                total_duration_sec: row.get(0)?,
                total_cleared: row.get(1)?,
                avg_wpm: row.get(2)?,
                avg_accuracy: row.get(3)?,
                total_sessions: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())
    })
}

#[tauri::command]
pub fn get_trend(days: Option<i64>) -> Result<Vec<TrendPoint>, String> {
    with_db(|conn| {
        let days = days.unwrap_or(7);
        let since = chrono::Local::now()
            .date_naive()
            .checked_sub_days(chrono::Duration::days(days))
            .ok_or("date error")?
            .format("%Y-%m-%d")
            .to_string();
        let mut stmt = conn
            .prepare(
                "SELECT substr(created_at,1,10) as d, AVG(wpm), AVG(accuracy)
                 FROM practice_records
                 WHERE substr(created_at,1,10) >= ?1
                 GROUP BY d ORDER BY d ASC",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![since], |row| {
                Ok(TrendPoint {
                    date: row.get(0)?,
                    wpm: row.get(1)?,
                    accuracy: row.get(2)?,
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
pub fn get_recent_stats() -> Result<Option<SavedRecord>, String> {
    with_db(|conn| {
        let mut stmt = conn
            .prepare(
                "SELECT id, mode, charset_id, wpm, accuracy, score, duration_sec,
                        cleared_count, error_count, is_passed, created_at
                 FROM practice_records ORDER BY created_at DESC LIMIT 1",
            )
            .map_err(|e| e.to_string())?;
        let mut rows = stmt
            .query_map([], |row| {
                Ok(SavedRecord {
                    id: row.get(0)?,
                    mode: row.get(1)?,
                    charset_id: row.get(2)?,
                    wpm: row.get(3)?,
                    accuracy: row.get(4)?,
                    score: row.get(5)?,
                    duration_sec: row.get(6)?,
                    cleared_count: row.get(7)?,
                    error_count: row.get(8)?,
                    is_passed: row.get::<_, i32>(9)? != 0,
                    created_at: row.get(10)?,
                })
            })
            .map_err(|e| e.to_string())?;
        if let Some(r) = rows.next() {
            Ok(Some(r.map_err(|e| e.to_string())?))
        } else {
            Ok(None)
        }
    })
}
