use std::fs;
use std::io::Cursor;
use std::path::{Path, PathBuf};
use std::process::Command;

use rusqlite::params;
use serde::{Deserialize, Serialize};
use serde_json::json;

use crate::{
  crypto::sha256_hex,
  db,
  manifest::{find_artifact, list_versions as manifest_versions, PlatformArtifact},
  platform,
};

#[derive(Debug, Serialize)]
pub struct InstallResult {
  pub path: PathBuf,
  pub sha256: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BinaryVersion {
  pub package: String,
  pub version: String,
  pub installed: bool,
  pub is_default: bool,
  pub platform: String,
  pub path: String,
  pub sha256: String,
}

#[derive(Debug, Deserialize)]
pub struct InstallArgs {
  pub package: String,
  pub version: String,
  pub platform: String,
}

#[derive(Debug, Deserialize)]
pub struct DefaultArgs {
  pub package: String,
  pub version: String,
  pub platform: String,
}

pub fn list() -> Result<Vec<BinaryVersion>, String> {
  let conn = db::open()?;
  let mut stmt = conn
    .prepare("SELECT package, version, platform, sha256, path, is_default FROM installed_binaries")
    .map_err(|e| e.to_string())?;
  let rows = stmt
    .query_map([], |row| {
      Ok(BinaryVersion {
        package: row.get(0)?,
        version: row.get(1)?,
        platform: row.get(2)?,
        sha256: row.get(3)?,
        path: row.get(4)?,
        installed: true,
        is_default: row.get::<_, i32>(5)? != 0,
      })
    })
    .map_err(|e| e.to_string())?;
  rows
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| e.to_string())
}

fn shim_name(package: &str) -> &str {
  match package {
    "postgres" => "psql",
    "composer" => "composer",
    "valkey" => "valkey-server",
    "redis" => "redis-server",
    "mongodb" => "mongod",
    other => other,
  }
}

pub fn verify() -> Result<serde_json::Value, String> {
  let results: Vec<serde_json::Value> = list()?
    .into_iter()
    .filter(|item| item.installed)
    .map(|item| {
      let name = shim_name(&item.package);
      let shim = platform::shim_dir()
        .unwrap_or_default()
        .join(if cfg!(windows) { format!("{name}.cmd") } else { name.to_string() });
      let output = Command::new(&shim).arg("--version").output();
      match output {
        Ok(result) if result.status.success() => serde_json::json!({
          "package": item.package,
          "ok": true,
          "version": String::from_utf8_lossy(&result.stdout).trim().lines().next().unwrap_or("").to_string(),
        }),
        _ => serde_json::json!({ "package": item.package, "ok": false, "version": null }),
      }
    })
    .collect();
  Ok(serde_json::json!({ "results": results }))
}

pub fn versions(args_json: &str) -> Result<Vec<crate::manifest::PackageVersion>, String> {
  let payload: serde_json::Value =
    serde_json::from_str(args_json).map_err(|e| format!("INVALID_PAYLOAD: {e}"))?;
  let package = payload["package"].as_str();
  manifest_versions(package, platform::platform_key())
}

/// Los mirrors de upstream traen una carpeta raíz; la quitamos para que el layout sea predecible.
fn strip_single_root(root: &Path) -> Result<(), String> {
  let entries: Vec<_> = fs::read_dir(root)
    .map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| e.to_string())?;
  if entries.len() != 1 || !entries[0].path().is_dir() {
    return Ok(());
  }
  let inner = entries[0].path();
  let name = root
    .file_name()
    .unwrap_or_default()
    .to_string_lossy()
    .to_string();
  let temporary = root.with_file_name(format!("{name}.unwrap"));
  if temporary.exists() {
    fs::remove_dir_all(&temporary).map_err(|e| e.to_string())?;
  }
  fs::rename(&inner, &temporary).map_err(|e| e.to_string())?;
  fs::remove_dir(root).map_err(|e| e.to_string())?;
  fs::rename(&temporary, root).map_err(|e| e.to_string())?;
  Ok(())
}

fn find_file(root: &Path, names: &[&str]) -> Option<PathBuf> {
  if !root.is_dir() {
    return None;
  }
  for entry in fs::read_dir(root).ok()?.flatten() {
    let path = entry.path();
    if path.is_file()
      && path
        .file_name()
        .and_then(|name| name.to_str())
        .is_some_and(|name| names.contains(&name))
    {
      return Some(path);
    }
    if path.is_dir() {
      if let Some(found) = find_file(&path, names) {
        return Some(found);
      }
    }
  }
  None
}

fn binary_names<'a>(package: &'a str) -> Vec<&'a str> {
  match package {
    "php" => vec!["php", "php.exe"],
    "php-fpm" => vec!["php-fpm", "php-fpm.exe"],
    "frankenphp" => vec!["frankenphp", "frankenphp.exe"],
    "node" => vec!["node", "node.exe"],
    "npm" => vec!["npm", "npm.cmd"],
    "npx" => vec!["npx", "npx.cmd"],
    "composer" => vec!["composer.phar", "composer"],
    "postgres" => vec!["psql", "psql.exe"],
    "mariadb" => vec!["mariadb", "mariadb.exe"],
    "mysql" => vec!["mysql", "mysql.exe"],
    "mongodb" => vec!["mongod", "mongod.exe"],
    "valkey" => vec!["valkey-server", "valkey-server.exe"],
    "redis" => vec!["redis-server", "redis-server.exe"],
    "meilisearch" => vec!["meilisearch", "meilisearch.exe"],
    "typesense" => vec!["typesense-server", "typesense-server.exe"],
    "rustfs" => vec!["rustfs", "rustfs.exe"],
    "cloudflared" => vec!["cloudflared", "cloudflared.exe"],
    _ => vec![package],
  }
}

fn write_shim(package: &str, binary_path: &Path) -> Result<(), String> {
  let dir = platform::shim_dir()?;
  fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
  let target = binary_path.to_string_lossy();

  #[cfg(windows)]
  {
    let shim = dir.join(format!("{package}.cmd"));
    let mut file = fs::File::create(shim).map_err(|e| e.to_string())?;
    use std::io::Write;
    writeln!(file, "@echo off\n\"{target}\" %*").map_err(|e| e.to_string())?;
  }
  #[cfg(not(windows))]
  {
    let shim = dir.join(package);
    let mut file = fs::File::create(&shim).map_err(|e| e.to_string())?;
    use std::io::Write;
    let dir_display = dir.to_string_lossy();
    let body = if package == "composer" {
      format!("#!/bin/sh\nexport PATH=\"{dir_display}:$PATH\"\nexec \"{target}\" \"$@\"")
    } else {
      format!("#!/bin/sh\nexec \"{target}\" \"$@\"")
    };
    writeln!(file, "{body}").map_err(|e| e.to_string())?;
    use std::os::unix::fs::PermissionsExt;
    fs::set_permissions(&shim, fs::Permissions::from_mode(0o755)).map_err(|e| e.to_string())?;
  }
  Ok(())
}

fn remove_shim(package: &str) -> Result<(), String> {
  let dir = platform::shim_dir()?;
  #[cfg(windows)]
  let shim = dir.join(format!("{package}.cmd"));
  #[cfg(not(windows))]
  let shim = dir.join(package);
  if shim.exists() {
    fs::remove_file(shim).map_err(|e| e.to_string())?;
  }
  Ok(())
}

pub async fn install_artifact(
  pkg: &str,
  version: &str,
  artifact: &PlatformArtifact,
  archive_name: &str,
) -> Result<InstallResult, String> {
  let bytes = reqwest::get(&artifact.url)
    .await
    .map_err(|e| format!("HTTP_ERROR: {e}"))?
    .bytes()
    .await
    .map_err(|e| e.to_string())?;

  let actual = sha256_hex(&bytes);
  if actual != artifact.sha256 {
    return Err(format!(
      "SHA256_MISMATCH: esperado {}, obtenido {}",
      artifact.sha256, actual
    ));
  }

  let root = platform::versions_dir()?.join(pkg).join(version);
  let mut staging = root.clone();
  let staging_name = format!(
    "{}.staging",
    root.file_name().unwrap_or_default().to_string_lossy()
  );
  staging.set_file_name(staging_name);

  if staging.exists() {
    fs::remove_dir_all(&staging).map_err(|e| e.to_string())?;
  }
  fs::create_dir_all(&staging).map_err(|e| e.to_string())?;

  if archive_name.ends_with(".tar.gz") {
    let decoder = flate2::read::GzDecoder::new(Cursor::new(&bytes));
    tar::Archive::new(decoder)
      .unpack(&staging)
      .map_err(|e| format!("EXTRACT_FAILED: {e}"))?;
  } else if archive_name.ends_with(".zip") {
    let mut archive =
      zip::ZipArchive::new(Cursor::new(&bytes)).map_err(|e| format!("EXTRACT_FAILED: {e}"))?;
    archive
      .extract(&staging)
      .map_err(|e| format!("EXTRACT_FAILED: {e}"))?;
  } else {
    return Err(format!("Formato no soportado: {archive_name}"));
  }
  strip_single_root(&staging)?;

  if root.exists() {
    fs::remove_dir_all(&root).map_err(|e| e.to_string())?;
  }
  fs::rename(&staging, &root).map_err(|e| e.to_string())?;

  Ok(InstallResult {
    path: root,
    sha256: actual,
  })
}

fn record_installed(
  package: &str,
  version: &str,
  platform_key: &str,
  sha256: &str,
  path: &Path,
) -> Result<(), String> {
  let conn = db::open()?;
  let default: i32 = conn
    .query_row(
      "SELECT COUNT(*) FROM installed_binaries WHERE package = ?1",
      params![package],
      |row| row.get(0),
    )
    .unwrap_or(0);
  conn
    .execute(
      "INSERT INTO installed_binaries (package, version, platform, sha256, path, is_default)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)
         ON CONFLICT(package, version, platform) DO UPDATE SET
             sha256 = excluded.sha256, path = excluded.path, is_default = excluded.is_default",
      params![
        package,
        version,
        platform_key,
        sha256,
        path.to_string_lossy(),
        if default == 0 { 1 } else { 0 },
      ],
    )
    .map_err(|e| e.to_string())?;
  Ok(())
}

pub async fn install(args_json: &str) -> Result<serde_json::Value, String> {
  let args: InstallArgs =
    serde_json::from_str(args_json).map_err(|e| format!("INVALID_PAYLOAD: {e}"))?;
  let artifact = find_artifact(&args.package, &args.version, &args.platform)?;
  let archive_name = artifact
    .url
    .rsplit('/')
    .next()
    .unwrap_or("artifact.tar.gz")
    .to_string();
  let result = install_artifact(&args.package, &args.version, &artifact, &archive_name).await?;

  let executable = find_file(&result.path, &binary_names(&args.package)).ok_or_else(|| {
    let _ = fs::remove_dir_all(&result.path);
    format!("EXECUTABLE_NOT_FOUND: {}", args.package)
  })?;
  write_shim(&args.package, &executable)?;
  record_installed(
    &args.package,
    &args.version,
    &args.platform,
    &result.sha256,
    &executable,
  )?;

  Ok(json!({
      "path": executable.to_string_lossy(),
      "sha256": result.sha256,
  }))
}

pub fn set_default(args_json: &str) -> Result<serde_json::Value, String> {
  let args: DefaultArgs =
    serde_json::from_str(args_json).map_err(|e| format!("INVALID_PAYLOAD: {e}"))?;
  let conn = db::open()?;
  let changed = conn
    .execute(
      "UPDATE installed_binaries SET is_default = CASE WHEN version = ?2 AND platform = ?3 THEN 1 ELSE 0 END WHERE package = ?1",
      params![args.package, args.version, args.platform],
    )
    .map_err(|e| e.to_string())?;
  if changed == 0 {
    return Err("NOT_FOUND: versión no instalada".to_string());
  }
  let path: String = conn
    .query_row(
      "SELECT path FROM installed_binaries WHERE package = ?1 AND version = ?2 AND platform = ?3",
      params![args.package, args.version, args.platform],
      |row| row.get(0),
    )
    .map_err(|e| e.to_string())?;
  write_shim(&args.package, Path::new(&path))?;
  Ok(json!({ "ok": true }))
}

pub fn uninstall(args_json: &str) -> Result<serde_json::Value, String> {
  let args: DefaultArgs =
    serde_json::from_str(args_json).map_err(|e| format!("INVALID_PAYLOAD: {e}"))?;
  let conn = db::open()?;
  let was_default: i32 = conn
    .query_row(
      "SELECT is_default FROM installed_binaries WHERE package = ?1 AND version = ?2 AND platform = ?3",
      params![args.package, args.version, args.platform],
      |row| row.get(0),
    )
    .map_err(|_| "NOT_FOUND: versión no instalada".to_string())?;

  let dir = platform::versions_dir()?
    .join(&args.package)
    .join(&args.version);
  if dir.exists() {
    fs::remove_dir_all(&dir).map_err(|e| e.to_string())?;
  }
  conn
    .execute(
      "DELETE FROM installed_binaries WHERE package = ?1 AND version = ?2 AND platform = ?3",
      params![args.package, args.version, args.platform],
    )
    .map_err(|e| e.to_string())?;

  if was_default != 0 {
    let next: Option<(String, String)> = conn
      .query_row(
        "SELECT version, path FROM installed_binaries WHERE package = ?1 ORDER BY version DESC LIMIT 1",
        params![args.package],
        |row| Ok((row.get(0)?, row.get(1)?)),
      )
      .ok();
    if let Some((version, path)) = next {
      conn
        .execute(
          "UPDATE installed_binaries SET is_default = 1 WHERE package = ?1 AND version = ?2",
          params![args.package, version],
        )
        .map_err(|e| e.to_string())?;
      write_shim(&args.package, Path::new(&path))?;
    } else {
      remove_shim(&args.package)?;
    }
  }
  Ok(json!({ "ok": true }))
}

/// Composer no está en el manifiesto de Flock: se descarga de getcomposer.org con su SHA-256.
pub async fn install_composer() -> Result<serde_json::Value, String> {
  let client = reqwest::Client::builder()
    .user_agent("lair-rs/0.1")
    .build()
    .map_err(|e| e.to_string())?;
  let phar = client
    .get("https://getcomposer.org/download/latest-stable/composer.phar")
    .send()
    .await
    .map_err(|e| format!("HTTP_ERROR: {e}"))?
    .bytes()
    .await
    .map_err(|e| e.to_string())?;
  let published = client
    .get("https://getcomposer.org/download/latest-stable/composer.phar.sha256")
    .send()
    .await
    .map_err(|e| format!("HTTP_ERROR: {e}"))?
    .text()
    .await
    .map_err(|e| e.to_string())?;
  let expected: String = published
    .split_whitespace()
    .next()
    .unwrap_or_default()
    .to_ascii_lowercase();
  if expected.len() != 64 {
    return Err("SHA256_MISMATCH: checksum de composer no válido".to_string());
  }
  let actual = sha256_hex(&phar);
  if actual != expected {
    return Err(format!(
      "SHA256_MISMATCH: esperado {expected}, obtenido {actual}"
    ));
  }

  let root = platform::versions_dir()?.join("composer").join("stable");
  fs::create_dir_all(&root).map_err(|e| e.to_string())?;
  let target = root.join("composer.phar");
  fs::write(&target, &phar).map_err(|e| e.to_string())?;
  #[cfg(not(windows))]
  {
    use std::os::unix::fs::PermissionsExt;
    fs::set_permissions(&target, fs::Permissions::from_mode(0o755)).map_err(|e| e.to_string())?;
  }
  write_shim("composer", &target)?;
  record_installed(
    "composer",
    "stable",
    platform::platform_key(),
    &actual,
    &target,
  )?;
  Ok(json!({ "path": target.to_string_lossy(), "sha256": actual }))
}
