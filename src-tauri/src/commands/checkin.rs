use crate::db::with_db;
use crate::models::{today_date, CheckinStatus};
use rusqlite::params;

#[tauri::command]
pub fn do_checkin() -> Result<CheckinStatus, String> {
    let today = today_date();
    with_db(|conn| {
        // 检查今天是否已打卡
        let already: bool = conn
            .query_row(
                "SELECT 1 FROM checkins WHERE date = ?1",
                params![today],
                |_| Ok(true),
            )
            .unwrap_or(false);

        if !already {
            // 计算昨天日期
            let yesterday = chrono::Local::now()
                .date_naive()
                .checked_sub_days(chrono::Duration::days(1))
                .map(|d| d.format("%Y-%m-%d").to_string());
            let streak = if let Some(y) = yesterday {
                conn.query_row(
                    "SELECT streak FROM checkins WHERE date = ?1",
                    params![y],
                    |row| row.get::<_, i64>(0),
                )
                .unwrap_or(0) + 1
            } else {
                1
            };
            conn.execute(
                "INSERT INTO checkins (date, streak) VALUES (?1, ?2)",
                params![today, streak],
            )
            .map_err(|e| e.to_string())?;
        }

        let status = conn
            .query_row(
                "SELECT COALESCE(MAX(streak),0), COUNT(*) FROM checkins",
                [],
                |row| Ok((row.get::<_, i64>(0)?, row.get::<_, i64>(1)?)),
            )
            .unwrap_or((0, 0));
        Ok(CheckinStatus {
            today: true,
            streak: status.0,
            total: status.1,
        })
    })
}

#[tauri::command]
pub fn get_checkin_status() -> Result<CheckinStatus, String> {
    let today = today_date();
    with_db(|conn| {
        let already: bool = conn
            .query_row(
                "SELECT 1 FROM checkins WHERE date = ?1",
                params![today],
                |_| Ok(true),
            )
            .unwrap_or(false);
        let status = conn
            .query_row(
                "SELECT COALESCE(MAX(streak),0), COUNT(*) FROM checkins",
                [],
                |row| Ok((row.get::<_, i64>(0)?, row.get::<_, i64>(1)?)),
            )
            .unwrap_or((0, 0));
        Ok(CheckinStatus {
            today: already,
            streak: status.0,
            total: status.1,
        })
    })
}
