#!/usr/bin/env python3
"""Regression tests for the repository change classifier."""

from __future__ import annotations

import unittest

from classify_changes import classify_path, result_payload


class ClassifyChangesTests(unittest.TestCase):
    def test_content_requires_preview(self) -> None:
        payload = result_payload(["content/about.md"])
        self.assertTrue(payload["preview_required"])
        self.assertEqual(classify_path("content/about.md"), "website-content")

    def test_presentation_requires_preview(self) -> None:
        payload = result_payload(["assets/scss/site/_site.scss", "hugo.toml"])
        self.assertTrue(payload["preview_required"])
        self.assertEqual(
            classify_path("layouts/_default/baseof.html"),
            "website-presentation",
        )

    def test_runtime_only_skips_visual_preview(self) -> None:
        payload = result_payload(
            ["AGENTS.md", ".github/workflows/site-check.yml", "preview.sh"]
        )
        self.assertFalse(payload["preview_required"])
        self.assertFalse(payload["manual_classification_required"])

    def test_unknown_path_requires_manual_classification(self) -> None:
        payload = result_payload(["new-system/config.yaml"])
        self.assertFalse(payload["preview_required"])
        self.assertTrue(payload["manual_classification_required"])
        self.assertEqual(classify_path("new-system/config.yaml"), "unclassified")


if __name__ == "__main__":
    unittest.main()
