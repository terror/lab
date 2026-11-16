#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{WebviewUrl, WebviewWindowBuilder, webview::NewWindowResponse};

fn main() {
  tauri::Builder::default()
    .setup(|app| {
      WebviewWindowBuilder::new(app, "main", WebviewUrl::default())
        .title("lab")
        .inner_size(1280.0, 800.0)
        .min_inner_size(640.0, 480.0)
        .on_new_window(|url, _features| {
          if let Err(error) = tauri_plugin_opener::open_url(&url, None::<&str>) {
            eprintln!("error: failed to open `{url}`: {error}");
          }

          NewWindowResponse::Deny
        })
        .build()?;

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error: failed to run lab");
}
