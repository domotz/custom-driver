#!/usr/bin/env python3
"""Walk ../examples/**/*.json and emit index.json for the editor sidebar.

The editor SPA needs a lightweight per-companion summary so it can populate
the left rail and filter chips without parsing all 245 files in the browser.
This script is one-shot: run once before starting serve.py, and again whenever
companions are added/removed/renamed.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

EDITOR_DIR = Path(__file__).resolve().parent
REPO_ROOT = EDITOR_DIR.parent
EXAMPLES_DIR = REPO_ROOT / "examples"
INDEX_PATH = EDITOR_DIR / "index.json"


def summarise(path: Path) -> dict:
    try:
        data = json.loads(path.read_text())
    except json.JSONDecodeError as exc:
        print(f"skip {path.relative_to(REPO_ROOT)}: {exc}", file=sys.stderr)
        return {}
    if not isinstance(data, dict):
        return {}
    rel = path.relative_to(REPO_ROOT).as_posix()
    protocol_dir = path.parent.name
    return {
        "path": rel,
        "basename": path.stem,
        "name": data.get("name") or path.stem,
        "category": data.get("category") or "",
        "protocols": data.get("protocols") or [],
        "protocol_dir": protocol_dir,
        "tested_on": data.get("tested_on") or [],
        "has_compatibility": "compatibility" in data,
    }


def main() -> int:
    if not EXAMPLES_DIR.is_dir():
        print(f"examples dir not found: {EXAMPLES_DIR}", file=sys.stderr)
        return 1

    entries = []
    for path in sorted(EXAMPLES_DIR.rglob("*.json")):
        entry = summarise(path)
        if entry:
            entries.append(entry)

    entries.sort(key=lambda e: (e["protocol_dir"], e["basename"]))

    categories = sorted({e["category"] for e in entries if e["category"]})
    protocol_dirs = sorted({e["protocol_dir"] for e in entries})

    INDEX_PATH.write_text(json.dumps({
        "count": len(entries),
        "categories": categories,
        "protocol_dirs": protocol_dirs,
        "entries": entries,
    }, indent=2))
    print(f"wrote {INDEX_PATH} ({len(entries)} companions)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
