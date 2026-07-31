#!/usr/bin/env python3
"""Validate generated internal links and assets using only the standard library."""

from __future__ import annotations

import argparse
import json
import re
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
        attributes = dict(attrs)
        attribute = "href" if tag in {"a", "link"} else "src" if tag in {
            "img",
            "script",
            "source",
        } else None
        if attribute:
            value = attributes.get(attribute)
            if value:
                self.references.append(value)

        srcset = attributes.get("srcset")
        if srcset:
            for candidate in srcset.split(","):
                reference = candidate.strip().split()[0]
                if reference:
                    self.references.append(reference)


class GalleryImageParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.images: list[dict[str, str | None]] = []

    def handle_starttag(
        self, tag: str, attrs: list[tuple[str, str | None]]
    ) -> None:
        if tag != "img":
            return
        attributes = dict(attrs)
        classes = (attributes.get("class") or "").split()
        if "gallery-card__image" in classes:
            self.images.append(attributes)


def validate_gallery_images(site: Path) -> list[str]:
    errors: list[str] = []
    paginated = [
        page
        for page in sorted((site / "page").glob("*/index.html"))
        if page.parent.name != "1"
    ]
    gallery_pages = [site / "index.html", *paginated]

    for page in gallery_pages:
        parser = GalleryImageParser()
        parser.feed(page.read_text(encoding="utf-8"))
        if not parser.images:
            errors.append(f"missing gallery images: {page.relative_to(site)}")
            continue

        for index, image in enumerate(parser.images):
            source = image.get("src") or ""
            if not urlsplit(source).path.endswith(".webp"):
                errors.append(f"gallery image is not WebP: {page.relative_to(site)} -> {source}")

            candidates = image.get("srcset") or ""
            descriptors = {item.strip().split()[-1] for item in candidates.split(",") if item.strip()}
            if descriptors != {"480w", "720w"}:
                errors.append(
                    f"gallery srcset is not 480w/720w: {page.relative_to(site)} -> {candidates}"
                )

            expected_loading = "eager" if index == 0 else "lazy"
            if image.get("loading") != expected_loading:
                errors.append(
                    f"gallery loading mismatch: {page.relative_to(site)} item {index + 1}"
                )
            if image.get("decoding") != "async":
                errors.append(
                    f"gallery decoding mismatch: {page.relative_to(site)} item {index + 1}"
                )

    homepage = (site / "index.html").read_text(encoding="utf-8")
    covers_match = re.search(r"window\.EVAN_COVERS=(\[[^;]*\]);?", homepage)
    if not covers_match:
        errors.append("missing window.EVAN_COVERS gallery data")
    else:
        covers = json.loads(covers_match.group(1))
        if not covers or any(not urlsplit(cover).path.endswith(".webp") for cover in covers):
            errors.append("sidebar gallery must use generated WebP images")

    return errors


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

    image_errors = validate_gallery_images(site)
    if image_errors:
        for error in image_errors:
            print(error)
        return 1

    print(f"site check passed: {len(pages)} HTML pages, {checked} internal references")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
