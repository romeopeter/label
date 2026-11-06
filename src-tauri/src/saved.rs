//! Backgrounds the user saved to use again, kept in a file in the app's data
//! folder until SQLite lands. The webview sends and receives the list as JSON
//! text; this side only checks it's a list and keeps it whole.

use std::{
    fs,
    io::{self, Write},
    path::{Path, PathBuf},
};

use tauri::{AppHandle, Manager};

const FILE_NAME: &str = "saved-backgrounds.json";

/// Far above any sensible list, even with image backgrounds in it. Only stops a
/// runaway file being read whole or written.
const MAX_FILE_BYTES: usize = 64 * 1024 * 1024;

#[derive(Debug, thiserror::Error)]
enum SaveError {
    #[error("Layer couldn't find its data folder.")]
    NoFolder,
    #[error("There are too many saved backgrounds to keep. Delete a few, then try again.")]
    TooBig,
    #[error("Layer couldn't keep that list of backgrounds.")]
    NotAList,
    // The OS error isn't passed on: it names the file's path.
    #[error("Layer couldn't save your backgrounds.")]
    Io(#[from] io::Error),
}

fn file_of(app: &AppHandle) -> Result<PathBuf, SaveError> {
    app.path()
        .app_data_dir()
        .map(|directory| directory.join(FILE_NAME))
        .map_err(|_| SaveError::NoFolder)
}

fn is_list(text: &str) -> bool {
    serde_json::from_str::<Vec<serde_json::Value>>(text).is_ok()
}

/// The saved list, or an empty one when there's no file yet or it's damaged.
fn read_list(path: &Path) -> String {
    let fits = fs::metadata(path).is_ok_and(|meta| meta.len() <= MAX_FILE_BYTES as u64);
    match fs::read_to_string(path) {
        Ok(text) if fits && is_list(&text) => text,
        _ => "[]".to_owned(),
    }
}

/// All or nothing, so a crash mid-write can't leave half a file behind.
fn write_list(path: &Path, list: &str) -> Result<(), SaveError> {
    if list.len() > MAX_FILE_BYTES {
        return Err(SaveError::TooBig);
    }
    if !is_list(list) {
        return Err(SaveError::NotAList);
    }
    let directory = path.parent().ok_or(SaveError::NoFolder)?;
    fs::create_dir_all(directory)?;
    let mut file = tempfile::NamedTempFile::new_in(directory)?;
    file.write_all(list.as_bytes())?;
    file.persist(path).map_err(|error| error.error)?;
    Ok(())
}

#[tauri::command]
pub async fn load_saved_backgrounds(app: AppHandle) -> Result<String, String> {
    let path = file_of(&app).map_err(|error| error.to_string())?;
    tauri::async_runtime::spawn_blocking(move || read_list(&path))
        .await
        .map_err(|_| SaveError::NotAList.to_string())
}

#[tauri::command]
pub async fn store_saved_backgrounds(app: AppHandle, list: String) -> Result<(), String> {
    let path = file_of(&app).map_err(|error| error.to_string())?;
    tauri::async_runtime::spawn_blocking(move || write_list(&path, &list))
        .await
        .map_err(|_| SaveError::NotAList.to_string())?
        .map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn file_in(directory: &tempfile::TempDir) -> PathBuf {
        directory.path().join("nested").join(FILE_NAME)
    }

    #[test]
    fn keeps_a_list_and_reads_it_back() {
        let directory = tempfile::tempdir().expect("temp dir");
        let path = file_in(&directory);
        let list = r##"[{"id":"bg_1","background":{"mode":"solid","color":"#123456"}}]"##;

        write_list(&path, list).expect("saved");

        assert_eq!(read_list(&path), list);
    }

    #[test]
    fn no_file_or_a_damaged_one_reads_as_empty() {
        let directory = tempfile::tempdir().expect("temp dir");
        let path = file_in(&directory);
        assert_eq!(read_list(&path), "[]");

        fs::create_dir_all(path.parent().expect("parent")).expect("folder");
        fs::write(&path, "{not json").expect("write");
        assert_eq!(read_list(&path), "[]");
    }

    #[test]
    fn refuses_anything_but_a_list() {
        let directory = tempfile::tempdir().expect("temp dir");
        let path = file_in(&directory);

        assert!(matches!(
            write_list(&path, r#"{"id":1}"#),
            Err(SaveError::NotAList)
        ));
        assert!(!path.exists());
    }

    #[test]
    fn refuses_a_list_too_big_to_keep() {
        let directory = tempfile::tempdir().expect("temp dir");
        let path = file_in(&directory);
        let huge = format!("[\"{}\"]", "a".repeat(MAX_FILE_BYTES));

        assert!(matches!(write_list(&path, &huge), Err(SaveError::TooBig)));
    }
}
