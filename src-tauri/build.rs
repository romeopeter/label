use std::{env, fs};

/// The name in `.env`, which is gitignored.
const ENV_FILE_KEY: &str = "PIXELBAY_KEY";

/// Finds a `NAME = value` line, with or without spaces or quotes.
fn value_in_env_file(contents: &str, name: &str) -> Option<String> {
    contents.lines().find_map(|line| {
        let (key, value) = line.split_once('=')?;
        if key.trim() != name {
            return None;
        }
        let value = value.trim().trim_matches(['"', '\'']);
        (!value.is_empty()).then(|| value.to_owned())
    })
}

/// Hands the image search key to the Rust build, and only to it: the webview
/// can't read it, and Vite only exposes `VITE_` variables. A build without a key
/// still works, and image search says it isn't available.
fn main() {
    println!("cargo:rerun-if-changed=../.env");
    println!("cargo:rerun-if-env-changed={ENV_FILE_KEY}");

    let key = env::var(ENV_FILE_KEY).ok().or_else(|| {
        let contents = fs::read_to_string("../.env").ok()?;
        value_in_env_file(&contents, ENV_FILE_KEY)
    });
    if let Some(key) = key {
        println!("cargo:rustc-env=LAYER_PIXABAY_KEY={key}");
    }

    tauri_build::build()
}
