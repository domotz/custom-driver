#!/usr/bin/env python3
"""Tiny stdlib HTTP server for the compatibility editor.

Serves:
- GET /                 → index.html
- GET /index.json       → sidebar manifest produced by build_index.py
- GET /companion?path=… → parsed JSON of one companion (path relative to repo root)
- PUT /apply            → body {path, compatibility}; writes compatibility into the file

All read/write is constrained to ../examples/ to prevent path traversal.
"""
from __future__ import annotations

import argparse
import json
import logging
from collections import OrderedDict
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

log = logging.getLogger("editor")

EDITOR_DIR = Path(__file__).resolve().parent
REPO_ROOT = EDITOR_DIR.parent
EXAMPLES_DIR = REPO_ROOT / "examples"

REQUIRED_ATTRS = ("vendor", "models", "name", "os_family",
                  "firmware_version", "open_ports", "required_mibs")
INT_ATTRS = {"open_ports"}
ALLOWED_QUALIFIERS = {"required", "preferred"}
# os_family is constrained to Domotz's canonical vocabulary. The editor
# renders this as a checkbox group so off-vocabulary tokens can't be entered
# via the UI; the server enforces the same on every PUT for safety.
ALLOWED_OS_FAMILIES = {"windows", "linux", "macos", "esxi", "idrac", "hp_ilo"}


class Handler(BaseHTTPRequestHandler):
    # --- HTTP plumbing --------------------------------------------------

    def log_message(self, fmt, *args):
        log.info("%s - %s", self.address_string(), fmt % args)

    def _json(self, status: int, payload) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _text(self, status: int, body: bytes, ctype: str) -> None:
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    # --- routing --------------------------------------------------------

    def do_GET(self):
        url = urlparse(self.path)
        if url.path in ("/", "/index.html"):
            return self._serve_static("index.html", "text/html; charset=utf-8")
        if url.path == "/index.json":
            return self._serve_static("index.json", "application/json")
        if url.path == "/companion":
            return self._get_companion(parse_qs(url.query))
        self._json(404, {"error": "not found"})

    def do_PUT(self):
        url = urlparse(self.path)
        if url.path == "/apply":
            return self._put_apply()
        self._json(404, {"error": "not found"})

    # --- handlers -------------------------------------------------------

    def _serve_static(self, name: str, ctype: str):
        path = EDITOR_DIR / name
        if not path.exists():
            return self._json(404, {"error": f"missing {name}",
                                    "hint": "run build_index.py first"
                                            if name == "index.json" else None})
        return self._text(200, path.read_bytes(), ctype)

    def _get_companion(self, query: dict):
        rels = query.get("path") or []
        if not rels:
            return self._json(400, {"error": "missing path"})
        path = _resolve_safe(rels[0])
        if path is None:
            return self._json(400, {"error": "path must be inside examples/"})
        if not path.exists():
            return self._json(404, {"error": "file not found"})
        try:
            data = json.loads(path.read_text())
        except json.JSONDecodeError as e:
            return self._json(500, {"error": f"invalid JSON on disk: {e}"})
        return self._json(200, data)

    def _put_apply(self):
        length = int(self.headers.get("Content-Length") or 0)
        try:
            body = json.loads(self.rfile.read(length))
        except json.JSONDecodeError as e:
            return self._json(400, {"error": f"invalid request JSON: {e}"})
        if not isinstance(body, dict):
            return self._json(400, {"error": "body must be an object"})
        rel = body.get("path")
        compat = body.get("compatibility")
        if not isinstance(rel, str) or not isinstance(compat, dict):
            return self._json(400, {"error": "body must contain {path, compatibility}"})
        path = _resolve_safe(rel)
        if path is None:
            return self._json(400, {"error": "path must be inside examples/"})
        if not path.exists():
            return self._json(404, {"error": "file not found"})

        valid, err = _validate_compatibility(compat)
        if not valid:
            return self._json(400, {"error": err})

        try:
            data = json.loads(path.read_text(), object_pairs_hook=OrderedDict)
        except json.JSONDecodeError as e:
            return self._json(500, {"error": f"invalid JSON on disk: {e}"})
        if not isinstance(data, dict):
            return self._json(500, {"error": "companion is not a JSON object"})

        # Coerce attribute insertion order so the file is stable. `None` means
        # the attribute is empty — serialized as JSON `null`.
        ordered_compat = OrderedDict()
        for attr in REQUIRED_ATTRS:
            ordered_compat[attr] = _ordered_attr(attr, compat[attr])
        data["compatibility"] = ordered_compat
        path.write_text(json.dumps(data, indent=4) + "\n")
        log.info("wrote %s", path.relative_to(REPO_ROOT))
        return self._json(200, {"ok": True, "path": rel})


def _resolve_safe(rel: str) -> Path | None:
    """Resolve `rel` relative to REPO_ROOT, ensuring it stays inside examples/."""
    try:
        candidate = (REPO_ROOT / rel).resolve()
    except (OSError, ValueError):
        return None
    try:
        candidate.relative_to(EXAMPLES_DIR.resolve())
    except ValueError:
        return None
    if candidate.suffix != ".json":
        return None
    return candidate


def _ordered_attr(attr: str, value: dict) -> OrderedDict:
    """Normalize one attribute to a fixed-shape ordered dict.

    Values stays a list (possibly empty). qualifier is None when values is
    empty, else one of ALLOWED_QUALIFIERS."""
    values = list(value.get("values") or [])
    out = OrderedDict()
    out["values"] = values
    if not values:
        out["qualifier"] = None
    else:
        q = value.get("qualifier")
        out["qualifier"] = q if q in ALLOWED_QUALIFIERS else "preferred"
    return out


def _validate_compatibility(compat: dict) -> tuple[bool, str]:
    if set(compat.keys()) != set(REQUIRED_ATTRS):
        return False, f"compatibility must have exactly keys {sorted(REQUIRED_ATTRS)}"
    for attr in REQUIRED_ATTRS:
        v = compat[attr]
        if not isinstance(v, dict):
            return False, f"{attr} must be an object"
        if "values" not in v or not isinstance(v["values"], list):
            return False, f"{attr}.values must be a list"
        q = v.get("qualifier")
        if q is not None and q not in ALLOWED_QUALIFIERS:
            return False, (f"{attr}.qualifier must be null or one of "
                           f"{sorted(ALLOWED_QUALIFIERS)}")
        if v["values"] and q is None:
            return False, f"{attr} has values but null qualifier"
        if attr in INT_ATTRS:
            for x in v["values"]:
                if not isinstance(x, int):
                    return False, f"{attr}.values entries must be integers"
        else:
            for x in v["values"]:
                if not isinstance(x, str):
                    return False, f"{attr}.values entries must be strings"
        if attr == "os_family":
            if len(v["values"]) > 1:
                return False, "os_family.values must contain at most one entry"
            for x in v["values"]:
                if x not in ALLOWED_OS_FAMILIES:
                    return False, (f"os_family.values entries must be in "
                                   f"{sorted(ALLOWED_OS_FAMILIES)}, got {x!r}")
    return True, ""


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--log-level", default="INFO",
                        choices=["DEBUG", "INFO", "WARNING", "ERROR"])
    args = parser.parse_args()
    logging.basicConfig(
        level=getattr(logging, args.log_level),
        format="%(levelname)s %(name)s | %(message)s",
    )

    if not (EDITOR_DIR / "index.json").exists():
        log.warning("index.json missing — run `python3 build_index.py` first")

    server = ThreadingHTTPServer((args.host, args.port), Handler)
    log.info("serving on http://%s:%d  (repo=%s)", args.host, args.port, REPO_ROOT)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        log.info("shutting down")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
