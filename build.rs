fn main() {
    // Give the Windows .exe its icon (resource id 1, also used as the window icon).
    #[cfg(windows)]
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("windows") {
        winresource::WindowsResource::new().set_icon("packaging/md-preview.ico").compile().expect("embed icon");
    }
}
