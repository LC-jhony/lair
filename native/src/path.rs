use std::fs;
use std::path::PathBuf;

use serde_json::{json, Value};

use crate::platform;

const MARKER: &str = "# Lair (added by Lair install)";

fn home() -> Result<PathBuf, String> {
  dirs::home_dir().ok_or_else(|| "No se pudo resolver HOME".to_string())
}

fn profiles() -> Result<Vec<PathBuf>, String> {
  let home = home()?;
  let mut result = vec![home.join(".bashrc")];
  let zshrc = home.join(".zshrc");
  if zshrc.exists() {
    result.push(zshrc);
  }
  Ok(result)
}

fn path_contains(dir: &str) -> bool {
  std::env::var_os("PATH")
    .map(|value| std::env::split_paths(&value).any(|entry| entry.to_string_lossy() == dir))
    .unwrap_or(false)
}

pub fn status() -> Result<Value, String> {
  let dir = platform::shim_dir()?;
  let marked: Vec<String> = profiles()?
    .into_iter()
    .filter(|path| {
      fs::read_to_string(path)
        .map(|text| text.contains(MARKER))
        .unwrap_or(false)
    })
    .map(|path| path.to_string_lossy().to_string())
    .collect();
  let displayed = dir.to_string_lossy().to_string();
  Ok(json!({
    "dir": displayed,
    "inEnv": path_contains(&displayed),
    "profiles": marked,
    "ok": path_contains(&displayed) || !marked.is_empty(),
  }))
}

fn set_marked_block(path: &PathBuf, lines: &[&str]) -> Result<(), String> {
  let existing = fs::read_to_string(path).unwrap_or_default();
  let mut collected: Vec<String> = existing.lines().map(str::to_string).collect();
  if let Some(index) = collected.iter().position(|line| line == MARKER) {
    collected.truncate(index);
  }
  collected.push(MARKER.to_string());
  for line in lines {
    collected.push((*line).to_string());
  }
  fs::write(path, format!("{}\n", collected.join("\n"))).map_err(|e| e.to_string())
}

pub fn ensure() -> Result<Value, String> {
  let dir = platform::shim_dir()?;
  fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
  let displayed = dir.to_string_lossy();
  let line = format!("if [ -d \"{displayed}\" ]; then export PATH=\"{displayed}:$PATH\"; fi");
  for profile in profiles()? {
    set_marked_block(&profile, &[&line])?;
  }
  let fish = home()?
    .join(".config")
    .join("fish")
    .join("conf.d")
    .join("lair.fish");
  if fish.parent().is_some_and(|parent| parent.exists()) {
    set_marked_block(
      &fish,
      &[
        &format!("if test -d \"{displayed}\""),
        &format!("    set -gx PATH \"{displayed}\" $PATH"),
        "end",
      ],
    )?;
  }
  let environment = home()?.join(".config").join("environment.d");
  fs::create_dir_all(&environment).map_err(|e| e.to_string())?;
  set_marked_block(
    &environment.join("lair.conf"),
    &[&format!("PATH={displayed}:${{PATH}}")],
  )?;
  status()
}

pub fn remove() -> Result<Value, String> {
  let mut files = profiles()?;
  files.push(home()?.join(".config/fish/conf.d/lair.fish"));
  files.push(home()?.join(".config/environment.d/lair.conf"));
  for path in files {
    if !path.exists() {
      continue;
    }
    let lines: Vec<String> = fs::read_to_string(&path)
      .unwrap_or_default()
      .lines()
      .map(str::to_string)
      .collect();
    if let Some(index) = lines.iter().position(|line| line == MARKER) {
      let kept: Vec<String> = lines[..index].to_vec();
      fs::write(&path, format!("{}\n", kept.join("\n"))).map_err(|e| e.to_string())?;
    }
  }
  status()
}
