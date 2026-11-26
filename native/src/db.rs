use std::path::PathBuf;

use rusqlite::{params, Connection};

use crate::platform::data_dir;

pub fn database_path() -> Result<PathBuf, String> {
  Ok(data_dir()?.join("flock.sqlite3"))
}

pub fn open() -> Result<Connection, String> {
  let path = database_path()?;
  if let Some(parent) = path.parent() {
    std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
  }
  let conn = Connection::open(&path).map_err(|e| e.to_string())?;
  conn
    .execute_batch(
      r#"
        PRAGMA journal_mode = WAL;
        PRAGMA foreign_keys = ON;
        CREATE TABLE IF NOT EXISTS sites (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            root TEXT NOT NULL,
            kind TEXT CHECK(kind IN ('php','node','static')) NOT NULL,
            domains TEXT NOT NULL,
            php_version TEXT,
            node_version TEXT,
            tls_internal INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS installed_binaries (
            package TEXT NOT NULL,
            version TEXT NOT NULL,
            platform TEXT NOT NULL,
            sha256 TEXT NOT NULL,
            path TEXT NOT NULL,
            is_default INTEGER NOT NULL DEFAULT 0,
            installed_at TEXT NOT NULL DEFAULT (datetime('now')),
            PRIMARY KEY (package, version, platform)
        );
        CREATE TABLE IF NOT EXISTS site_pins (
            site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
            package TEXT NOT NULL,
            version TEXT NOT NULL,
            PRIMARY KEY (site_id, package)
        );
        CREATE TABLE IF NOT EXISTS app_state (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
        "#,
    )
    .map_err(|e| e.to_string())?;
  Ok(conn)
}

pub fn get_state(key: &str) -> Result<Option<String>, String> {
  let conn = open()?;
  let mut stmt = conn
    .prepare("SELECT value FROM app_state WHERE key = ?1")
    .map_err(|e| e.to_string())?;
  let mut rows = stmt.query(params![key]).map_err(|e| e.to_string())?;
  match rows.next().map_err(|e| e.to_string())? {
    Some(row) => Ok(Some(row.get::<_, String>(0).map_err(|e| e.to_string())?)),
    None => Ok(None),
  }
}

pub fn set_state(key: &str, value: &str) -> Result<(), String> {
  let conn = open()?;
  conn
    .execute(
      "INSERT INTO app_state (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      params![key, value],
    )
    .map_err(|e| e.to_string())?;
  Ok(())
}
