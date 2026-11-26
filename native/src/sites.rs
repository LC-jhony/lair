use std::fs;
use std::path::PathBuf;
use std::process::Command;

use rusqlite::params;
use serde::{Deserialize, Serialize};

use crate::{caddy, db};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Site {
  pub id: String,
  pub name: String,
  pub root: String,
  pub kind: String,
  pub domains: Vec<String>,
  pub php_version: Option<String>,
  pub node_version: Option<String>,
  pub tls_internal: bool,
}

pub fn list() -> Result<Vec<Site>, String> {
  let conn = db::open()?;
  let mut stmt = conn
    .prepare(
      "SELECT id, name, root, kind, domains, php_version, node_version, tls_internal FROM sites",
    )
    .map_err(|e| e.to_string())?;
  let rows = stmt
    .query_map([], |row| {
      let domains_json: String = row.get(4)?;
      Ok(Site {
        id: row.get(0)?,
        name: row.get(1)?,
        root: row.get(2)?,
        kind: row.get(3)?,
        domains: serde_json::from_str(&domains_json).unwrap_or_default(),
        php_version: row.get(5)?,
        node_version: row.get(6)?,
        tls_internal: row.get::<_, i32>(7)? != 0,
      })
    })
    .map_err(|e| e.to_string())?;
  rows
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| e.to_string())
}

pub async fn create(args: &str) -> Result<Site, String> {
  let payload: serde_json::Value =
    serde_json::from_str(args).map_err(|e| format!("INVALID_PAYLOAD: {e}"))?;
  let site = Site {
    id: uuid::Uuid::new_v4().to_string(),
    name: payload["name"]
      .as_str()
      .ok_or("name requerido")?
      .to_string(),
    root: payload["root"]
      .as_str()
      .ok_or("root requerido")?
      .to_string(),
    kind: payload["kind"]
      .as_str()
      .ok_or("kind requerido")?
      .to_string(),
    domains: serde_json::from_value(payload["domains"].clone())
      .map_err(|e| format!("INVALID_PAYLOAD: {e}"))?,
    php_version: payload["phpVersion"].as_str().map(String::from),
    node_version: payload["nodeVersion"].as_str().map(String::from),
    tls_internal: payload["tlsInternal"].as_bool().unwrap_or(true),
  };

  let conn = db::open()?;
  conn
    .execute(
      "INSERT INTO sites (id, name, root, kind, domains, php_version, node_version, tls_internal)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
      params![
        site.id,
        site.name,
        site.root,
        site.kind,
        serde_json::to_string(&site.domains).unwrap_or_default(),
        site.php_version,
        site.node_version,
        site.tls_internal as i32,
      ],
    )
    .map_err(|e| format!("DB_ERROR: {e}"))?;

  let upstream = match site.kind.as_str() {
    "php" => format!(
      "unix//run/php/php{}-fpm.sock",
      site.php_version.as_deref().unwrap_or("8.3")
    ),
    "node" => "127.0.0.1:3000".to_string(),
    _ => String::new(),
  };
  let caddyfile = caddy::generate_caddyfile(
    &site
      .domains
      .first()
      .cloned()
      .unwrap_or_else(|| format!("{}.test", site.name)),
    &site.root,
    &site.kind,
    &upstream,
    site.tls_internal,
  );
  caddy::reload(&caddyfile).await?;

  Ok(site)
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ParkedProject {
  pub name: String,
  pub root: String,
  pub domain: String,
  pub kind: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorktreeInfo {
  pub path: String,
  pub branch: String,
  pub name: String,
}

fn parked_roots() -> Result<Vec<String>, String> {
  let raw = db::get_state("parked_roots")?;
  match raw.and_then(|value| serde_json::from_str::<Vec<String>>(&value).ok()) {
    Some(roots) if !roots.is_empty() => Ok(roots),
    _ => Ok(vec![dirs::home_dir()
      .unwrap_or_default()
      .join("Lair")
      .to_string_lossy()
      .to_string()]),
  }
}

pub fn list_parked() -> Result<Vec<ParkedProject>, String> {
  let linked: Vec<Site> = list()?;
  let mut found = Vec::new();
  for root in parked_roots()? {
    let entries = match fs::read_dir(&root) {
      Ok(entries) => entries,
      Err(_) => continue,
    };
    for entry in entries.flatten() {
      let path = entry.path();
      if !path.is_dir()
        || linked
          .iter()
          .any(|site| site.root == path.to_string_lossy())
      {
        continue;
      }
      let project = path.join("composer.json").exists()
        || path.join("package.json").exists()
        || path.join("public").join("index.php").exists()
        || path.join(".git").exists();
      if !project {
        continue;
      }
      let name = entry.file_name().to_string_lossy().to_string();
      let domain = format!(
        "{}.test",
        name
          .to_lowercase()
          .replace(|c: char| !c.is_ascii_alphanumeric(), "-")
      );
      let kind = if path.join("package.json").exists() {
        "node"
      } else {
        "php"
      };
      found.push(ParkedProject {
        name,
        root: path.to_string_lossy().to_string(),
        domain,
        kind: kind.to_string(),
      });
    }
  }
  Ok(found)
}

pub fn park_folder(root: &str) -> Result<(), String> {
  let mut roots = parked_roots()?;
  if !roots.iter().any(|item| item == root) {
    roots.push(root.to_string());
  }
  db::set_state(
    "parked_roots",
    &serde_json::to_string(&roots).unwrap_or_default(),
  )
}

pub fn unpark_folder(root: &str) -> Result<(), String> {
  let roots: Vec<String> = parked_roots()?
    .into_iter()
    .filter(|item| item != root)
    .collect();
  db::set_state(
    "parked_roots",
    &serde_json::to_string(&roots).unwrap_or_default(),
  )
}

pub fn update(args: &str) -> Result<serde_json::Value, String> {
  let payload: serde_json::Value =
    serde_json::from_str(args).map_err(|e| format!("INVALID_PAYLOAD: {e}"))?;
  let id = payload["id"].as_str().ok_or("INVALID_PAYLOAD: id")?;
  let conn = db::open()?;
  for (column, key) in [
    ("tls_internal", "tlsInternal"),
    ("php_version", "phpVersion"),
    ("node_version", "nodeVersion"),
    ("root", "root"),
  ] {
    if let Some(value) = payload[key].as_str() {
      conn
        .execute(
          &format!("UPDATE sites SET {column} = ?1 WHERE id = ?2"),
          params![value, id],
        )
        .map_err(|e| format!("DB_ERROR: {e}"))?;
    }
  }
  if let Some(domains) = payload["domains"].as_array() {
    let json = serde_json::to_string(domains).unwrap_or_default();
    conn
      .execute(
        "UPDATE sites SET domains = ?1 WHERE id = ?2",
        params![json, id],
      )
      .map_err(|e| format!("DB_ERROR: {e}"))?;
  }
  Ok(serde_json::json!({ "ok": true }))
}

pub fn open_in_editor(root: &str) -> Result<serde_json::Value, String> {
  let url = format!("vscode://file/{root}");
  let status = if cfg!(target_os = "windows") {
    Command::new("cmd").args(["/c", "start", &url]).status()
  } else if cfg!(target_os = "macos") {
    Command::new("open").arg(&url).status()
  } else {
    Command::new("xdg-open").arg(&url).status()
  };
  match status {
    Ok(_) => Ok(serde_json::json!({ "ok": true })),
    Err(error) => Err(format!("OPEN_FAILED: {error}")),
  }
}

pub fn open_terminal(root: &str) -> Result<serde_json::Value, String> {
  let status = if cfg!(target_os = "windows") {
    Command::new("cmd")
      .args(["/c", "start", "cmd", "/K", &format!("cd /d \"{root}\"")])
      .status()
  } else if cfg!(target_os = "macos") {
    Command::new("open").args(["-a", "Terminal", root]).status()
  } else {
    Command::new("gnome-terminal")
      .args(["--working-directory", root])
      .status()
  };
  match status {
    Ok(_) => Ok(serde_json::json!({ "ok": true })),
    Err(error) => Err(format!("OPEN_FAILED: {error}")),
  }
}

pub fn list_worktrees(root: &str) -> Result<Vec<WorktreeInfo>, String> {
  let output = Command::new("git")
    .args(["-C", root, "worktree", "list", "--porcelain"])
    .output()
    .map_err(|e| format!("GIT_ERROR: {e}"))?;
  let text = String::from_utf8_lossy(&output.stdout);
  let mut rows = Vec::new();
  for block in text.split("\n\n") {
    let path = block
      .lines()
      .find_map(|line| line.strip_prefix("worktree "))
      .unwrap_or_default()
      .to_string();
    let branch = block
      .lines()
      .find_map(|line| line.strip_prefix("branch refs/heads/"))
      .unwrap_or_default()
      .to_string();
    if path.is_empty() {
      continue;
    }
    let name = PathBuf::from(&path)
      .file_name()
      .unwrap_or_default()
      .to_string_lossy()
      .to_string();
    rows.push(WorktreeInfo { path, branch, name });
  }
  Ok(rows)
}

pub fn add_worktree(args: &str) -> Result<serde_json::Value, String> {
  let payload: serde_json::Value =
    serde_json::from_str(args).map_err(|e| format!("INVALID_PAYLOAD: {e}"))?;
  let root = payload["root"].as_str().ok_or("INVALID_PAYLOAD: root")?;
  let branch = payload["branch"]
    .as_str()
    .unwrap_or("feature")
    .to_lowercase();
  let branch = branch.replace(|c: char| !c.is_ascii_alphanumeric(), "-");
  let path = payload["path"]
    .as_str()
    .map(str::to_string)
    .unwrap_or_else(|| {
      PathBuf::from(root)
        .parent()
        .unwrap_or_else(|| std::path::Path::new("."))
        .join(format!(
          "{}-{}",
          PathBuf::from(root)
            .file_name()
            .unwrap_or_default()
            .to_string_lossy(),
          branch
        ))
        .to_string_lossy()
        .to_string()
    });
  let status = Command::new("git")
    .args(["-C", root, "worktree", "add", "-b", &branch, &path])
    .status()
    .map_err(|e| format!("GIT_ERROR: {e}"))?;
  if !status.success() {
    return Err("GIT_ERROR: no se pudo crear el worktree".to_string());
  }
  Ok(serde_json::json!({ "path": path, "branch": branch }))
}

pub fn remove_worktree(args: &str) -> Result<serde_json::Value, String> {
  let payload: serde_json::Value =
    serde_json::from_str(args).map_err(|e| format!("INVALID_PAYLOAD: {e}"))?;
  let root = payload["root"].as_str().ok_or("INVALID_PAYLOAD: root")?;
  let path = payload["path"].as_str().ok_or("INVALID_PAYLOAD: path")?;
  let status = Command::new("git")
    .args(["-C", root, "worktree", "remove", path])
    .status()
    .map_err(|e| format!("GIT_ERROR: {e}"))?;
  if !status.success() {
    return Err("GIT_ERROR: no se pudo eliminar el worktree".to_string());
  }
  Ok(serde_json::json!({ "ok": true }))
}

pub fn delete(id: &str) -> Result<(), String> {
  let conn = db::open()?;
  let changed = conn
    .execute("DELETE FROM sites WHERE id = ?1", params![id])
    .map_err(|e| format!("DB_ERROR: {e}"))?;
  if changed == 0 {
    return Err("NOT_FOUND".to_string());
  }
  Ok(())
}
