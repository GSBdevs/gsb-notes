#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let builder = tauri::Builder::default().plugin(tauri_plugin_notification::init());

  // Autostart (início junto com o SO) e atalho global só existem no desktop.
  #[cfg(desktop)]
  let builder = builder
    .plugin(tauri_plugin_autostart::init(
      tauri_plugin_autostart::MacosLauncher::LaunchAgent,
      Some(vec!["--minimized"]),
    ))
    .plugin(tauri_plugin_global_shortcut::Builder::new().build());

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

  // Atalho global: Ctrl+Shift+S traz o app à frente de qualquer lugar do Windows —
  // e o esconde se já estiver visível e em foco (toggle). Falha silenciosa se outro
  // app já reservou a combinação (não impede o resto do app de subir).
  {
    use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

    let toggle = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::KeyS);
    if let Err(e) = app.global_shortcut().on_shortcut(toggle, |app, _shortcut, event| {
      if event.state() == ShortcutState::Pressed {
        toggle_main_window(app);
      }
    }) {
      log::warn!("atalho global não registrado (talvez em uso por outro app): {e}");
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
      "show" => show_main_window(app),
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
        show_main_window(tray.app_handle());
      }
    })
    .build(app)?;

  Ok(())
}

/// Traz a janela principal à frente (bandeja e "mostrar").
#[cfg(desktop)]
fn show_main_window(app: &tauri::AppHandle) {
  use tauri::Manager;
  if let Some(w) = app.get_webview_window("main") {
    let _ = w.show();
    let _ = w.unminimize();
    let _ = w.set_focus();
  }
}

/// Alterna a janela: esconde se já visível e em foco; senão, traz à frente. (Atalho global.)
#[cfg(desktop)]
fn toggle_main_window(app: &tauri::AppHandle) {
  use tauri::Manager;
  if let Some(w) = app.get_webview_window("main") {
    let visible = w.is_visible().unwrap_or(false);
    let focused = w.is_focused().unwrap_or(false);
    if visible && focused {
      let _ = w.hide();
    } else {
      show_main_window(app);
    }
  }
}
