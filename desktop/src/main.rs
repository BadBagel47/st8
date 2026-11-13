// st8 desktop app: the web app in a native window, with saves stored as
// files in the app's data folder and native save dialogs.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::io::Write;
use std::path::{Component, Path, PathBuf};
use std::time::Duration;

use tauri::ipc::{InvokeBody, Request, Response};
use tauri::{AppHandle, Manager};
use tauri_plugin_dialog::DialogExt;

/// Folder for saves, states and settings: <app data>/data (same layout as a backup).
fn store_root(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?.join("data");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

/// Resolves a relative store path, refusing anything that could leave the store folder.
fn store_path(app: &AppHandle, rel: &str) -> Result<PathBuf, String> {
    let rel_path = Path::new(rel);
    let ok = !rel.is_empty() && rel_path.components().all(|c| matches!(c, Component::Normal(_)));
    if !ok {
        return Err(format!("invalid store path: {rel}"));
    }
    Ok(store_root(app)?.join(rel_path))
}

fn header(request: &Request<'_>, name: &str) -> Result<String, String> {
    let value = request.headers().get(name).ok_or(format!("missing header {name}"))?;
    let text = value.to_str().map_err(|e| e.to_string())?;
    // Header values are URI-encoded by the page, so any file name survives.
    Ok(percent_decode(text))
}

fn percent_decode(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let Ok(v) = u8::from_str_radix(&s[i + 1..i + 3], 16) {
                out.push(v);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

fn body<'a>(request: &'a Request<'_>) -> Result<&'a [u8], String> {
    match request.body() {
        InvokeBody::Raw(data) => Ok(data),
        _ => Err("expected binary data".into()),
    }
}

/// Reads a store file. A missing file is reported as the error "NOT_FOUND".
#[tauri::command]
fn store_read(app: AppHandle, path: String) -> Result<Response, String> {
    let file = store_path(&app, &path)?;
    match fs::read(&file) {
        Ok(data) => Ok(Response::new(data)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Err("NOT_FOUND".into()),
        Err(e) => Err(e.to_string()),
    }
}

/// Writes atomically: a temporary file next to the target, then a rename.
#[tauri::command]
fn store_write(app: AppHandle, request: Request<'_>) -> Result<(), String> {
    let file = store_path(&app, &header(&request, "path")?)?;
    let data = body(&request)?;
    if let Some(parent) = file.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let tmp = file.with_extension(format!(
        "{}.tmp",
        file.extension().and_then(|e| e.to_str()).unwrap_or("")
    ));
    {
        let mut f = fs::File::create(&tmp).map_err(|e| e.to_string())?;
        f.write_all(data).map_err(|e| e.to_string())?;
        f.sync_all().map_err(|e| e.to_string())?;
    }
    fs::rename(&tmp, &file).map_err(|e| e.to_string())
}

/// Names of the entries in a store folder (empty if it does not exist).
#[tauri::command]
fn store_list(app: AppHandle, path: String) -> Result<Vec<String>, String> {
    let dir = if path.is_empty() { store_root(&app)? } else { store_path(&app, &path)? };
    let entries = match fs::read_dir(&dir) {
        Ok(e) => e,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(vec![]),
        Err(e) => return Err(e.to_string()),
    };
    let mut names: Vec<String> = entries
        .filter_map(|e| e.ok())
        .map(|e| e.file_name().to_string_lossy().into_owned())
        .filter(|n| !n.ends_with(".tmp"))
        .collect();
    names.sort();
    Ok(names)
}

/// Shows a save dialog and writes the file. Returns false if the user cancelled.
#[tauri::command]
async fn save_file(app: AppHandle, request: Request<'_>) -> Result<bool, String> {
    let name = header(&request, "name")?;
    let data = body(&request)?.to_vec();
    let Some(target) = app.dialog().file().set_file_name(&name).blocking_save_file() else {
        return Ok(false);
    };
    let path = target.into_path().map_err(|e| e.to_string())?;
    fs::write(path, data).map_err(|e| e.to_string())?;
    Ok(true)
}

/// Self-test mode (ST8_SELFTEST=1): the page runs its checks and reports here.
#[tauri::command]
fn selftest_enabled() -> bool {
    std::env::var("ST8_SELFTEST").is_ok()
}

#[tauri::command]
fn selftest_report(app: AppHandle, passed: bool, report: String) {
    println!("{report}");
    println!("ST8 SELFTEST {}", if passed { "PASSED" } else { "FAILED" });
    app.exit(if passed { 0 } else { 1 });
}

fn main() {
    if std::env::var("ST8_SELFTEST").is_ok() {
        std::thread::spawn(|| {
            std::thread::sleep(Duration::from_secs(120));
            eprintln!("ST8 SELFTEST TIMED OUT");
            std::process::exit(2);
        });
    }
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            store_read,
            store_write,
            store_list,
            save_file,
            selftest_enabled,
            selftest_report
        ])
        .run(tauri::generate_context!())
        .expect("error while running st8");
}
