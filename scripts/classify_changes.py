#!/usr/bin/env python3
"""Classify repository changes by ownership and Hugo preview requirements."""

from __future__ import annotations

import argparse
import json
import subprocess
from collections import defaultdict
from pathlib import Path


CONTENT_PREFIXES = ("content/",)
PRESENTATION_PREFIXES = (
    "assets/",
    "config/",
    "data/",
    "i18n/",
    "layouts/",
    "static/",
    "themes/",
)
PRESENTATION_FILES = {"go.mod", "go.sum", "hugo.toml"}
RUNTIME_PREFIXES = (".github/", "archetypes/", "scripts/")
RUNTIME_FILES = {
    ".gitignore",
    "AGENTS.md",
    "LICENSE",
    "README.md",
    "build.sh",
    "preview.sh",
    "wrangler.toml",
}
CATEGORY_LABELS = {
    "website-content": "Website content",
    "website-presentation": "Website presentation",
    "project-runtime": "Project runtime",
    "unclassified": "Unclassified",
}


def normalize_path(raw_path: str) -> str:
    path = raw_path.strip().replace("\\", "/")
    while path.startswith("./"):
        path = path[2:]
    return path


def classify_path(raw_path: str) -> str:
    path = normalize_path(raw_path)
    if path.startswith(CONTENT_PREFIXES):
        return "website-content"
    if path in PRESENTATION_FILES or path.startswith(PRESENTATION_PREFIXES):
        return "website-presentation"
    if path in RUNTIME_FILES or path.startswith(RUNTIME_PREFIXES):
        return "project-runtime"
    return "unclassified"


def git_lines(*args: str) -> list[str]:
    result = subprocess.run(
        ["git", *args],
        check=True,
        capture_output=True,
        text=True,
    )
    return [line for line in result.stdout.splitlines() if line.strip()]


def changed_paths(base: str | None, head: str) -> list[str]:
    if base:
        if set(base) == {"0"}:
            return git_lines(
                "diff-tree",
                "--root",
                "--no-commit-id",
                "--name-only",
                "-r",
                head,
            )
        return git_lines("diff", "--name-only", base, head)

    paths = git_lines("diff", "--name-only", "HEAD")
    paths.extend(git_lines("ls-files", "--others", "--exclude-standard"))
    return sorted(set(paths))


def classify(paths: list[str]) -> dict[str, list[str]]:
    grouped: dict[str, list[str]] = defaultdict(list)
    for raw_path in paths:
        path = normalize_path(raw_path)
        if path:
            grouped[classify_path(path)].append(path)
    return {
        category: sorted(set(grouped.get(category, [])))
        for category in CATEGORY_LABELS
    }


def result_payload(paths: list[str]) -> dict[str, object]:
    categories = classify(paths)
    preview_required = bool(
        categories["website-content"] or categories["website-presentation"]
    )
    return {
        "preview_required": preview_required,
        "manual_classification_required": bool(categories["unclassified"]),
        "categories": categories,
    }


def render_text(payload: dict[str, object]) -> str:
    categories = payload["categories"]
    assert isinstance(categories, dict)
    lines = [
        f"Hugo preview required: {'yes' if payload['preview_required'] else 'no'}",
        "Manual classification required: "
        f"{'yes' if payload['manual_classification_required'] else 'no'}",
    ]
    for category, label in CATEGORY_LABELS.items():
        paths = categories[category]
        if paths:
            lines.append(f"{label}:")
            lines.extend(f"  - {path}" for path in paths)
    return "\n".join(lines)


def render_markdown(payload: dict[str, object]) -> str:
    categories = payload["categories"]
    assert isinstance(categories, dict)
    lines = [
        "## Change classification",
        "",
        f"- Hugo preview required: **"
        f"{'yes' if payload['preview_required'] else 'no'}**",
        "- Manual classification required: **"
        f"{'yes' if payload['manual_classification_required'] else 'no'}**",
    ]
    for category, label in CATEGORY_LABELS.items():
        paths = categories[category]
        if paths:
            lines.extend(["", f"### {label}", ""])
            lines.extend(f"- `{path}`" for path in paths)
    return "\n".join(lines)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Classify Hugo repository changes and preview requirements."
    )
    parser.add_argument("paths", nargs="*", help="Paths to classify directly.")
    parser.add_argument("--base", help="Git base revision for comparison.")
    parser.add_argument("--head", default="HEAD", help="Git head revision.")
    parser.add_argument(
        "--format",
        choices=("json", "markdown", "text"),
        default="text",
        help="Output format.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    paths = args.paths or changed_paths(args.base, args.head)
    payload = result_payload(paths)
    if args.format == "json":
        print(json.dumps(payload, ensure_ascii=False, indent=2))
    elif args.format == "markdown":
        print(render_markdown(payload))
    else:
        print(render_text(payload))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
