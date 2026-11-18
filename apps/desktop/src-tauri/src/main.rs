#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{Url, WebviewUrl, WebviewWindowBuilder, webview::NewWindowResponse};

fn external(url: &Url) -> bool {
  matches!(url.scheme(), "http" | "https" | "mailto")
}

fn main() {
  tauri::Builder::default()
    .setup(|app| {
      WebviewWindowBuilder::new(app, "main", WebviewUrl::default())
        .title("lab")
        .inner_size(1280.0, 800.0)
        .min_inner_size(640.0, 480.0)
        .on_new_window(|url, _features| {
          if !external(&url) {
            eprintln!("error: refusing to open `{url}`");
          } else if let Err(error) = tauri_plugin_opener::open_url(&url, None::<&str>) {
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

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn external_schemes() {
    #[track_caller]
    fn case(url: &str, expected: bool) {
      assert_eq!(external(&url.parse::<Url>().unwrap()), expected);
    }

    case("http://foo", true);
    case("https://foo", true);
    case("mailto:foo@bar", true);
    case("file:///foo", false);
    case("smb://foo/bar", false);
    case("vscode://foo", false);
  }
}
