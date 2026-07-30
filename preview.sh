#!/usr/bin/env bash
set -euo pipefail

readonly REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PREVIEW_HOST="${PREVIEW_HOST:-127.0.0.1}"
readonly PREVIEW_PORT="${PREVIEW_PORT:-1313}"

if [[ ! "${PREVIEW_PORT}" =~ ^[0-9]+$ ]] ||
  ((PREVIEW_PORT < 1 || PREVIEW_PORT > 65535)); then
  echo "PREVIEW_PORT must be a number from 1 to 65535." >&2
  exit 1
fi

cd "${REPO_ROOT}"

echo "Building and checking the site before local preview..."
./build.sh
python3 scripts/check_site.py public

export PATH="${REPO_ROOT}/.build-tools/hugo:${REPO_ROOT}/.build-tools/dart-sass:${PATH}"

echo "Starting local preview at http://${PREVIEW_HOST}:${PREVIEW_PORT}/"
echo "Nothing is uploaded. Press Ctrl-C after review."
exec hugo server \
  --bind "${PREVIEW_HOST}" \
  --port "${PREVIEW_PORT}" \
  --baseURL "http://${PREVIEW_HOST}:${PREVIEW_PORT}/" \
  --disableFastRender \
  --noBuildLock
