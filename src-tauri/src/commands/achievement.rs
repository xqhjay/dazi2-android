use crate::db::with_db;
use crate::models::{now_iso, Achievement};
use rusqlite::params;

// 成就定义
fn achievement_defs() -> Vec<(&'static str, &'static str, &'static str)> {
    vec![
        ("first_practice", "初心者", "完成首次练习"),
        ("streak_7", "勤勉之士", "连续打卡 7 天"),
        ("streak_30", "坚持不懈", "连续打卡 30 天"),
        ("clear_100", "百字斩", "单局消除 100 字"),
        ("wpm_40", "速度达人", "单局 WPM ≥ 40"),
        ("accuracy_98", "精准之手", "单局准确率 ≥ 98%"),
        ("total_1000", "千字大师", "累计消除 1000 字"),
        ("endless_500", "无尽行者", "无尽模式得分 ≥ 500"),
    ]
}

#[tauri::command]
pub fn list_achievements() -> Result<Vec<Achievement>, String> {
    let defs = achievement_defs();
    with_db(|conn| {
        let mut out = Vec::new();
        for (code, title, desc) in defs {
            let unlocked_at: Option<String> = conn
                .query_row(
                    "SELECT unlocked_at FROM achievements WHERE code = ?1",
                    params![code],
                    |row| row.get(0),
                )
                .ok();
            out.push(Achievement {
                code: code.to_string(),
                title: title.to_string(),
                description: desc.to_string(),
                unlocked: unlocked_at.is_some(),
                unlocked_at,
            });
        }
        Ok(out)
    })
}

#[tauri::command]
pub fn check_achievements(
    wpm: f64,
    accuracy: f64,
    cleared_count: i64,
    mode: String,
    score: i64,
) -> Result<Vec<String>, String> {
    let mut newly = Vec::new();
    with_db(|conn| {
        // first_practice: 只要有记录就解锁
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM practice_records", [], |row| row.get(0))
            .unwrap_or(0);
        if count >= 1 {
            try_unlock(conn, "first_practice", &mut newly)?;
        }
        if cleared_count >= 100 {
            try_unlock(conn, "clear_100", &mut newly)?;
        }
        if wpm >= 40.0 {
            try_unlock(conn, "wpm_40", &mut newly)?;
        }
        if accuracy >= 98.0 {
            try_unlock(conn, "accuracy_98", &mut newly)?;
        }
        // 累计消除
        let total: i64 = conn
            .query_row("SELECT COALESCE(SUM(cleared_count),0) FROM practice_records", [], |row| {
                row.get(0)
            })
            .unwrap_or(0);
        if total >= 1000 {
            try_unlock(conn, "total_1000", &mut newly)?;
        }
        if mode == "endless" && score >= 500 {
            try_unlock(conn, "endless_500", &mut newly)?;
        }
        // 连续打卡
        let streak: i64 = conn
            .query_row(
                "SELECT COALESCE(MAX(streak),0) FROM checkins",
                [],
                |row| row.get(0),
            )
            .unwrap_or(0);
        if streak >= 7 {
            try_unlock(conn, "streak_7", &mut newly)?;
        }
        if streak >= 30 {
            try_unlock(conn, "streak_30", &mut newly)?;
        }
        Ok(newly)
    })
}

fn try_unlock(conn: &rusqlite::Connection, code: &str, newly: &mut Vec<String>) -> Result<(), String> {
    let exists: bool = conn
        .query_row(
            "SELECT 1 FROM achievements WHERE code = ?1",
            params![code],
            |_| Ok(true),
        )
        .unwrap_or(false);
    if !exists {
        conn.execute(
            "INSERT INTO achievements (code, unlocked_at) VALUES (?1, ?2)",
            params![code, now_iso()],
        )
        .map_err(|e| e.to_string())?;
        newly.push(code.to_string());
    }
    Ok(())
}
