#!/bin/bash
# Reapply OpenClaw dashboard customizations after updates
# Usage: bash /Users/bigdata/Projects/openclaw/scripts/apply.sh
# v4.1 — Mac Fluid Modernization + Inter + Plus Jakarta Sans + JetBrains Mono
# Repository: github.com/bmmateru/openclawapp

set -euo pipefail

OPENCLAW_UI="/opt/homebrew/lib/node_modules/openclaw/dist/control-ui"
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
REPO_CSS="$REPO_DIR/css/custom-enhancements.css"
LEGACY_DIR="$HOME/.openclaw/custom-ui"

if [ ! -d "$OPENCLAW_UI" ]; then
  echo "Error: OpenClaw UI directory not found at $OPENCLAW_UI"
  exit 1
fi

if [ ! -f "$REPO_CSS" ]; then
  echo "Error: Custom CSS not found at $REPO_CSS"
  exit 1
fi

# Copy custom CSS to OpenClaw UI assets
echo "Copying CSS to OpenClaw UI..."
cp "$REPO_CSS" "$OPENCLAW_UI/assets/custom-enhancements.css"

# Also copy to legacy ~/.openclaw/custom-ui/ for backward compatibility
if [ -d "$LEGACY_DIR" ]; then
  echo "Syncing CSS to $LEGACY_DIR..."
  cp "$REPO_CSS" "$LEGACY_DIR/custom-enhancements.css"
fi

# Inject Google Fonts preconnect + stylesheet into index.html if not already present
if ! grep -q "Plus+Jakarta+Sans" "$OPENCLAW_UI/index.html"; then
  echo "Injecting Google Fonts..."
  sed -i '' 's|<link rel="icon"|<link rel="preconnect" href="https://fonts.googleapis.com" />\
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />\
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800\&family=Plus+Jakarta+Sans:wght@400;500;600;700;800\&family=JetBrains+Mono:wght@300;400;500;600\&display=swap" rel="stylesheet" />\
    <link rel="icon"|' "$OPENCLAW_UI/index.html"
fi

# Inject CSS link into index.html if not already present
if ! grep -q "custom-enhancements.css" "$OPENCLAW_UI/index.html"; then
  echo "Injecting custom CSS link..."
  sed -i '' 's|</head>|    <link rel="stylesheet" href="./assets/custom-enhancements.css">\
  </head>|' "$OPENCLAW_UI/index.html"
fi

# Update viewport for mobile safe-area support
sed -i '' 's|width=device-width, initial-scale=1.0"|width=device-width, initial-scale=1.0, viewport-fit=cover"|' "$OPENCLAW_UI/index.html"

echo ""
echo "Dashboard customizations applied successfully (v4.1 — Mac Fluid)."
echo "Source: $REPO_CSS"
echo "Target: $OPENCLAW_UI/assets/custom-enhancements.css"
echo "Fonts: Inter (body) + Plus Jakarta Sans (display) + JetBrains Mono (code)"
echo "Features: Glassmorphism, Mac Fluid animations, accent scrollbars, hover-lift, claw marks"
echo ""
echo "Restart the gateway to see changes:"
echo "  openclaw gateway stop && openclaw gateway install"
