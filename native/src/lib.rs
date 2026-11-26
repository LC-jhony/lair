#![deny(clippy::all)]

mod binaries;
mod caddy;
mod crypto;
mod db;
mod manifest;
mod platform;
mod sites;

use napi_derive::napi;
use serde::Serialize;
use serde_json::{json, Value};

struct BackendError {
  code: &'static str,
  message: String,
}

fn known_code(default: &'static str, message: &str) -> &'static str {
  const CODES: [&str; 12] = [
    "SIGNATURE_INVALID",
    "SHA256_MISMATCH",
    "EXTRACT_FAILED",
    "MANIFEST_UNAVAILABLE",
    "HTTP_ERROR",
    "DB_ERROR",
    "NOT_FOUND",
    "INVALID_PAYLOAD",
    "ADAPT_FAILED",
    "VALIDATE_FAILED",
    "RELOAD_FAILED",
    "TRUST_FAILED",
  ];
  CODES
    .iter()
    .find(|code| message.contains(**code))
    .copied()
    .unwrap_or(default)
}

fn wrap<T: Serialize>(
  result: Result<T, String>,
  default_code: &'static str,
) -> Result<Value, BackendError> {
  result
    .map(|value| serde_json::to_value(value).unwrap_or(Value::Null))
    .map_err(|message| BackendError {
      code: known_code(default_code, &message),
      message,
    })
}

fn flag(key: &str) -> Result<bool, String> {
  Ok(db::get_state(key)?.as_deref() == Some("true"))
}

fn onboarding() -> Result<Value, String> {
  Ok(json!({
      "caddyInstalled": flag("caddy_installed")?,
      "binariesInstalled": flag("binaries_installed")?,
      "caTrusted": flag("ca_trusted")?,
      "completedAt": db::get_state("onboarding_completed_at")?,
  }))
}

async fn dispatch(cmd: &str, args: &str) -> Result<Value, BackendError> {
  if cmd == "fetch_manifest" {
    return manifest::fetch_and_verify()
      .await
      .map(|manifest| serde_json::to_value(manifest).unwrap_or(Value::Null))
      .map_err(|message| BackendError {
        code: known_code("HTTP_ERROR", &message),
        message,
      });
  }

  if cmd == "install_binary" {
    if manifest::load_cached().is_err() {
      manifest::fetch_and_verify()
        .await
        .map_err(|message| BackendError {
          code: known_code("MANIFEST_UNAVAILABLE", &message),
          message,
        })?;
    }
    return binaries::install(args)
      .await
      .map_err(|message| BackendError {
        code: known_code("EXTRACT_FAILED", &message),
        message,
      });
  }

  if cmd == "install_composer" {
    return binaries::install_composer()
      .await
      .map_err(|message| BackendError {
        code: known_code("SHA256_MISMATCH", &message),
        message,
      });
  }

  let payload: Value = serde_json::from_str(args).unwrap_or_else(|_| json!({}));

  match cmd {
    "list_sites" => wrap(sites::list(), "DB_ERROR"),
    "create_site" => {
      let result = sites::create(args).await.map_err(|message| BackendError {
        code: known_code("DB_ERROR", &message),
        message,
      })?;
      Ok(serde_json::to_value(result).unwrap_or(Value::Null))
    }
    "delete_site" => {
      let id = payload["id"].as_str().ok_or(BackendError {
        code: "INVALID_PAYLOAD",
        message: "id requerido".to_string(),
      })?;
      wrap(sites::delete(id), "DB_ERROR").map(|_| json!({ "ok": true }))
    }
    "list_binaries" => wrap(binaries::list(), "DB_ERROR"),
    "list_versions" => {
      if manifest::load_cached().is_err() {
        manifest::fetch_and_verify()
          .await
          .map_err(|message| BackendError {
            code: known_code("MANIFEST_UNAVAILABLE", &message),
            message,
          })?;
      }
      wrap(binaries::versions(args), "MANIFEST_UNAVAILABLE")
    }
    "set_default_binary" => wrap(binaries::set_default(args), "DB_ERROR"),
    "uninstall_binary" => wrap(binaries::uninstall(args), "DB_ERROR"),
    "caddy_adapt" => {
      let config = payload["config"].as_str().unwrap_or_default();
      wrap(caddy::adapt(config).await, "ADAPT_FAILED")
    }
    "caddy_validate" => {
      let config = payload["config"].as_str().unwrap_or_default();
      wrap(caddy::validate(config).await, "VALIDATE_FAILED").map(|_| json!({ "ok": true }))
    }
    "caddy_reload" => {
      let config = payload["config"].as_str().unwrap_or_default();
      wrap(caddy::reload(config).await, "RELOAD_FAILED").map(|_| json!({ "ok": true }))
    }
    "caddy_trust" => wrap(caddy::trust(), "TRUST_FAILED"),
    "caddy_untrust" => wrap(caddy::untrust(), "TRUST_FAILED"),
    "caddy_status" => wrap(caddy::status(), "DB_ERROR"),
    "open_site" => {
      let url = payload["url"].as_str().unwrap_or_default();
      let opener = if cfg!(target_os = "windows") {
        ("cmd", vec!["/c", "start", url])
      } else if cfg!(target_os = "macos") {
        ("open", vec![url])
      } else {
        ("xdg-open", vec![url])
      };
      std::process::Command::new(opener.0)
        .args(opener.1)
        .spawn()
        .map_err(|message| BackendError {
          code: "OPEN_FAILED",
          message: message.to_string(),
        })?;
      Ok(json!({ "ok": true }))
    }
    "tail_logs" => {
      let site_id = payload["siteId"].as_str().unwrap_or_default();
      wrap(caddy::tail_logs(site_id), "DB_ERROR")
    }
    "get_onboarding" => wrap(onboarding(), "DB_ERROR"),
    "complete_onboarding" => {
      let stamp = chrono::Utc::now().to_rfc3339();
      wrap(db::set_state("onboarding_completed_at", &stamp), "DB_ERROR")?;
      wrap(onboarding(), "DB_ERROR")
    }
    "reset_onboarding" => {
      for key in ["caddy_installed", "binaries_installed", "ca_trusted"] {
        wrap(db::set_state(key, "false"), "DB_ERROR")?;
      }
      wrap(db::set_state("onboarding_completed_at", ""), "DB_ERROR")?;
      wrap(onboarding(), "DB_ERROR")
    }
    _ => Err(BackendError {
      code: "UNKNOWN_COMMAND",
      message: format!("Unknown command: {cmd}"),
    }),
  }
}

#[napi]
pub struct Backend;

#[napi]
impl Backend {
  #[napi(constructor)]
  pub fn new() -> Self {
    Backend
  }

  /// Single entry point of the `flock:invoke` protocol.
  /// Returns a JSON envelope: `{ ok: true, data }` or `{ ok: false, error }`.
  #[napi]
  pub async fn invoke(&self, cmd: String, args: String) -> String {
    match dispatch(&cmd, &args).await {
      Ok(data) => json!({ "ok": true, "data": data }).to_string(),
      Err(error) => json!({
          "ok": false,
          "error": { "code": error.code, "message": error.message }
      })
      .to_string(),
    }
  }
}

#[napi]
pub fn plus_100(input: u32) -> u32 {
  input + 100
}
