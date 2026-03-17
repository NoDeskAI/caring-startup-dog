use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();
            if let Ok(Some(monitor)) = window.current_monitor() {
                let size = monitor.size();
                let scale = monitor.scale_factor();
                let sw = (size.width as f64 / scale) as i32;
                let sh = (size.height as f64 / scale) as i32;
                let _ = window.set_position(tauri::LogicalPosition::new(
                    (sw - 450) as f64,
                    (sh - 500) as f64,
                ));
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
