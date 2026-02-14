#!/bin/bash
# install-openclaw.sh — macOS .app bundle installer for OpenClaw Electron app
# Creates a proper macOS application bundle in /Applications
# Usage: bash scripts/install-openclaw.sh
# v1.0.0

set -euo pipefail

APP_NAME="OpenClaw"
APP_BUNDLE="/Applications/${APP_NAME}.app"
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BUNDLE_ID="com.openclaw.mac"

echo "================================================"
echo "  OpenClaw Desktop App Installer"
echo "  Mac Fluid Edition"
echo "================================================"
echo ""

# Check Node.js
if ! command -v node &>/dev/null; then
  echo "Error: Node.js is required but not found."
  echo "Install it from https://nodejs.org or via Homebrew: brew install node"
  exit 1
fi

# Check if npm dependencies are installed
if [ ! -d "$PROJECT_DIR/node_modules" ]; then
  echo "Installing dependencies..."
  cd "$PROJECT_DIR" && npm install
  echo ""
fi

# Check if electron is available
if ! "$PROJECT_DIR/node_modules/.bin/electron" --version &>/dev/null 2>&1; then
  echo "Error: Electron not found in node_modules."
  echo "Run 'npm install' in the project directory first."
  exit 1
fi

ELECTRON_VERSION=$("$PROJECT_DIR/node_modules/.bin/electron" --version 2>/dev/null || echo "unknown")
echo "Electron version: $ELECTRON_VERSION"
echo "Project directory: $PROJECT_DIR"
echo ""

# Build DMG if electron-builder is available
if [ -f "$PROJECT_DIR/node_modules/.bin/electron-builder" ]; then
  echo "Building macOS app bundle..."
  cd "$PROJECT_DIR" && npm run build:mac
  echo ""

  # Find the built .app
  BUILT_APP=$(find "$PROJECT_DIR/dist/mac-arm64" -name "*.app" -maxdepth 1 2>/dev/null | head -1)
  if [ -z "$BUILT_APP" ]; then
    BUILT_APP=$(find "$PROJECT_DIR/dist/mac" -name "*.app" -maxdepth 1 2>/dev/null | head -1)
  fi

  if [ -n "$BUILT_APP" ]; then
    echo "Installing to /Applications..."
    if [ -d "$APP_BUNDLE" ]; then
      echo "Removing existing installation..."
      rm -rf "$APP_BUNDLE"
    fi
    cp -R "$BUILT_APP" "$APP_BUNDLE"
    echo ""
    echo "Installed: $APP_BUNDLE"
    echo "You can now launch OpenClaw from the Applications folder or Spotlight."
  else
    echo "Warning: Could not find built .app bundle."
    echo "You can run the app directly with: npm start"
  fi
else
  echo "electron-builder not found. Skipping .app bundle creation."
  echo ""
  echo "To build a distributable .app:"
  echo "  npm install electron-builder --save-dev"
  echo "  npm run build:mac"
  echo ""
  echo "For now, you can run the app with:"
  echo "  cd $PROJECT_DIR && npm start"
fi

echo ""
echo "================================================"
echo "  Installation complete"
echo "================================================"
echo ""
echo "Quick start:"
echo "  npm start         — Launch the Electron app"
echo "  npm run dev       — Launch in development mode (connects to localhost:18789)"
echo "  npm run build:mac — Build a distributable .app bundle"
echo ""
echo "Make sure the OpenClaw gateway is running:"
echo "  openclaw gateway install"
echo ""
