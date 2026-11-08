# MD Preview

A tiny native Markdown viewer for macOS. It shows the raw source and the rendered output side by side, and reloads live whenever the file changes on disk.

Built in Rust with [tao](https://crates.io/crates/tao) + [wry](https://crates.io/crates/wry) (system WebView) and [pulldown-cmark](https://crates.io/crates/pulldown-cmark). All assets are embedded in the binary; nothing is loaded from the network.

## Features

- **Split, Raw or Rendered view**: switch with the toolbar or `⌘1` / `⌘2` / `⌘3`. The choice is remembered.
- **Live reload**: the file is polled every 400 ms; scroll position is kept on refresh.
- **GitHub-flavored Markdown**: tables, task lists, strikethrough, footnotes, heading attributes, GitHub-style styling, and syntax highlighting (highlight.js) in light and dark mode.
- **Local images and links**: relative image paths resolve against the document's folder. Links to other Markdown files open in a new window; web and `mailto:` links open in your default app; other local files open with `open`.
- **Multiple windows**: one window per document. Opening a file that's already open focuses its window.
- **Open files** by drag and drop, `⌘O`, the command line, or Finder (*Open With → MD Preview*).

Supported extensions: `.md`, `.markdown`, `.mdown`, `.mkd`, `.mdx`, `.txt`.

## Install

Open `dist/MD-Preview.dmg` and drag **MD Preview** into Applications.

Unless the build was signed with a Developer ID, the app is ad-hoc signed: on a Mac other than the one that built it, right-click the app and choose **Open** the first time.

## Build

Requirements: Rust (edition 2024), Xcode command line tools (for `swift`, `sips`, `iconutil`, `codesign`, `hdiutil`).

Run directly during development:

```sh
cargo run -- path/to/file.md
```

Build the app bundle and disk image:

```sh
./build-dmg.sh        # writes dist/MD-Preview.dmg
```

The script builds a universal binary (Apple Silicon + Intel) if the `x86_64-apple-darwin` target is installed (`rustup target add x86_64-apple-darwin`), otherwise a native one. It also generates the app icon from `icon/make-icon.swift` and registers the app as a viewer for Markdown files.

### Signing and notarization (optional)

To distribute without Gatekeeper warnings (requires a paid Apple Developer account):

```sh
xcrun notarytool store-credentials mdpreview --apple-id you@example.com --team-id TEAMID   # once

SIGN_IDENTITY="Developer ID Application: Your Name (TEAMID)" \
NOTARY_PROFILE=mdpreview \
./build-dmg.sh
```

## Project layout

| Path | Contents |
|------|----------|
| `src/main.rs` | Windows, menus, file watching, Markdown rendering, and the `mdp://` protocol that serves the page, assets, and local images |
| `assets/` | The embedded web UI (`index.html`, `app.js`, `app.css`), GitHub Markdown CSS, and highlight.js |
| `icon/make-icon.swift` | Renders the 1024 px app icon |
| `build-dmg.sh` | Builds the `.app` bundle and packages the `.dmg` |
| `test.md`, `test-extended.md` | Sample documents covering common Markdown features |
