//! MD Preview: a tiny native markdown viewer. Raw source and rendered output side by side,
//! live-reloading when the file changes on disk.

use std::borrow::Cow;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant, SystemTime};

use http::{Request, Response};
use muda::{Menu, MenuEvent, MenuItem, PredefinedMenuItem, Submenu};
use percent_encoding::{percent_decode_str, utf8_percent_encode, AsciiSet, CONTROLS};
use pulldown_cmark::{html, Options, Parser};
use tao::event::{Event, StartCause, WindowEvent};
use tao::event_loop::{ControlFlow, EventLoopBuilder, EventLoopProxy, EventLoopWindowTarget};
use tao::window::{Window, WindowBuilder, WindowId};
use wry::{DragDropEvent, WebView, WebViewBuilder};

const ORIGIN: &str = "mdp://localhost";
const POLL: Duration = Duration::from_millis(400);
const MD_EXTS: &[&str] = &["md", "markdown", "mdown", "mkd", "mdx", "txt"];

const CSP: &str = "default-src 'self' mdp:; img-src * data: mdp:; style-src 'self' mdp: 'unsafe-inline'; \
                   script-src 'self' mdp:; connect-src 'self' mdp:";

static ASSETS: &[(&str, &str, &[u8])] = &[
    ("app.js", "text/javascript", include_bytes!("../assets/app.js")),
    ("app.css", "text/css", include_bytes!("../assets/app.css")),
    ("hljs.js", "text/javascript", include_bytes!("../assets/hljs.js")),
    ("hljs-light.css", "text/css", include_bytes!("../assets/hljs-light.css")),
    ("hljs-dark.css", "text/css", include_bytes!("../assets/hljs-dark.css")),
    ("github-markdown.css", "text/css", include_bytes!("../assets/github-markdown.css")),
];

enum UserEvent {
    Open(Vec<PathBuf>),
    PickFiles,
    Menu(MenuEvent),
}

struct Viewer {
    window: Window,
    webview: WebView,
    doc: Arc<Mutex<Option<PathBuf>>>,
    mtime: Option<SystemTime>,
}

fn main() {
    let event_loop = EventLoopBuilder::<UserEvent>::with_user_event().build();
    let proxy = event_loop.create_proxy();

    let menu_proxy = proxy.clone();
    MenuEvent::set_event_handler(Some(move |e| {
        let _ = menu_proxy.send_event(UserEvent::Menu(e));
    }));

    let menu = Menu::new();
    let open_item = MenuItem::new("Open…", true, "CmdOrCtrl+O".parse().ok());
    let split_item = MenuItem::new("Split", true, "CmdOrCtrl+1".parse().ok());
    let raw_item = MenuItem::new("Raw Only", true, "CmdOrCtrl+2".parse().ok());
    let ren_item = MenuItem::new("Rendered Only", true, "CmdOrCtrl+3".parse().ok());
    let app_menu = Submenu::with_items(
        "MD Preview",
        true,
        &[
            &PredefinedMenuItem::about(None, None),
            &PredefinedMenuItem::separator(),
            &PredefinedMenuItem::hide(None),
            &PredefinedMenuItem::hide_others(None),
            &PredefinedMenuItem::separator(),
            &PredefinedMenuItem::quit(None),
        ],
    )
    .unwrap();
    let file_menu = Submenu::with_items(
        "File",
        true,
        &[&open_item, &PredefinedMenuItem::separator(), &PredefinedMenuItem::close_window(None)],
    )
    .unwrap();
    let edit_menu = Submenu::with_items(
        "Edit",
        true,
        &[&PredefinedMenuItem::copy(None), &PredefinedMenuItem::select_all(None)],
    )
    .unwrap();
    let view_menu = Submenu::with_items(
        "View",
        true,
        &[&split_item, &raw_item, &ren_item, &PredefinedMenuItem::separator(), &PredefinedMenuItem::fullscreen(None)],
    )
    .unwrap();
    let window_menu = Submenu::with_items("Window", true, &[&PredefinedMenuItem::minimize(None)]).unwrap();
    menu.append_items(&[&app_menu, &file_menu, &edit_menu, &view_menu, &window_menu]).unwrap();

    let cli_files: Vec<PathBuf> = std::env::args().skip(1).filter(|a| !a.starts_with("-psn")).map(PathBuf::from).collect();

    let mut viewers: HashMap<WindowId, Viewer> = HashMap::new();
    let mut focused: Option<WindowId> = None;
    let started = Instant::now();
    let mut opened_any = false;

    event_loop.run(move |event, target, control_flow| {
        *control_flow = ControlFlow::WaitUntil(Instant::now() + POLL);

        match event {
            Event::NewEvents(StartCause::Init) => {
                menu.init_for_nsapp();
                window_menu.set_as_windows_menu_for_nsapp();
                if !cli_files.is_empty() {
                    let _ = proxy.send_event(UserEvent::Open(cli_files.clone()));
                }
            }
            Event::NewEvents(StartCause::ResumeTimeReached { .. }) => {
                // Launched without a file (and Finder didn't hand us one): show an empty drop target.
                if !opened_any && viewers.is_empty() && started.elapsed() > Duration::from_millis(500) {
                    opened_any = true;
                    new_viewer(target, &proxy, &mut viewers, None);
                }
                for v in viewers.values_mut() {
                    let Some(path) = v.doc.lock().unwrap().clone() else { continue };
                    let m = std::fs::metadata(&path).and_then(|m| m.modified()).ok();
                    if m.is_some() && m != v.mtime {
                        v.mtime = m;
                        let _ = v.webview.evaluate_script("refresh()");
                    }
                }
            }
            Event::Opened { urls } => {
                let paths = urls.iter().filter_map(|u| u.to_file_path().ok()).collect();
                let _ = proxy.send_event(UserEvent::Open(paths));
            }
            Event::Reopen { has_visible_windows: false, .. } => {
                new_viewer(target, &proxy, &mut viewers, None);
            }
            Event::UserEvent(UserEvent::Open(paths)) => {
                for p in paths {
                    opened_any = true;
                    open_path(target, &proxy, &mut viewers, p);
                }
            }
            Event::UserEvent(UserEvent::PickFiles) => {
                // Start in the folder of the document in the focused window, if any.
                let dir = focused
                    .and_then(|id| viewers.get(&id))
                    .and_then(|v| v.doc.lock().unwrap().as_ref().and_then(|p| p.parent().map(Path::to_path_buf)));
                let mut dialog = rfd::FileDialog::new().add_filter("Markdown", MD_EXTS);
                if let Some(dir) = dir {
                    dialog = dialog.set_directory(dir);
                }
                if let Some(paths) = dialog.pick_files() {
                    let _ = proxy.send_event(UserEvent::Open(paths));
                }
            }
            Event::UserEvent(UserEvent::Menu(e)) => {
                if e.id == open_item.id() {
                    let _ = proxy.send_event(UserEvent::PickFiles);
                } else if let Some(v) = focused.and_then(|id| viewers.get(&id)) {
                    let mode = if e.id == split_item.id() {
                        ""
                    } else if e.id == raw_item.id() {
                        "raw-only"
                    } else if e.id == ren_item.id() {
                        "ren-only"
                    } else {
                        return;
                    };
                    let _ = v.webview.evaluate_script(&format!("setMode('{mode}')"));
                }
            }
            Event::WindowEvent { window_id, event, .. } => match event {
                WindowEvent::Focused(true) => focused = Some(window_id),
                WindowEvent::CloseRequested => {
                    viewers.remove(&window_id);
                    if viewers.is_empty() {
                        *control_flow = ControlFlow::Exit;
                    }
                }
                _ => {}
            },
            _ => {}
        }
    });
}

/// Focus the window already showing `path`, else reuse an empty window, else open a new one.
fn open_path(
    target: &EventLoopWindowTarget<UserEvent>,
    proxy: &EventLoopProxy<UserEvent>,
    viewers: &mut HashMap<WindowId, Viewer>,
    path: PathBuf,
) {
    let path = std::fs::canonicalize(&path).unwrap_or(path);
    if let Some(v) = viewers.values().find(|v| v.doc.lock().unwrap().as_ref() == Some(&path)) {
        v.window.set_focus();
        return;
    }
    if let Some(v) = viewers.values_mut().find(|v| v.doc.lock().unwrap().is_none()) {
        *v.doc.lock().unwrap() = Some(path.clone());
        v.mtime = None; // the next poll sees a "change" and calls refresh()
        v.window.set_title(&title_for(&path));
        v.window.set_focus();
        return;
    }
    new_viewer(target, proxy, viewers, Some(path));
}

fn new_viewer(
    target: &EventLoopWindowTarget<UserEvent>,
    proxy: &EventLoopProxy<UserEvent>,
    viewers: &mut HashMap<WindowId, Viewer>,
    path: Option<PathBuf>,
) {
    let title = path.as_deref().map(title_for).unwrap_or_else(|| "MD Preview".into());
    let window = WindowBuilder::new()
        .with_title(title)
        .with_inner_size(tao::dpi::LogicalSize::new(1300.0, 850.0))
        .build(target)
        .expect("create window");

    let doc = Arc::new(Mutex::new(path));
    let proto_doc = doc.clone();
    let nav_proxy = proxy.clone();
    let drop_proxy = proxy.clone();
    let ipc_proxy = proxy.clone();

    let webview = WebViewBuilder::new()
        .with_custom_protocol("mdp".into(), move |_id, req| serve(&proto_doc, req))
        .with_ipc_handler(move |req| {
            if req.body() == "open" {
                let _ = ipc_proxy.send_event(UserEvent::PickFiles);
            }
        })
        .with_navigation_handler(move |url| handle_navigation(&nav_proxy, &url))
        .with_drag_drop_handler(move |e| {
            if let DragDropEvent::Drop { paths, .. } = e {
                let _ = drop_proxy.send_event(UserEvent::Open(paths));
            }
            true
        })
        .with_url(format!("{ORIGIN}/"))
        .build(&window)
        .expect("create webview");

    let mtime = doc.lock().unwrap().as_ref().and_then(|p| std::fs::metadata(p).and_then(|m| m.modified()).ok());
    viewers.insert(window.id(), Viewer { window, webview, doc, mtime });
}

fn title_for(path: &Path) -> String {
    path.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default()
}

/// Allow the page itself; open other markdown files in new windows; send everything else to macOS.
fn handle_navigation(proxy: &EventLoopProxy<UserEvent>, url: &str) -> bool {
    let Some(rest) = url.strip_prefix(ORIGIN) else {
        if url.starts_with("http:") || url.starts_with("https:") || url.starts_with("mailto:") {
            let _ = std::process::Command::new("open").arg(url).spawn();
        }
        return false;
    };
    let path = rest.split(['#', '?']).next().unwrap_or("");
    if path == "/" {
        return true;
    }
    let path = PathBuf::from(percent_decode_str(path).decode_utf8_lossy().as_ref());
    let is_md = path.extension().is_some_and(|e| MD_EXTS.contains(&e.to_string_lossy().to_lowercase().as_str()));
    if is_md {
        let _ = proxy.send_event(UserEvent::Open(vec![path]));
    } else if path.exists() {
        let _ = std::process::Command::new("open").arg(&path).spawn();
    }
    false
}

fn serve(doc: &Mutex<Option<PathBuf>>, req: Request<Vec<u8>>) -> Response<Cow<'static, [u8]>> {
    let path = req.uri().path();
    match path {
        "/" => respond(200, "text/html; charset=utf-8", include_bytes!("../assets/index.html").as_slice().into()),
        "/__mdp/content" => {
            let json = content_json(doc.lock().unwrap().as_deref());
            respond(200, "application/json", json.into_bytes().into())
        }
        p if p.starts_with("/__mdp/") => match ASSETS.iter().find(|(n, _, _)| p[7..] == **n) {
            Some((_, mime, data)) => respond(200, mime, Cow::Borrowed(data)),
            None => respond(404, "text/plain", Cow::Borrowed(b"not found")),
        },
        // Anything else is a file referenced by the document (images etc.), by absolute path.
        p => {
            let fs_path = PathBuf::from(percent_decode_str(p).decode_utf8_lossy().as_ref());
            match std::fs::read(&fs_path) {
                Ok(bytes) => respond(200, mime_for(&fs_path), bytes.into()),
                Err(_) => respond(404, "text/plain", Cow::Borrowed(b"not found")),
            }
        }
    }
}

fn respond(status: u16, mime: &str, body: Cow<'static, [u8]>) -> Response<Cow<'static, [u8]>> {
    Response::builder()
        .status(status)
        .header("Content-Type", mime)
        .header("Content-Security-Policy", CSP)
        .header("Cache-Control", "no-store")
        .body(body)
        .unwrap()
}

fn content_json(path: Option<&Path>) -> String {
    let Some(path) = path else {
        return serde_json::json!({ "empty": true }).to_string();
    };
    let raw = match std::fs::read(path) {
        Ok(b) => String::from_utf8_lossy(&b).into_owned(),
        Err(e) => return serde_json::json!({ "error": format!("{}: {e}", path.display()) }).to_string(),
    };
    let opts = Options::ENABLE_TABLES
        | Options::ENABLE_TASKLISTS
        | Options::ENABLE_STRIKETHROUGH
        | Options::ENABLE_FOOTNOTES
        | Options::ENABLE_GFM
        | Options::ENABLE_HEADING_ATTRIBUTES;
    let mut rendered = String::new();
    html::push_html(&mut rendered, Parser::new_ext(&raw, opts));

    const PATH_SET: &AsciiSet = &CONTROLS.add(b' ').add(b'"').add(b'#').add(b'%').add(b'?').add(b'<').add(b'>');
    let dir = path.parent().unwrap_or(Path::new("/")).to_string_lossy();
    let base = format!("{ORIGIN}{}/", utf8_percent_encode(dir.trim_end_matches('/'), PATH_SET));
    serde_json::json!({ "raw": raw, "html": rendered, "base": base }).to_string()
}

fn mime_for(path: &Path) -> &'static str {
    match path.extension().map(|e| e.to_string_lossy().to_lowercase()).as_deref() {
        Some("png") => "image/png",
        Some("jpg" | "jpeg") => "image/jpeg",
        Some("gif") => "image/gif",
        Some("svg") => "image/svg+xml",
        Some("webp") => "image/webp",
        Some("avif") => "image/avif",
        Some("ico") => "image/x-icon",
        Some("bmp") => "image/bmp",
        _ => "application/octet-stream",
    }
}
