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
scripts/              Build verification
```

See `AGENTS.md` before making automated changes.
