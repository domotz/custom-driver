# compatibility-editor

A small browser-based editor for the `compatibility` block inside each driver's `.json` companion under `../examples/`. Vanilla JS + stdlib Python HTTP server, no build step.

## What it does

Every companion JSON can carry a top-level `compatibility` field that describes which devices the driver is meant to run against. The shape is matcher-oriented:

```json
"compatibility": {
  "vendor":           {"values": ["SonicWALL"], "qualifier": "required"},
  "models":           {"values": [], "qualifier": null},
  "name":             {"values": [], "qualifier": null},
  "os_family":        {"values": ["linux"], "qualifier": "required"},
  "firmware_version": {"values": [], "qualifier": null},
  "open_ports":       {"values": [80, 443], "qualifier": "preferred"},
  "required_mibs":    {"values": ["Q-BRIDGE-MIB"], "qualifier": "required"}
}
```

- Every attribute is always an object with the same shape — `{values, qualifier}` — so consumers can rely on it.
- `values` is always a list — possibly empty. Matching is case-insensitive at the consumer level.
- `os_family.values` is single-valued (0 or 1 entry) and constrained to Domotz's canonical vocabulary: `windows`, `linux`, `macos`, `esxi`, `idrac`, `hp_ilo`. The editor renders this as a native single-select dropdown with a `— (unset)` option; the server (`serve.py`) rejects PUTs with off-vocabulary values OR more than one entry, returning HTTP 400.
- `qualifier` is `null` when `values` is empty, otherwise one of `required` / `preferred`. (The schema was simplified from a four-qualifier set on 2026-05-22 — see `igor/docs/smart_compatibility/00-overview.md`.)
- The string matchers (`vendor` / `models` / `name` / `firmware_version`) previously also carried a `pattern: string | null` fnmatch wildcard field. Dropped 2026-05-25 (zero adoption across 245 templates) — see decision #11 in `igor/docs/smart_compatibility/00-overview.md`.

The first pass of the field is populated by a separate one-shot script
(`apply_to_companions.py` in the analysis-scripts repo) that projects SPIKE
analysis output onto these files. After that, this editor is the day-to-day
tool: an operator opens it, reviews each row, edits values/qualifier, and
clicks Apply to write back to disk.

## Running

```sh
python3 build_index.py        # walks ../examples/**/*.json → index.json
python3 serve.py              # http://127.0.0.1:8765
```

Then open `http://127.0.0.1:8765/` in a browser. Pick a companion from the
sidebar, edit fields, click Apply. The file on disk is updated immediately;
commit the diff afterward as usual.

Re-run `build_index.py` whenever companion files are added, renamed, or
removed — its output (`index.json`) is gitignored.

## Endpoints

- `GET /` — the SPA
- `GET /index.json` — sidebar manifest
- `GET /companion?path=examples/http/foo.json` — parsed JSON of one companion
- `PUT /apply` — body `{path, compatibility}` → writes the file

Path traversal is blocked; only files under `../examples/` can be read or written.

## Notes

- Edits in progress are stored in `localStorage` (`custom_driver_editor_drafts_v7`),
  so reloading the page doesn't lose work. Clicking Apply clears the draft for that file.
  The key is bumped when the on-disk shape changes (`_v2` = wildcard `pattern`,
  `_v3` = canonical `os_family`, `_v4` = `os_version` dropped, `_v5` = single-value
  `os_family`, `_v6` = qualifier set collapsed to required+preferred,
  `_v7` = `pattern` field dropped, `_v8` = `name` matcher added);
  old drafts that no longer match the schema are discarded automatically.
- Keyboard: `j` / `k` (or `↑` / `↓`) navigates the sidebar; `/` focuses search.
- The editor has **no** dependency on the SPIKE analysis output. After
  `apply_to_companions.py` seeds the field, this tool only sees the companion JSONs.
