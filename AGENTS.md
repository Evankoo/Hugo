# AI Maintenance Contract

This repository is the source of truth for `https://evan-manual.com/`. Keep it
small, reproducible, and safe for long-term AI maintenance.

## Change policy

- Work on a `codex/` branch. Do not push directly to `main`.
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

GitHub `main` is the production source. Cloudflare builds from GitHub. Branches
and pull requests are review surfaces; merging to `main` is the production
release action. Platform tokens belong in GitHub or Cloudflare secrets, never in
this repository.
