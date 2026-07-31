# Evan Manual

The source for [evan-manual.com](https://evan-manual.com/), built with Hugo and
deployed as static assets on Cloudflare.

## Local development

The repository pins Hugo Extended `0.152.2` and Dart Sass `1.93.2`. The build
script uses matching local tools when available and otherwise downloads only
those two tools into the ignored `.build-tools/` directory.

```bash
./build.sh
python3 scripts/check_site.py public
hugo server
```

Generated output belongs in `public/` and is never committed.

## Article image pipeline

Each article bundle keeps one canonical cover image beside `index.md`. Use a
unique, descriptive filename, set both `image` and `thumbnail` to that file in
front matter, and keep the source image at no more than `1600px` on its longest
edge. JPEG is preferred for paintings and photographs; aim for a source file
below roughly `800KB` when it can be achieved without visible artifacts.

Hugo generates the delivery files during the build:

- Home gallery thumbnails: `480px` and `720px` wide WebP at quality 78, with
  responsive `srcset`; only the first card is eager-loaded.
- Sidebar gallery images: `720px` wide WebP at quality 82; JavaScript loads only
  the current image.
- Article pages: do not repeat the cover above the body. Hugo crops the
  canonical cover to a `400px` square JPEG with a stable `/images/share/`
  URL for social sharing.
- Non-article pages use `static/images/share-default-400.jpg` as the shared
  brand thumbnail. The mobile header exposes one share control on every page;
  it uses the system share sheet when available, shows WeChat forwarding
  guidance inside WeChat, and falls back to copying the current URL.

Do not hand-maintain separate thumbnail or gallery files. The generated image
cache belongs in `resources/` and must not be committed.

## Preview before pushing

Every user-visible change is reviewed through Hugo's local development server
before it is pushed to GitHub:

```bash
./preview.sh
```

The command builds and checks the site, then serves it at
`http://127.0.0.1:1313/`. It uploads nothing and keeps running while Evan
reviews the pages. Stop it with `Ctrl-C` after review. Only after Evan approves
the local preview should the current `codex/` branch be pushed.

The port can be changed if another local service already uses `1313`:

```bash
PREVIEW_PORT=1414 ./preview.sh
```

Use a remote preview only when review is needed from another device or network.
Documentation, maintenance tooling, CI, and other repository-only changes do
not need a browser preview when they do not alter the generated site; they
still require the relevant automated checks before merging.

## Change classification

The repository stays unified but has three ownership layers:

```text
Website content       content/ and article-bundle media
Website presentation  layouts/, assets/, themes/, static/, config/, hugo.toml
Project runtime       scripts/, .github/, build.sh, preview.sh, wrangler.toml,
                      .gitignore, AGENTS.md, README.md
```

Classify the current working-tree changes before review:

```bash
python3 scripts/classify_changes.py
```

Content or presentation changes require local Hugo preview and Evan's approval.
Runtime-only changes require the relevant automated checks but no visual
preview. Unknown paths must be classified explicitly before push. `AGENTS.md`
is the authoritative maintenance contract.

## Two-computer maintenance

The MacBook Pro and Mac mini each keep a local clone; GitHub is the shared
source of truth. Before starting a change, fetch the remote and create a
task-specific `codex/` branch from the current `origin/main`. Do not work on the
same branch from both computers at once. After an approved push, the other Mac
may fast-forward only when its worktree is clean; dirty or divergent state
requires explicit reconciliation.

## Structure

```text
content/              Pages and article bundles
layouts/              Site-specific templates
assets/scss/          Site-specific styles
assets/js/            Site-specific scripts
themes/evan/          Lightweight local base theme
static/               Pass-through static files
config/_default/      Menus and site parameters
scripts/              Change classification and build verification
```

See `AGENTS.md` before making automated changes.
