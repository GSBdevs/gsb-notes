#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let builder = tauri::Builder::default().plugin(tauri_plugin_notification::init());

  // Autostart (início junto com o SO) só existe no desktop.
  #[cfg(desktop)]
  let builder = builder.plugin(tauri_plugin_autostart::init(
    tauri_plugin_autostart::MacosLauncher::LaunchAgent,
    Some(vec!["--minimized"]),
  ));

  builder
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      #[cfg(desktop)]
      setup_desktop(app)?;

      Ok(())
    })
    .on_window_event(|window, event| {
      // Fechar a janela = esconder na bandeja (mantém notificações e agenda vivos).
      if let tauri::WindowEvent::CloseRequested { api, .. } = event {
        let _ = window.hide();
        api.prevent_close();
      }
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

#[cfg(desktop)]
fn setup_desktop(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
  use tauri::menu::{MenuBuilder, MenuItemBuilder};
  use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
  use tauri::Manager;

  // O início com o SO é controlado pelo usuário nos Ajustes (plugin-autostart via JS),
  // não forçado aqui. Quando o SO abre o app no boot, ele passa "--minimized": o app
  // começa escondido na bandeja.
  let minimized = std::env::args().any(|a| a == "--minimized");
  if minimized {
    if let Some(w) = app.get_webview_window("main") {
      let _ = w.hide();
    }
  }

  // Bandeja (tray) com menu Abrir/Sair.
  let show = MenuItemBuilder::with_id("show", "Abrir SB Notas").build(app)?;
  let quit = MenuItemBuilder::with_id("quit", "Sair").build(app)?;
  let menu = MenuBuilder::new(app).items(&[&show, &quit]).build()?;

  TrayIconBuilder::with_id("main")
    .icon(app.default_window_icon().unwrap().clone())
    .tooltip("SB Notas")
    .menu(&menu)
    .show_menu_on_left_click(false)
    .on_menu_event(|app, event| match event.id().as_ref() {
      "show" => {
        if let Some(w) = app.get_webview_window("main") {
          let _ = w.show();
          let _ = w.unminimize();
          let _ = w.set_focus();
        }
      }
      "quit" => app.exit(0),
      _ => {}
    })
    .on_tray_icon_event(|tray, event| {
      // Clique esquerdo na bandeja mostra/foca a janela.
      if let TrayIconEvent::Click {
        button: MouseButton::Left,
        button_state: MouseButtonState::Up,
        ..
      } = event
      {
        let app = tray.app_handle();
        if let Some(w) = app.get_webview_window("main") {
          let _ = w.show();
          let _ = w.unminimize();
          let _ = w.set_focus();
        }
      }
    })
    .build(app)?;

  Ok(())
}
