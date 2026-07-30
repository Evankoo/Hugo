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
