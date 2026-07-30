#!/usr/bin/env bash
set -euo pipefail

readonly HUGO_VERSION="0.152.2"
readonly DART_SASS_VERSION="1.93.2"
readonly REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly TOOL_ROOT="${REPO_ROOT}/.build-tools"
export PATH="${TOOL_ROOT}/hugo:${TOOL_ROOT}/dart-sass:${PATH}"

hugo_version_matches() {
  command -v hugo >/dev/null 2>&1 &&
    hugo version | grep -q "v${HUGO_VERSION}.*+extended"
}

sass_version_matches() {
  command -v sass >/dev/null 2>&1 &&
    [[ "$(sass --version)" == "${DART_SASS_VERSION}" ]]
}

install_pinned_tools() {
  local platform
  local hugo_archive
  local sass_archive
  local download_dir

  case "$(uname -s)-$(uname -m)" in
    Linux-x86_64)
      platform="linux"
      hugo_archive="hugo_extended_${HUGO_VERSION}_linux-amd64.tar.gz"
      sass_archive="dart-sass-${DART_SASS_VERSION}-linux-x64.tar.gz"
      ;;
    Darwin-arm64)
      platform="macos"
      hugo_archive="hugo_extended_${HUGO_VERSION}_darwin-universal.tar.gz"
      sass_archive="dart-sass-${DART_SASS_VERSION}-macos-arm64.tar.gz"
      ;;
    Darwin-x86_64)
      platform="macos"
      hugo_archive="hugo_extended_${HUGO_VERSION}_darwin-universal.tar.gz"
      sass_archive="dart-sass-${DART_SASS_VERSION}-macos-x64.tar.gz"
      ;;
    *)
      echo "Unsupported platform: $(uname -s)-$(uname -m)" >&2
      exit 1
      ;;
  esac

  download_dir="$(mktemp -d "${TMPDIR:-/tmp}/evan-hugo-build.XXXXXX")"
  trap "$(printf 'rm -rf -- %q' "${download_dir}")" EXIT

  if ! hugo_version_matches; then
    echo "Downloading Hugo Extended ${HUGO_VERSION}..."
    mkdir -p "${TOOL_ROOT}/hugo"
    curl --fail --location --silent --show-error --retry 3 \
      --connect-timeout 20 --max-time 180 \
      "https://github.com/gohugoio/hugo/releases/download/v${HUGO_VERSION}/${hugo_archive}" \
      -o "${download_dir}/${hugo_archive}"
    tar -xzf "${download_dir}/${hugo_archive}" -C "${TOOL_ROOT}/hugo"
  fi

  if ! sass_version_matches; then
    echo "Downloading Dart Sass ${DART_SASS_VERSION}..."
    mkdir -p "${TOOL_ROOT}/dart-sass"
    curl --fail --location --silent --show-error --retry 3 \
      --connect-timeout 20 --max-time 180 \
      "https://github.com/sass/dart-sass/releases/download/${DART_SASS_VERSION}/${sass_archive}" \
      -o "${download_dir}/${sass_archive}"
    tar -xzf "${download_dir}/${sass_archive}" -C "${download_dir}"
    cp -R "${download_dir}/dart-sass/." "${TOOL_ROOT}/dart-sass/"
  fi

  echo "Installed pinned Hugo and Dart Sass tools for ${platform}."
  rm -rf -- "${download_dir}"
  trap - EXIT
}

main() {
  cd "${REPO_ROOT}"

  if ! hugo_version_matches || ! sass_version_matches; then
    install_pinned_tools
  fi

  echo "Hugo: $(hugo version)"
  echo "Dart Sass: $(sass --version)"
  hugo --gc --minify --cleanDestinationDir --noBuildLock
}

main "$@"
