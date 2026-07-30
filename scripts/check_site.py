#!/usr/bin/env python3
"""Validate generated internal links and assets using only the standard library."""

from __future__ import annotations

import argparse
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit


class ReferenceParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.references: list[str] = []

    def handle_starttag(
        self, tag: str, attrs: list[tuple[str, str | None]]
    ) -> None:
        attribute = "href" if tag in {"a", "link"} else "src" if tag in {
            "img",
            "script",
            "source",
        } else None
        if not attribute:
            return
        value = dict(attrs).get(attribute)
        if value:
            self.references.append(value)


def resolve_reference(site: Path, page: Path, reference: str) -> Path | None:
    parsed = urlsplit(reference)
    if parsed.scheme or parsed.netloc or reference.startswith("//") or not parsed.path:
        return None

    decoded = unquote(parsed.path)
    candidate = site / decoded.lstrip("/") if decoded.startswith("/") else page.parent / decoded
    if decoded.endswith("/"):
        candidate = candidate / "index.html"
    elif not candidate.suffix:
        candidate = candidate / "index.html"
    return candidate.resolve()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("site", nargs="?", default="public")
    args = parser.parse_args()

    site = Path(args.site).resolve()
    required = [
        site / "index.html",
        site / "about/index.html",
        site / "contact/index.html",
        site / "post/index.html",
        site / "sitemap.xml",
        site / "robots.txt",
    ]
    missing_required = [path for path in required if not path.is_file()]
    if missing_required:
        for path in missing_required:
            print(f"missing required output: {path.relative_to(site)}")
        return 1

    broken: set[tuple[Path, str]] = set()
    checked = 0
    pages = sorted(site.rglob("*.html"))
    for page in pages:
        references = ReferenceParser()
        references.feed(page.read_text(encoding="utf-8"))
        for reference in references.references:
            target = resolve_reference(site, page, reference)
            if target is None:
                continue
            checked += 1
            try:
                target.relative_to(site)
            except ValueError:
                broken.add((page, reference))
                continue
            if not target.exists():
                broken.add((page, reference))

    if broken:
        for page, reference in sorted(broken):
            print(f"broken: {page.relative_to(site)} -> {reference}")
        return 1

    print(f"site check passed: {len(pages)} HTML pages, {checked} internal references")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
