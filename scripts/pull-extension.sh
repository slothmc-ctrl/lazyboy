#!/bin/bash
# pull-extension.sh — Run this on your LAPTOP to get the lazyboy extension from the RPi
# Prerequisites: Tailscale connected on both machines
#
# Usage:
#   ./scripts/pull-extension.sh                          # uses default Pi IP
#   ./scripts/pull-extension.sh 100.94.50.109            # specify Pi's Tailscale IP
#   ./scripts/pull-extension.sh 100.94.50.109 ~/ext      # specify IP and target dir

set -e

PI_IP="${1:-100.94.50.109}"
TARGET_DIR="${2:-$HOME/lazyboy-extension}"
PI_URL="http://${PI_IP}:8787"

echo "🦥 Lazyboy Extension Puller"
echo "============================"
echo "Pi:      ${PI_IP}"
echo "Target:  ${TARGET_DIR}"
echo ""

# Check Tailscale connectivity
echo "→ Checking connection to Pi..."
if ! curl -s --connect-timeout 5 "${PI_URL}/health" > /dev/null 2>&1; then
    echo "❌ Cannot reach Pi at ${PI_IP}:8787"
    echo ""
    echo "Make sure:"
    echo "  1. Both machines are on Tailscale (tailscale status)"
    echo "  2. ./dev.sh is running on the Pi"
    echo "  3. The Pi's Tailscale IP is correct: ${PI_IP}"
    exit 1
fi
echo "✓ Pi is reachable"
echo ""

# Download the extension zip
echo "→ Downloading extension from Pi..."
curl -# -o /tmp/lazyboy-extension.zip "${PI_URL}/dist-chrome.zip"
echo "✓ Downloaded"
echo ""

# Extract
echo "→ Extracting to ${TARGET_DIR}..."
rm -rf "${TARGET_DIR}"
mkdir -p "${TARGET_DIR}"
unzip -qo /tmp/lazyboy-extension.zip -d "${TARGET_DIR}"
rm /tmp/lazyboy-extension.zip

# The zip is flat — files are at the root, no dist-chrome/ subfolder
# manifest.json is directly in TARGET_DIR
echo "✓ Extracted"
echo ""

# Verify manifest exists
if [ -f "${TARGET_DIR}/manifest.json" ]; then
    echo "✅ Done! Extension ready at:"
    echo "   ${TARGET_DIR}"
    echo ""
    echo "Next steps on your laptop:"
    echo "  1. Open Chrome → chrome://extensions/"
    echo "  2. Enable 'Developer mode' (top right)"
    echo "  3. Click 'Load unpacked'"
    echo "  4. Select: ${TARGET_DIR}"
    echo "  5. Pin it, grant file URL access, done!"
else
    echo "❌ Something went wrong — manifest.json not found in ${TARGET_DIR}"
    exit 1
fi
