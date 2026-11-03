mod capture;
mod files;
mod pixabay;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(pixabay::SearchCache::default())
        .invoke_handler(tauri::generate_handler![
            capture::capture_screen,
            files::save_project,
            files::open_project,
            files::export_static,
            pixabay::search_images,
            pixabay::download_image,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Layer");
}
