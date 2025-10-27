#!/usr/bin/env bash
set -euo pipefail

#------------------------------------------------------------------------------
# Cloudflare Pages build script for Hugo
# Simplified version — no manual dependency installs required
#------------------------------------------------------------------------------

echo "⚙️ Using preinstalled Hugo from Cloudflare environment..."
echo "Building site..."

# Use default Cloudflare Hugo binary
hugo --gc --minify

echo "✅ Hugo build finished successfully."