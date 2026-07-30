# AI Maintenance Contract

This repository is the source of truth for `https://evan-manual.com/`. Keep it
small, reproducible, and safe for long-term AI maintenance.

## Change policy

- Work on a `codex/` branch. Do not push directly to `main`.
- Do not push a change to GitHub before Evan has reviewed its local Hugo
  preview and explicitly approved the push.
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

- `content/`: Evan's pages and articles. Article bundles keep their cover image
  beside `index.md`.
- `layouts/`: site-specific Hugo templates. These override the base theme.
- `assets/scss/site/_site.scss`: current site-specific visual rules.
- `assets/scss/custom.scss`: the stable SCSS entry point; keep it small.
- `assets/js/`: site-specific browser behavior.
- `themes/evan/`: the lightweight local base theme derived from Anatole 1.18.0.
- `static/`: files copied to the site without processing.
- `config/_default/`: navigation and site parameters.
- `scripts/check_site.py`: generated-site internal link and asset validation.

## Required verification

Run both commands before reporting a change as ready:

```bash
./build.sh
python3 scripts/check_site.py public
```

For template or style changes, also inspect at least the home, article, About,
and Contact pages at desktop and mobile widths. Compare against the current
production appearance unless the requested change intentionally alters it.

## Deployment boundary

GitHub `main` is the production source. Cloudflare builds from GitHub. Use this
review sequence for every user-visible change:

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
