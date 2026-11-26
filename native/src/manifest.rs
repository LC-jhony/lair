use std::collections::HashMap;
use std::path::PathBuf;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::{crypto::verify_manifest_signature, platform::cache_dir};

const MANIFEST_URL: &str =
  "https://github.com/flock-php/binaries/releases/download/manifest/manifest.json";
const SIGNATURE_URL: &str =
  "https://github.com/flock-php/binaries/releases/download/manifest/manifest.json.sig";
pub const CHANNEL: &str = "stable";

/// Esquema publicado por `flock-php/binaries`: `packages.<pkg>.<version>.<platform>`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Manifest {
  pub schema: u32,
  pub channel: String,
  pub serial: u64,
  pub generated: String,
  #[serde(default)]
  pub expires: Option<String>,
  pub packages: HashMap<String, HashMap<String, HashMap<String, PlatformArtifact>>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlatformArtifact {
  pub build: u32,
  pub url: String,
  pub sha256: String,
  pub size: u64,
  pub published: String,
  #[serde(default)]
  pub prerelease: bool,
  #[serde(default)]
  pub lts: bool,
  #[serde(default)]
  pub yanked: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PackageVersion {
  pub package: String,
  pub version: String,
  pub build: u32,
  pub published: String,
  pub lts: bool,
  pub prerelease: bool,
  pub yanked: bool,
}

fn cache_path() -> Result<PathBuf, String> {
  Ok(cache_dir()?.join("binaries"))
}

fn serial_path() -> Result<PathBuf, String> {
  Ok(cache_path()?.join(format!("{CHANNEL}.serial")))
}

/// Último manifiesto válido guardado en disco. Se conserva si una descarga falla validación.
pub fn load_cached() -> Result<Manifest, String> {
  let raw = std::fs::read_to_string(cache_path()?.join("manifest.json"))
    .map_err(|e| format!("MANIFEST_UNAVAILABLE: {e}"))?;
  serde_json::from_str(&raw).map_err(|e| format!("JSON inválido: {e}"))
}

fn validate(manifest: &Manifest) -> Result<(), String> {
  if manifest.schema != 1 {
    return Err(format!("SIGNATURE_INVALID: esquema {}", manifest.schema));
  }
  if manifest.channel != CHANNEL {
    return Err(format!(
      "SIGNATURE_INVALID: esperado canal {CHANNEL}, recibido {}",
      manifest.channel
    ));
  }
  if let Some(expires) = &manifest.expires {
    let expired = DateTime::parse_from_rfc3339(expires)
      .map(|date| date.with_timezone(&Utc) < Utc::now())
      .unwrap_or(false);
    if expired {
      return Err(format!("MANIFEST_EXPIRED: {expires}"));
    }
  }
  let previous = std::fs::read_to_string(serial_path().unwrap_or_default())
    .ok()
    .and_then(|raw| raw.trim().parse::<u64>().ok());
  if let Some(previous) = previous {
    if manifest.serial < previous {
      return Err(format!("SERIAL_STALE: {} < {previous}", manifest.serial));
    }
  }
  Ok(())
}

pub async fn fetch_and_verify() -> Result<Manifest, String> {
  let client = reqwest::Client::builder()
    .user_agent("lair-rs/0.1")
    .build()
    .map_err(|e| e.to_string())?;

  let manifest_bytes = client
    .get(MANIFEST_URL)
    .send()
    .await
    .map_err(|e| format!("HTTP_ERROR: {e}"))?
    .bytes()
    .await
    .map_err(|e| e.to_string())?;

  let signature_b64 = client
    .get(SIGNATURE_URL)
    .send()
    .await
    .map_err(|e| format!("HTTP_ERROR: {e}"))?
    .text()
    .await
    .map_err(|e| e.to_string())?;

  verify_manifest_signature(&manifest_bytes, &signature_b64)
    .map_err(|e| format!("SIGNATURE_INVALID: {e}"))?;

  let manifest: Manifest =
    serde_json::from_slice(&manifest_bytes).map_err(|e| format!("JSON inválido: {e}"))?;
  validate(&manifest)?;

  let cache = cache_path()?;
  std::fs::create_dir_all(&cache).map_err(|e| e.to_string())?;
  std::fs::write(cache.join("manifest.json"), &manifest_bytes).map_err(|e| e.to_string())?;
  std::fs::write(cache.join("manifest.json.sig"), signature_b64.trim())
    .map_err(|e| e.to_string())?;
  std::fs::write(serial_path()?, manifest.serial.to_string()).map_err(|e| e.to_string())?;

  Ok(manifest)
}

/// Versiones publicadas para un paquete y plataforma, ordenadas por publicación (recientes primero).
pub fn list_versions(package: Option<&str>, platform: &str) -> Result<Vec<PackageVersion>, String> {
  let manifest = load_cached()?;
  let mut rows = Vec::new();
  for (pkg, versions) in &manifest.packages {
    if let Some(wanted) = package {
      if wanted != pkg.as_str() {
        continue;
      }
    }
    for (version, platforms) in versions {
      if let Some(artifact) = platforms.get(platform) {
        rows.push(PackageVersion {
          package: pkg.clone(),
          version: version.clone(),
          build: artifact.build,
          published: artifact.published.clone(),
          lts: artifact.lts,
          prerelease: artifact.prerelease,
          yanked: !artifact.yanked.is_empty(),
        });
      }
    }
  }
  rows.sort_by(|a, b| {
    b.published
      .cmp(&a.published)
      .then_with(|| b.version.cmp(&a.version))
  });
  Ok(rows)
}

/// Artefacto instalable: las builds yanked se rechazan salvo que sea la única disponible.
pub fn find_artifact(
  package: &str,
  version: &str,
  platform: &str,
) -> Result<PlatformArtifact, String> {
  let manifest = load_cached()?;
  let artifact = manifest
    .packages
    .get(package)
    .and_then(|versions| versions.get(version))
    .and_then(|platforms| platforms.get(platform))
    .ok_or_else(|| format!("MANIFEST_UNAVAILABLE: {package} {version} {platform}"))?;

  if !artifact.yanked.is_empty() {
    return Err(format!(
      "YANKED: {package} {version} build {}: {}",
      artifact.build,
      artifact.yanked.values().next().cloned().unwrap_or_default()
    ));
  }
  Ok(artifact.clone())
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn parses_published_schema() {
    let raw = r#"{
      "schema": 1, "channel": "stable", "serial": 1,
      "generated": "2026-01-01T00:00:00Z",
      "packages": {"php": {"8.5.13": {"linux-x64": {
        "build": 1, "url": "https://example.invalid/php.tgz", "sha256": "abc",
        "size": 1, "published": "2026-01-01T00:00:00Z", "lts": false, "prerelease": false
      }}}}
    }"#;
    let manifest: Manifest = serde_json::from_str(raw).expect("manifest válido");
    let artifact = &manifest.packages["php"]["8.5.13"]["linux-x64"];
    assert_eq!(artifact.sha256, "abc");
    assert!(!artifact.prerelease);
  }
}
