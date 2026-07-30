# AI Maintenance Contract

This repository is the source of truth for `https://evan-manual.com/`. Keep it
small, reproducible, and safe for long-term AI maintenance.

## Change policy

- Work on a `codex/` branch. Do not push directly to `main`.
- For page-facing changes, do not push before Evan has reviewed the local Hugo
  preview and explicitly approved the result.
- Before editing on either Mac, fetch `origin` and start from the current remote
  state. Do not edit the same branch concurrently on both computers.
- If a worktree is dirty, divergent, or cannot fast-forward, stop and reconcile
  it explicitly. Never auto-stash, reset, force-push, or overwrite the other
  Mac's work.
- Preserve the current visual design unless Evan explicitly requests a redesign.
- Keep content, templates, styles, and generated files in their owned directories.
- Never commit `public/`, `resources/`, `.wrangler/`, `.build-tools/`, Hugo lock
  files, editor swap files, credentials, or Cloudflare secrets.
- Do not restore the removed English demo site. Add another language only when
  real translated content and navigation exist.
- Do not replace Hugo or introduce a JavaScript application framework without an
  explicit architecture decision.

## Repository map

Keep the single repository divided by ownership:

- Website content layer: `content/` and article-bundle media beside `index.md`.
- Website presentation layer: `layouts/`, `assets/`, `themes/evan/`, `static/`,
  `config/`, `hugo.toml`, and any future `data/` or `i18n/` directories.
- Project runtime layer: `scripts/`, `.github/`, `build.sh`, `preview.sh`,
  `wrangler.toml`, `.gitignore`, `AGENTS.md`, and `README.md`.

Do not move GStudio task cards, task inputs, delivery artifacts, local caches,
or credentials into this repository.

`scripts/classify_changes.py` is the executable change classifier. Run it
before deciding whether visual review is required:

```bash
python3 scripts/classify_changes.py
```

Unknown paths require explicit classification before push; do not silently
treat them as runtime-only changes.

## Required verification

Run both commands before reporting a change as ready:

```bash
python3 scripts/test_classify_changes.py
./build.sh
python3 scripts/check_site.py public
```

For template or style changes, also inspect at least the home, article, About,
and Contact pages at desktop and mobile widths. Compare against the current
production appearance unless the requested change intentionally alters it.

## Deployment boundary

GitHub `main` is the production source. Cloudflare builds from GitHub. Use this
review sequence for changes to content, images, navigation, templates, styles,
or browser JavaScript:

1. Make and verify the change locally on a `codex/` branch.
2. Run `./preview.sh` and keep the local Hugo server running.
3. Send Evan the local Preview URL and a concise change summary.
4. Wait for Evan's explicit approval before pushing the Git branch.
5. Merge to `main` only after the approved branch checks pass.
6. Verify the production site after Cloudflare deploys `main`.

The default preview stays on this computer and must not upload source or
generated files. Use a remote preview only when Evan explicitly needs access
from another device or network. Do not run `wrangler deploy` or
`wrangler versions deploy` as part of local preview creation. Platform tokens
belong in local Cloudflare authentication, GitHub secrets, or Cloudflare
settings, never in this repository.

Project-runtime-only changes do not require a browser preview when the generated
site is unchanged. Run the relevant technical checks, then push and merge
through the protected `main` workflow. Deployment settings such as routes and
domains require an explicit impact statement even though Hugo preview cannot
validate them.
