use once_cell::sync::OnceCell;
use parking_lot::Mutex;
use rusqlite::Connection;
use std::path::Path;

static DB: OnceCell<Mutex<Connection>> = OnceCell::new();

pub fn init_db(app_data_dir: &Path) -> Result<(), Box<dyn std::error::Error>> {
    let db_path = app_data_dir.join("typing_boost.db");
    let conn = Connection::open(db_path)?;
    conn.execute_batch(MIGRATION_SQL)?;
    let _ = DB.set(Mutex::new(conn));
    Ok(())
}

pub fn with_db<F, R>(f: F) -> Result<R, String>
where
    F: FnOnce(&Connection) -> Result<R, String>,
{
    let cell = DB.get().ok_or("db not initialized")?;
    let conn = cell.lock();
    f(&conn)
}

const MIGRATION_SQL: &str = "
CREATE TABLE IF NOT EXISTS practice_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mode TEXT NOT NULL,
    charset_id TEXT NOT NULL,
    wpm REAL NOT NULL,
    accuracy REAL NOT NULL,
    score INTEGER NOT NULL DEFAULT 0,
    duration_sec INTEGER NOT NULL DEFAULT 0,
    cleared_count INTEGER NOT NULL DEFAULT 0,
    error_count INTEGER NOT NULL DEFAULT 0,
    is_passed INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS char_mastery (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    char TEXT NOT NULL,
    charset_id TEXT NOT NULL,
    correct_count INTEGER NOT NULL DEFAULT 0,
    error_count INTEGER NOT NULL DEFAULT 0,
    last_practiced_at TEXT,
    UNIQUE(char, charset_id)
);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS achievements (
    code TEXT PRIMARY KEY,
    unlocked_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS checkins (
    date TEXT PRIMARY KEY,
    streak INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_records_time ON practice_records(created_at);
CREATE INDEX IF NOT EXISTS idx_records_mode ON practice_records(mode, charset_id);
CREATE INDEX IF NOT EXISTS idx_mastery_char ON char_mastery(char, charset_id);
";
