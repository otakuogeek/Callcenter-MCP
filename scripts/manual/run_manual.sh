#!/usr/bin/env bash
set -euo pipefail

# Script to install dependencies and run the manual generator (Playwright)
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT_DIR="$ROOT_DIR/scripts/manual"

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

# Install browsers for Playwright
npx playwright install --with-deps

# Ensure output dir exists
mkdir -p "$ROOT_DIR/docs/manual_screenshots"

echo "Running generate_manual.js..."
node generate_manual.js

echo "Manual generation finished. Screenshots are in docs/manual_screenshots"
