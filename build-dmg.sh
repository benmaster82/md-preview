#!/bin/bash
# Build "MD Preview.app" from the Rust binary and package it into dist/MD-Preview.dmg
#
# Optional, for distributing to other Macs without Gatekeeper warnings (needs a paid Apple Developer account):
#   SIGN_IDENTITY="Developer ID Application: Your Name (TEAMID)"   sign with your Developer ID
#   NOTARY_PROFILE=mdpreview   notarize + staple, using credentials saved once with:
#       xcrun notarytool store-credentials mdpreview --apple-id you@example.com --team-id TEAMID
# Without them the app is ad-hoc signed: fine on this Mac, right-click > Open needed elsewhere.
set -euo pipefail
cd "$(dirname "$0")"

APP_NAME="MD Preview"
VERSION=$(sed -n 's/^version = "\(.*\)"/\1/p' Cargo.toml | head -1)
BUILD=build
APP="$BUILD/stage/$APP_NAME.app"
DMG="dist/MD-Preview.dmg"

# Universal binary (Apple Silicon + Intel) if the Intel target is installed, else native only.
if rustup target list --installed 2>/dev/null | grep -q x86_64-apple-darwin; then
  cargo build --release --target aarch64-apple-darwin
  cargo build --release --target x86_64-apple-darwin
  BIN="$BUILD/md-preview"; mkdir -p "$BUILD"
  lipo -create -output "$BIN" target/{aarch64,x86_64}-apple-darwin/release/md-preview
else
  cargo build --release
  BIN=target/release/md-preview
fi

rm -rf "$BUILD/stage" && mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources" dist
cp "$BIN" "$APP/Contents/MacOS/md-preview"

# App icon: render the 1024px master, downscale to every size macOS wants, pack into .icns
ICONSET="$BUILD/AppIcon.iconset"; mkdir -p "$ICONSET"
swift icon/make-icon.swift "$BUILD/icon-1024.png"
for s in 16 32 128 256 512; do
  sips -z $s $s "$BUILD/icon-1024.png" --out "$ICONSET/icon_${s}x${s}.png" >/dev/null
  sips -z $((s*2)) $((s*2)) "$BUILD/icon-1024.png" --out "$ICONSET/icon_${s}x${s}@2x.png" >/dev/null
done
iconutil -c icns "$ICONSET" -o "$APP/Contents/Resources/AppIcon.icns"

cat > "$APP/Contents/Info.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleName</key><string>$APP_NAME</string>
  <key>CFBundleDisplayName</key><string>$APP_NAME</string>
  <key>CFBundleIdentifier</key><string>local.mdpreview</string>
  <key>CFBundleExecutable</key><string>md-preview</string>
  <key>CFBundleIconFile</key><string>AppIcon</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>$VERSION</string>
  <key>CFBundleVersion</key><string>$VERSION</string>
  <key>LSMinimumSystemVersion</key><string>11.0</string>
  <key>NSHighResolutionCapable</key><true/>
  <key>CFBundleDocumentTypes</key><array><dict>
    <key>CFBundleTypeName</key><string>Markdown document</string>
    <key>CFBundleTypeRole</key><string>Viewer</string>
    <key>LSHandlerRank</key><string>Alternate</string>
    <key>LSItemContentTypes</key><array>
      <string>net.daringfireball.markdown</string><string>public.plain-text</string>
    </array>
    <key>CFBundleTypeExtensions</key><array>
      <string>md</string><string>markdown</string><string>mdown</string><string>mkd</string>
    </array>
  </dict></array>
</dict></plist>
EOF
plutil -lint -s "$APP/Contents/Info.plist"

if [ -n "${SIGN_IDENTITY:-}" ]; then
  codesign --force --options runtime --timestamp -s "$SIGN_IDENTITY" "$APP"
else
  codesign --force -s - "$APP"   # ad-hoc signature (required on Apple Silicon)
fi
codesign --verify --strict "$APP"

ln -s /Applications "$BUILD/stage/Applications"
rm -f "$DMG"
hdiutil create -volname "$APP_NAME" -srcfolder "$BUILD/stage" -ov -format UDZO "$DMG" >/dev/null
rm -rf "$BUILD"

if [ -n "${SIGN_IDENTITY:-}" ]; then
  codesign --force --timestamp -s "$SIGN_IDENTITY" "$DMG"
  if [ -n "${NOTARY_PROFILE:-}" ]; then
    xcrun notarytool submit "$DMG" --keychain-profile "$NOTARY_PROFILE" --wait
    xcrun stapler staple "$DMG"
  fi
fi
echo "Built $DMG"
