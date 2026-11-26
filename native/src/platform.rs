use std::path::PathBuf;

/// Directorio propio de Lair. No se comparte con Flock para evitar sobrescribir sus datos.
pub fn data_dir() -> Result<PathBuf, String> {
  let base = if cfg!(target_os = "windows") {
    dirs::data_local_dir().ok_or("no LOCALAPPDATA")?
  } else {
    dirs::home_dir()
      .ok_or("no HOME")?
      .join(".local")
      .join("share")
  };
  Ok(base.join("lair"))
}

pub fn cache_dir() -> Result<PathBuf, String> {
  Ok(data_dir()?.join("cache"))
}

pub fn versions_dir() -> Result<PathBuf, String> {
  Ok(data_dir()?.join("versions"))
}

pub fn config_dir() -> Result<PathBuf, String> {
  Ok(data_dir()?.join("config"))
}

pub fn staging_dir() -> Result<PathBuf, String> {
  Ok(data_dir()?.join("staging"))
}

pub fn shim_dir() -> Result<PathBuf, String> {
  Ok(data_dir()?.join("bin"))
}

/// Only four platform keys are published upstream. Intel macOS is not published;
/// map it to the ARM build so the caller gets a clear MANIFEST_UNAVAILABLE if unsupported.
pub fn platform_key() -> &'static str {
  match (
    cfg!(target_os = "windows"),
    cfg!(target_os = "macos"),
    cfg!(target_arch = "aarch64"),
  ) {
    (true, _, _) => "windows-x64",
    (_, true, _) => "macos-arm64",
    (_, _, true) => "linux-arm64",
    _ => "linux-x64",
  }
}
