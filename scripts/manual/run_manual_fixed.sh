#!/usr/bin/env bash
set -euo pipefail

# Script to install dependencies and run the manual generator (Playwright)
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# Script directory (this file's directory)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Check if frontend is running
echo "Checking if frontend is available..."
bash "$SCRIPT_DIR/check_frontend.sh" || exit 1

echo ""
echo "Installing Playwright and dependencies locally..."
cd "$SCRIPT_DIR"

# Create package.json if missing
if [ ! -f package.json ]; then
  cat > package.json <<'JSON'
{
  "name": "manual-generator",
  "version": "1.0.0",
  "private": true,
  "dependencies": {
    "playwright": "^1.40.0"
  }
}
JSON
fi

npm install --no-audit --no-fund

# Install browsers for Playwright (only if not already installed)
if [ ! -d "$HOME/.cache/ms-playwright" ]; then
  echo "Installing Playwright browsers (this may take a few minutes)..."
  npx playwright install --with-deps
else
  echo "Playwright browsers already installed, skipping..."
fi

# Ensure output dir exists
mkdir -p "$ROOT_DIR/docs/manual_screenshots"

echo ""
echo "Running generate_manual.js..."
node generate_manual.js

echo ""
echo "✓ Manual generation finished!"
echo "  Screenshots saved to: docs/manual_screenshots/"
echo "  Manual document: docs/MANUAL_DE_USO.md"
echo ""
