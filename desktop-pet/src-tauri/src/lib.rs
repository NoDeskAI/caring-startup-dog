#[cfg(target_os = "macos")]
#[macro_use]
extern crate objc;

use tauri::Manager;
use tauri_plugin_sql::{Migration, MigrationKind};

#[cfg(target_os = "macos")]
use cocoa::appkit::NSWindow;
#[cfg(target_os = "macos")]
use objc::runtime::YES;

#[tauri::command]
fn set_mouse_passthrough(window: tauri::Window, passthrough: bool) {
    #[cfg(target_os = "macos")]
    {
        let ns_win = window.ns_window().unwrap() as cocoa::base::id;
        unsafe {
            if passthrough {
                ns_win.setIgnoresMouseEvents_(YES);
                let _: () = objc::msg_send![ns_win, setAcceptsMouseMovedEvents: YES];
            } else {
                ns_win.setIgnoresMouseEvents_(cocoa::base::NO);
            }
        }
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (window, passthrough);
    }
}

#[tauri::command]
fn get_cursor_pos_in_window(window: tauri::Window) -> Option<[f64; 2]> {
    #[cfg(target_os = "macos")]
    {
        let ns_win = window.ns_window().unwrap() as cocoa::base::id;
        unsafe {
            use cocoa::appkit::NSEvent;
            let mouse_loc = NSEvent::mouseLocation(cocoa::base::nil);
            let frame: cocoa::foundation::NSRect = msg_send![ns_win, frame];
            let local_x = mouse_loc.x - frame.origin.x;
            let local_y = frame.size.height - (mouse_loc.y - frame.origin.y);
            return Some([local_x, local_y]);
        }
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = window;
        None
    }
}

#[tauri::command]
fn move_window(window: tauri::Window, x: f64, y: f64) {
    if let Ok(Some(monitor)) = window.current_monitor() {
        let msize = monitor.size();
        let scale = monitor.scale_factor();
        let sw = msize.width as f64 / scale;
        let sh = msize.height as f64 / scale;
        let margin = 80.0;
        let win_w = window
            .outer_size()
            .map(|s| s.width as f64 / scale)
            .unwrap_or(400.0);
        let nx = x.max(-(win_w - margin)).min(sw - margin);
        let ny = y.max(0.0).min(sh - margin);
        let _ = window.set_position(tauri::LogicalPosition::new(nx, ny));
    } else {
        let _ = window.set_position(tauri::LogicalPosition::new(x, y));
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "create mood_log and daily_summary",
            sql: "CREATE TABLE IF NOT EXISTS mood_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ts TEXT NOT NULL DEFAULT (datetime('now','localtime')),
                source TEXT NOT NULL,
                dog_state TEXT NOT NULL,
                emotion_score REAL NOT NULL,
                emotion_label TEXT,
                energy INTEGER,
                active_hours REAL,
                msg_count INTEGER,
                prompt_count INTEGER,
                work_summary TEXT,
                user_note TEXT
            );
            CREATE TABLE IF NOT EXISTS daily_summary (
                date TEXT PRIMARY KEY,
                avg_emotion REAL,
                total_active_hours REAL,
                total_messages INTEGER,
                total_prompts INTEGER,
                peak_stress_time TEXT,
                dog_evolution_stage TEXT,
                synced_to_feishu INTEGER DEFAULT 0
            );",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "create work_snapshot for periodic data collection",
            sql: "CREATE TABLE IF NOT EXISTS work_snapshot (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ts TEXT NOT NULL DEFAULT (datetime('now','localtime')),
                energy INTEGER,
                msg_count INTEGER,
                prompt_count INTEGER,
                active_hours REAL,
                work_mode TEXT,
                work_summary TEXT,
                last_update TEXT UNIQUE
            );",
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:dog.db", migrations)
                .build(),
        )
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![set_mouse_passthrough, move_window, get_cursor_pos_in_window])
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

            let win = window.clone();
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_millis(300));
                let _ = win.show();
                let _ = win.set_focus();
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
