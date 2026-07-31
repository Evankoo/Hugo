#!/usr/bin/env python3
"""Validate generated internal links and assets using only the standard library."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit


REPO_ROOT = Path(__file__).resolve().parents[1]


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


class SocialMetaParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.metadata: dict[str, str] = {}

    def handle_starttag(
        self, tag: str, attrs: list[tuple[str, str | None]]
    ) -> None:
        if tag != "meta":
            return
        attributes = dict(attrs)
        key = attributes.get("property") or attributes.get("name")
        content = attributes.get("content")
        if key and content:
            self.metadata[key] = content


class ShareButtonParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.attributes: dict[str, str | None] = {}

    def handle_starttag(
        self, tag: str, attrs: list[tuple[str, str | None]]
    ) -> None:
        if tag != "button" or self.attributes:
            return
        attributes = dict(attrs)
        if "navbar-share" in (attributes.get("class") or "").split():
            self.attributes = attributes


def jpeg_dimensions(path: Path) -> tuple[int, int] | None:
    data = path.read_bytes()
    if not data.startswith(b"\xff\xd8"):
        return None

    offset = 2
    start_of_frame = {
        0xC0, 0xC1, 0xC2, 0xC3,
        0xC5, 0xC6, 0xC7,
        0xC9, 0xCA, 0xCB,
        0xCD, 0xCE, 0xCF,
    }
    while offset + 4 <= len(data):
        if data[offset] != 0xFF:
            offset += 1
            continue
        while offset < len(data) and data[offset] == 0xFF:
            offset += 1
        if offset >= len(data):
            break
        marker = data[offset]
        offset += 1
        if marker in {0xD8, 0xD9}:
            continue
        if offset + 2 > len(data):
            break
        segment_length = int.from_bytes(data[offset : offset + 2], "big")
        if segment_length < 2 or offset + segment_length > len(data):
            break
        if marker in start_of_frame and segment_length >= 7:
            height = int.from_bytes(data[offset + 3 : offset + 5], "big")
            width = int.from_bytes(data[offset + 5 : offset + 7], "big")
            return width, height
        offset += segment_length
    return None


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def canonical_article_covers() -> list[tuple[Path, str]]:
    covers: list[tuple[Path, str]] = []
    for index in sorted((REPO_ROOT / "content/post").glob("*/index.md")):
        source = index.read_text(encoding="utf-8")
        front_matter = source.split("---", 2)
        if len(front_matter) < 3:
            continue
        match = re.search(r"^image:\s*[\"']?([^\"'\n]+)", front_matter[1], re.MULTILINE)
        if not match:
            continue
        cover = index.parent / match.group(1).strip()
        if cover.is_file():
            covers.append((cover, file_sha256(cover)))
    return covers


def validate_cover_usage() -> list[str]:
    errors: list[str] = []
    cover_hashes: dict[str, Path] = {}
    for cover, digest in canonical_article_covers():
        previous = cover_hashes.get(digest)
        if previous:
            errors.append(
                f"duplicate canonical cover: {previous.relative_to(REPO_ROOT)} and "
                f"{cover.relative_to(REPO_ROOT)}"
            )
        else:
            cover_hashes[digest] = cover

    registry_path = REPO_ROOT / "data/cover-usage.json"
    if not registry_path.is_file():
        return errors
    try:
        registry = json.loads(registry_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as error:
        return [*errors, f"invalid cover registry: {error}"]

    library = Path(os.environ.get("EVAN_COVER_LIBRARY") or registry.get("library_root", ""))
    seen_sources: dict[str, str] = {}
    seen_articles: set[str] = set()
    required = {
        "article_slug",
        "bundle_cover",
        "selected_at",
        "source_filename",
        "source_sha256",
    }
    for position, selection in enumerate(registry.get("selections", []), start=1):
        missing = sorted(required - selection.keys())
        if missing:
            errors.append(f"cover registry entry {position} missing: {', '.join(missing)}")
            continue
        article = selection["article_slug"]
        digest = selection["source_sha256"]
        if digest in seen_sources:
            errors.append(
                f"cover selected more than once: {seen_sources[digest]} and {article}"
            )
        else:
            seen_sources[digest] = article
        if article in seen_articles:
            errors.append(f"article has multiple registered covers: {article}")
        seen_articles.add(article)

        bundle_cover = REPO_ROOT / selection["bundle_cover"]
        if not bundle_cover.is_file():
            errors.append(f"registered bundle cover is missing: {selection['bundle_cover']}")
        elif file_sha256(bundle_cover) != digest:
            errors.append(f"registered bundle cover digest changed: {selection['bundle_cover']}")

        if library.is_dir():
            source = library / selection["source_filename"]
            if not source.is_file():
                errors.append(f"registered NAS cover is missing: {source}")
            elif file_sha256(source) != digest:
                errors.append(f"registered NAS cover digest changed: {source}")

    return errors


def validate_social_previews(site: Path) -> list[str]:
    errors: list[str] = []
    article_pages = sorted((site / "post").glob("*/index.html"))
    required = {
        "og:title",
        "og:description",
        "og:url",
        "og:image",
        "og:image:width",
        "og:image:height",
        "og:image:type",
    }

    for page in article_pages:
        parser = SocialMetaParser()
        parser.feed(page.read_text(encoding="utf-8"))
        missing = sorted(required - parser.metadata.keys())
        if missing:
            errors.append(
                f"missing social metadata: {page.relative_to(site)} -> {', '.join(missing)}"
            )
            continue

        if parser.metadata.get("og:type") != "article":
            errors.append(f"social type is not article: {page.relative_to(site)}")

        image = urlsplit(parser.metadata["og:image"])
        if image.scheme != "https" or not image.netloc:
            errors.append(
                f"social image is not an absolute HTTPS URL: {page.relative_to(site)}"
            )
            continue

        if image.query != "v=1":
            errors.append(
                f"social image cache version is missing: {page.relative_to(site)}"
            )

        image_file = site / unquote(image.path).lstrip("/")
        if not image_file.is_file():
            errors.append(
                f"social image was not generated: {page.relative_to(site)} -> {image.path}"
            )
            continue

        if "_hu_" in image.path:
            errors.append(
                f"social image URL is build-dependent: {page.relative_to(site)} -> {image.path}"
            )

        if parser.metadata.get("og:image:width") != "400" or parser.metadata.get(
            "og:image:height"
        ) != "400":
            errors.append(f"social image metadata is not 400x400: {page.relative_to(site)}")

        if parser.metadata.get("og:image:type") != "image/jpeg":
            errors.append(f"social image metadata is not JPEG: {page.relative_to(site)}")

        if jpeg_dimensions(image_file) != (400, 400):
            errors.append(f"social image file is not 400x400 JPEG: {image_file.relative_to(site)}")

        if image_file.stat().st_size > 80 * 1024:
            errors.append(
                f"social image exceeds 80KB: {image_file.relative_to(site)}"
            )

    return errors


def validate_mobile_share_controls(site: Path) -> list[str]:
    errors: list[str] = []
    pages = [site / "index.html", site / "about/index.html", site / "contact/index.html"]
    article_pages = sorted((site / "post").glob("*/index.html"))
    pages.extend(article_pages)

    for page in pages:
        html = page.read_text(encoding="utf-8")
        parser = ShareButtonParser()
        parser.feed(html)
        if 'class="navbar-share"' not in html and "class=navbar-share" not in html:
            errors.append(f"missing mobile share control: {page.relative_to(site)}")
        required_attributes = (
            "data-share-title=",
            "data-share-description=",
            "data-share-kind=",
            "data-share-image=",
            "data-share-url=",
            "data-share-copy=",
        )
        if any(attribute not in html for attribute in required_attributes):
            errors.append(f"incomplete mobile share data: {page.relative_to(site)}")
        expected_kind = "page"
        if page == site / "index.html":
            expected_kind = "home"
        elif page == site / "about/index.html":
            expected_kind = "about"
        elif page == site / "contact/index.html":
            expected_kind = "contact"
        elif page in article_pages:
            expected_kind = "article"
        quoted_kind = f'data-share-kind="{expected_kind}"'
        compact_kind = f"data-share-kind={expected_kind}"
        if quoted_kind not in html and compact_kind not in html:
            errors.append(
                f"wrong mobile share kind: {page.relative_to(site)} -> {expected_kind}"
            )
        image_source = parser.attributes.get("data-share-image") or ""
        image_path = unquote(urlsplit(image_source).path).lstrip("/")
        if not image_path or not (site / image_path).is_file():
            errors.append(
                f"mobile poster source image is missing: {page.relative_to(site)} -> {image_source}"
            )
        if expected_kind == "article" and not image_path.startswith(
            f"post/{page.parent.name}/"
        ):
            errors.append(
                f"article poster does not use its own cover: {page.relative_to(site)} -> {image_source}"
            )

    scripts = sorted((site / "js").glob("custom*.js"))
    source = "\n".join(script.read_text(encoding="utf-8") for script in scripts)
    source_assets = Path("assets/js/custom.js").read_text(encoding="utf-8")
    for marker in ("drawArticlePoster", "drawAboutPoster"):
        if marker not in source_assets:
            errors.append(f"mobile poster source is missing {marker}")
    for marker in ("__evanSyncShareButton", "qrcode", "正在生成分享图"):
        if marker not in source:
            errors.append(f"mobile poster JavaScript is missing {marker}")

    return errors


def validate_wechat_navigation(site: Path) -> list[str]:
    scripts = sorted((site / "js").glob("custom*.js"))
    if not scripts:
        return ["missing generated custom JavaScript"]

    source = "\n".join(script.read_text(encoding="utf-8") for script in scripts)
    if "MicroMessenger" not in source:
        return ["custom JavaScript does not disable partial navigation in WeChat"]
    return []


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

    cover_usage_errors = validate_cover_usage()
    if cover_usage_errors:
        for error in cover_usage_errors:
            print(error)
        return 1

    social_errors = validate_social_previews(site)
    if social_errors:
        for error in social_errors:
            print(error)
        return 1

    wechat_errors = validate_wechat_navigation(site)
    if wechat_errors:
        for error in wechat_errors:
            print(error)
        return 1

    share_control_errors = validate_mobile_share_controls(site)
    if share_control_errors:
        for error in share_control_errors:
            print(error)
        return 1

    print(f"site check passed: {len(pages)} HTML pages, {checked} internal references")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
