use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PracticeRecord {
    pub mode: String,
    pub charset_id: String,
    pub wpm: f64,
    pub accuracy: f64,
    pub score: i64,
    pub duration_sec: i64,
    pub cleared_count: i64,
    pub error_count: i64,
    pub is_passed: bool,
    pub cleared_chars: Vec<String>,
    pub error_chars: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SavedRecord {
    pub id: i64,
    pub mode: String,
    pub charset_id: String,
    pub wpm: f64,
    pub accuracy: f64,
    pub score: i64,
    pub duration_sec: i64,
    pub cleared_count: i64,
    pub error_count: i64,
    pub is_passed: bool,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Overview {
    pub total_duration_sec: i64,
    pub total_cleared: i64,
    pub avg_wpm: f64,
    pub avg_accuracy: f64,
    pub total_sessions: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TrendPoint {
    pub date: String,
    pub wpm: f64,
    pub accuracy: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ErrorChar {
    pub char: String,
    pub charset_id: String,
    pub error_count: i64,
    pub correct_count: i64,
    pub last_practiced_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CharsetMeta {
    pub id: String,
    pub title: String,
    pub word_count: usize,
    pub builtin: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CharsetData {
    pub id: String,
    pub title: String,
    pub words: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Achievement {
    pub code: String,
    pub title: String,
    pub description: String,
    pub unlocked: bool,
    pub unlocked_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CheckinStatus {
    pub today: bool,
    pub streak: i64,
    pub total: i64,
}

pub fn now_iso() -> String {
    chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string()
}

pub fn today_date() -> String {
    chrono::Local::now().format("%Y-%m-%d").to_string()
}
