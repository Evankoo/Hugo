#!/usr/bin/env bash

#------------------------------------------------------------------------------
# @file
# Builds a Hugo site hosted on a Cloudflare Worker.
#
# Works both on Cloudflare's Linux builders and on local macOS Apple Silicon
# machines used for manual deploys.
#------------------------------------------------------------------------------

main() {

  DART_SASS_VERSION=1.93.2
  GO_VERSION=1.25.3
  HUGO_VERSION=0.152.2
  NODE_VERSION=22.20.0

  export TZ=Europe/Oslo

  OS="$(uname -s)"
  ARCH="$(uname -m)"
  LOCAL_DIR="${HOME}/.local"

  mkdir -p "${LOCAL_DIR}"

  case "${OS}-${ARCH}" in
    Linux-x86_64)
      DART_SASS_URL="https://github.com/sass/dart-sass/releases/download/${DART_SASS_VERSION}/dart-sass-${DART_SASS_VERSION}-linux-x64.tar.gz"
      GO_URL="https://go.dev/dl/go${GO_VERSION}.linux-amd64.tar.gz"
      HUGO_URL="https://github.com/gohugoio/hugo/releases/download/v${HUGO_VERSION}/hugo_extended_${HUGO_VERSION}_linux-amd64.tar.gz"
      NODE_URL="https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz"
      NODE_DIR_NAME="node-v${NODE_VERSION}-linux-x64"
      ;;
    Darwin-arm64)
      DART_SASS_URL="https://github.com/sass/dart-sass/releases/download/${DART_SASS_VERSION}/dart-sass-${DART_SASS_VERSION}-macos-arm64.tar.gz"
      GO_URL="https://go.dev/dl/go${GO_VERSION}.darwin-arm64.tar.gz"
      HUGO_URL="https://github.com/gohugoio/hugo/releases/download/v${HUGO_VERSION}/hugo_extended_${HUGO_VERSION}_darwin-universal.tar.gz"
      NODE_URL="https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-darwin-arm64.tar.xz"
      NODE_DIR_NAME="node-v${NODE_VERSION}-darwin-arm64"
      ;;
    Darwin-x86_64)
      DART_SASS_URL="https://github.com/sass/dart-sass/releases/download/${DART_SASS_VERSION}/dart-sass-${DART_SASS_VERSION}-macos-x64.tar.gz"
      GO_URL="https://go.dev/dl/go${GO_VERSION}.darwin-amd64.tar.gz"
      HUGO_URL="https://github.com/gohugoio/hugo/releases/download/v${HUGO_VERSION}/hugo_extended_${HUGO_VERSION}_darwin-universal.tar.gz"
      NODE_URL="https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-darwin-x64.tar.xz"
      NODE_DIR_NAME="node-v${NODE_VERSION}-darwin-x64"
      ;;
    *)
      echo "Unsupported platform: ${OS}-${ARCH}" >&2
      exit 1
      ;;
  esac

  echo "Platform detected: ${OS}-${ARCH}"

  # Clean old tool dirs to avoid mixing architectures.
  rm -rf "${LOCAL_DIR}/dart-sass" "${LOCAL_DIR}/go" "${LOCAL_DIR}/hugo" "${LOCAL_DIR}/${NODE_DIR_NAME}"

  # Install Dart Sass
  echo "Installing Dart Sass ${DART_SASS_VERSION}..."
  curl -sLJO "${DART_SASS_URL}"
  tar -C "${LOCAL_DIR}" -xf "$(basename "${DART_SASS_URL}")"
  rm "$(basename "${DART_SASS_URL}")"
  export PATH="${LOCAL_DIR}/dart-sass:${PATH}"

  # Install Go
  echo "Installing Go ${GO_VERSION}..."
  curl -sLJO "${GO_URL}"
  tar -C "${LOCAL_DIR}" -xf "$(basename "${GO_URL}")"
  rm "$(basename "${GO_URL}")"
  export PATH="${LOCAL_DIR}/go/bin:${PATH}"

  # Install Hugo
  echo "Installing Hugo ${HUGO_VERSION}..."
  curl -sLJO "${HUGO_URL}"
  mkdir -p "${LOCAL_DIR}/hugo"
  tar -C "${LOCAL_DIR}/hugo" -xf "$(basename "${HUGO_URL}")"
  rm "$(basename "${HUGO_URL}")"
  export PATH="${LOCAL_DIR}/hugo:${PATH}"

  # Install Node.js
  echo "Installing Node.js ${NODE_VERSION}..."
  curl -sLJO "${NODE_URL}"
  tar -C "${LOCAL_DIR}" -xf "$(basename "${NODE_URL}")"
  rm "$(basename "${NODE_URL}")"
  export PATH="${LOCAL_DIR}/${NODE_DIR_NAME}/bin:${PATH}"

  # Verify installations
  echo "Verifying installations..."
  echo Dart Sass: "$(sass --version)"
  echo Go: "$(go version)"
  echo Hugo: "$(hugo version)"
  echo Node.js: "$(node --version)"

  # Configure Git
  echo "Configuring Git..."
  git config core.quotepath false
  if [ "$(git rev-parse --is-shallow-repository)" = "true" ]; then
    git fetch --unshallow
  fi

  # Build the site
  echo "Building the site..."
  HUGO_MARKUP_GOLDMARK_RENDERER_UNSAFE=true hugo --gc --minify

}

set -euo pipefail
main "$@"
