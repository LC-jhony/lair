use std::process::Command;

use reqwest::Client;
use serde_json::{json, Value};

use crate::{db, platform};

const ADMIN: &str = "http://localhost:2019";

pub async fn adapt(caddyfile: &str) -> Result<Value, String> {
  let res = reqwest::Client::new()
    .post(format!("{ADMIN}/adapt"))
    .header("Content-Type", "text/caddyfile")
    .body(caddyfile.to_string())
    .send()
    .await
    .map_err(|e| e.to_string())?;
  if !res.status().is_success() {
    return Err(format!(
      "ADAPT_FAILED: {}",
      res.text().await.unwrap_or_default()
    ));
  }
  res.json().await.map_err(|e| format!("ADAPT_FAILED: {e}"))
}

/// La API de Caddy no tiene `/validate`: `/adapt` convierte y valida sin aplicar.
/// Devuelve los warnings que emite el adaptador para mostrarlos en la UI.
pub async fn validate(caddyfile: &str) -> Result<Value, String> {
  let adapted = adapt(caddyfile).await?;
  let warnings = adapted
    .get("warnings")
    .cloned()
    .unwrap_or_else(|| json!([]));
  Ok(json!({ "ok": true, "warnings": warnings }))
}

pub async fn reload(caddyfile: &str) -> Result<Value, String> {
  // 1. Adaptar y validar antes de aplicar; conservamos los warnings del adaptador.
  let adapted = adapt(caddyfile).await?;
  let warnings = adapted
    .get("warnings")
    .cloned()
    .unwrap_or_else(|| json!([]));

  // 2. Guardar el Caddyfile anterior para poder revertir
  let config_dir = platform::config_dir()?;
  std::fs::create_dir_all(&config_dir).map_err(|e| e.to_string())?;
  let current = config_dir.join("Caddyfile");
  if current.exists() {
    let stamp = chrono::Utc::now().format("%Y%m%dT%H%M%SZ");
    let backup = config_dir.join(format!("Caddyfile.{stamp}"));
    std::fs::copy(&current, backup).map_err(|e| e.to_string())?;
  }

  // 3. Aplicar atómicamente
  let res = Client::new()
    .post(format!("{ADMIN}/load"))
    .header("Content-Type", "text/caddyfile")
    // Fuerza el reload aunque la config sea idéntica a la activa.
    .header("Cache-Control", "must-revalidate")
    .body(caddyfile.to_string())
    .send()
    .await
    .map_err(|e| e.to_string())?;
  if !res.status().is_success() {
    return Err(format!("RELOAD_FAILED: {}", res.status()));
  }
  std::fs::write(current, caddyfile).map_err(|e| e.to_string())?;
  Ok(json!({ "ok": true, "warnings": warnings }))
}

pub fn generate_caddyfile(
  domain: &str,
  root: &str,
  kind: &str,
  upstream: &str,
  tls_internal: bool,
) -> String {
  // Prefijar `http://` evita que Caddy active HTTPS y redirija automáticamente.
  let address = if tls_internal {
    domain.to_string()
  } else {
    format!("http://{domain}")
  };
  let mut s = format!("{address} {{\n");
  if tls_internal {
    s.push_str("    tls internal\n");
  }
  s.push_str(&format!("    root * {root}\n"));
  s.push_str("    encode gzip zstd\n");
  s.push_str("    @dotfiles path /.*\n    respond @dotfiles 404\n");
  match kind {
    "php" => s.push_str(&format!("    php_fastcgi {upstream}\n    file_server\n")),
    "node" => s.push_str(&format!(
      "    reverse_proxy {upstream} {{\n        header_up X-Forwarded-Proto {{scheme}}\n    }}\n"
    )),
    _ => s.push_str("    try_files {path} {path}/ /index.html\n    file_server\n"),
  }
  s.push_str("}\n");
  s
}

/// `running` se comprueba contra el endpoint de administración, no contra `caddy version`
/// (que solo indica que el binario existe).
pub async fn status() -> Result<Value, String> {
  let version = Command::new("caddy")
    .arg("version")
    .output()
    .ok()
    .filter(|output| output.status.success())
    .and_then(|output| String::from_utf8(output.stdout).ok())
    .and_then(|text| text.split_whitespace().nth(1).map(str::to_string));
  let installed = version.is_some()
    || db::get_state("caddy_installed")?
      .map(|value| value == "true")
      .unwrap_or(false);
  let running = Client::new()
    .get(format!("{ADMIN}/config/"))
    .timeout(std::time::Duration::from_millis(1500))
    .send()
    .await
    .map(|response| response.status().is_success())
    .unwrap_or(false);
  Ok(json!({
      "installed": installed,
      "running": running,
      "version": version,
      "configPath": platform::config_dir()?.join("Caddyfile").to_string_lossy(),
  }))
}

/// Estado de la CA local. El endpoint la crea si no existe aún.
pub async fn ca_status() -> Result<Value, String> {
  let response = Client::new()
    .get(format!("{ADMIN}/pki/ca/local"))
    .timeout(std::time::Duration::from_millis(2500))
    .send()
    .await
    .map_err(|error| format!("CA_UNAVAILABLE: {error}"))?;
  if !response.status().is_success() {
    return Err(format!("CA_UNAVAILABLE: {}", response.status()));
  }
  let info: Value = response
    .json()
    .await
    .map_err(|error| format!("CA_UNAVAILABLE: {error}"))?;
  Ok(json!({
      "available": true,
      "name": info.get("name").cloned().unwrap_or_else(|| json!("Caddy Local Authority")),
      "rootCommonName": info.get("root_common_name").cloned().unwrap_or_else(|| json!("")),
  }))
}

pub fn global_options() -> Result<Value, String> {
  Ok(json!({
    "options": db::get_state("caddy_global_options")?.unwrap_or_default()
  }))
}

pub fn set_global_options(options: &str) -> Result<Value, String> {
  db::set_state("caddy_global_options", options)?;
  Ok(json!({ "ok": true }))
}

pub fn trust() -> Result<Value, String> {
  let detail = match Command::new("caddy").arg("trust").output() {
    Ok(output) if output.status.success() => "CA instalada por caddy trust".to_string(),
    Ok(output) => format!(
      "caddy trust devolvió {}: {}",
      output.status,
      String::from_utf8_lossy(&output.stderr).trim()
    ),
    Err(error) => format!("caddy CLI no disponible ({error}); estado registrado"),
  };
  db::set_state("caddy_installed", "true")?;
  db::set_state("ca_trusted", "true")?;
  Ok(json!({ "ok": true, "detail": detail }))
}

pub fn untrust() -> Result<Value, String> {
  let _ = Command::new("caddy").arg("untrust").output();
  db::set_state("ca_trusted", "false")?;
  Ok(json!({ "ok": true }))
}

pub fn tail_logs(_site_id: &str) -> Result<Value, String> {
  #[cfg(target_os = "linux")]
  let output = Command::new("journalctl")
    .args(["-u", "caddy", "-n", "200", "--no-pager"])
    .output();
  #[cfg(target_os = "macos")]
  let output = Command::new("log")
    .args([
      "show",
      "--last",
      "5m",
      "--predicate",
      "process == \"caddy\"",
    ])
    .output();
  #[cfg(target_os = "windows")]
  let output: Result<std::process::Output, std::io::Error> =
    Err(std::io::Error::other("usar el Visor de eventos"));

  let lines = match output {
    Ok(result) => String::from_utf8_lossy(&result.stdout)
      .lines()
      .map(str::to_string)
      .collect::<Vec<_>>(),
    Err(_) => Vec::new(),
  };
  Ok(json!({ "lines": lines }))
}
