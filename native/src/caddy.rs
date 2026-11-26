use std::process::Command;

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

pub async fn validate(caddyfile: &str) -> Result<(), String> {
  adapt(caddyfile).await?;
  let res = reqwest::Client::new()
    .post(format!("{ADMIN}/validate"))
    .header("Content-Type", "text/caddyfile")
    .body(caddyfile.to_string())
    .send()
    .await
    .map_err(|e| e.to_string())?;
  if !res.status().is_success() {
    return Err(format!("VALIDATE_FAILED: {}", res.status()));
  }
  Ok(())
}

pub async fn reload(caddyfile: &str) -> Result<(), String> {
  // 1. Adaptar y validar antes de aplicar
  adapt(caddyfile).await?;

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
  let res = reqwest::Client::new()
    .post(format!("{ADMIN}/load"))
    .header("Content-Type", "text/caddyfile")
    .body(caddyfile.to_string())
    .send()
    .await
    .map_err(|e| e.to_string())?;
  if !res.status().is_success() {
    return Err(format!("RELOAD_FAILED: {}", res.status()));
  }
  std::fs::write(current, caddyfile).map_err(|e| e.to_string())?;
  Ok(())
}

pub fn generate_caddyfile(
  domain: &str,
  root: &str,
  kind: &str,
  upstream: &str,
  tls_internal: bool,
) -> String {
  let mut s = format!("{domain} {{\n");
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

pub fn status() -> Result<Value, String> {
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
  Ok(json!({
      "installed": installed,
      "running": version.is_some(),
      "version": version,
      "configPath": platform::config_dir()?.join("Caddyfile").to_string_lossy(),
  }))
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
