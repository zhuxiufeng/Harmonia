#!/usr/bin/env bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

BUILD_DIR="../anesidora_mv3_dist"
ZIP_NAME="../anesidora_mv3.zip"

echo "=== Building Harmonia Chrome Extension (Manifest V3) ==="

rm -rf "$BUILD_DIR" "$ZIP_NAME"
mkdir -p "$BUILD_DIR"

# Copy all runtime files
cp -r css images js compact.htm cozy.htm offscreen.html options.htm declarativeNetRules.json manifest.json "$BUILD_DIR/"

# Create zip package
cd "$BUILD_DIR"
zip -r "$ZIP_NAME" * > /dev/null
cd "$DIR"

echo "Build complete!"
echo "Distribution directory: $BUILD_DIR"
echo "Packaged zip file: $ZIP_NAME"
