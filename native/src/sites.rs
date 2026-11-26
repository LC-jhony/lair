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
