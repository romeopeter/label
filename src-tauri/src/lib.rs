mod files;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            files::save_project,
            files::open_project,
            files::export_static,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Layer");
}
