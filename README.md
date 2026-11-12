<p align="center"><img src="docs/logo.png" width="128" alt="MD Preview icon"></p>

<h1 align="center">MD Preview</h1>

A tiny native Markdown viewer and editor for macOS, Windows and Linux: source and rendered output side by side, with live preview and live reload.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/screenshot-dark.png">
  <img src="docs/screenshot-light.png" alt="MD Preview with the Markdown source on the left and the rendered document on the right">
</picture>

## Features

- Split, Raw or Rendered view (`⌘1` / `⌘2` / `⌘3`; `Ctrl` instead of `⌘` on Windows and Linux)
- Edit the source with live preview; `⌘S` to save
- Reloads automatically when the file changes on disk
- GitHub-flavored Markdown with syntax highlighting, light and dark mode
- Open files by drag and drop, `⌘O`, the command line, or the file manager

## Install

- **macOS**: open `dist/MD-Preview.dmg` and drag **MD Preview** into Applications. The first time, right-click the app and choose **Open**.
- **Windows**: download `MD-Preview.exe` from the [releases](../../releases) and run it; there is nothing to install. It uses the WebView2 runtime that ships with Windows 10 and 11.
- **Debian / Ubuntu**: download the `.deb` from the [releases](../../releases) and run `sudo apt install ./md-preview_*.deb`.

## Build

Requires Rust, plus the Xcode command line tools on macOS, or `libwebkit2gtk-4.1-dev` and `libgtk-3-dev` on Linux.

```sh
cargo run -- path/to/file.md   # run
./build-dmg.sh                 # macOS: build dist/MD-Preview.dmg
cargo build --release          # Windows: build target\release\md-preview.exe
cargo deb                      # Linux: build target/debian/md-preview_*.deb (needs `cargo install cargo-deb`)
```

Pushing a tag like `v0.1.0` builds the `.exe` and the `.deb` on GitHub Actions and attaches them to a release.

## License

[MIT](LICENSE)
