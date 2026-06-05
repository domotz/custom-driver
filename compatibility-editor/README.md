# compatibility-editor

A small browser-based editor for the `compatibility` block inside each driver's
`.json` companion under `../examples/`. Vanilla JS + a stdlib Python HTTP
server, no build step.

## What it does

Every companion JSON can carry a top-level `compatibility` field describing
which devices the driver is meant to run against. The shape is matcher-oriented:

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

- Every attribute is an object with the same shape — `{values, qualifier}` — so
  consumers can rely on it.
- `values` is always a list, possibly empty. Matching is case-insensitive at the
  consumer level.
- `os_family.values` is single-valued (0 or 1 entry) and constrained to a
  canonical vocabulary: `windows`, `linux`, `macos`, `esxi`, `idrac`, `hp_ilo`.
  The editor renders it as a single-select dropdown with a `— (unset)` option;
  the server (`serve.py`) rejects PUTs with off-vocabulary values or more than
  one entry (HTTP 400).
- `qualifier` is `null` when `values` is empty, otherwise one of `required` /
  `preferred`.

Open the editor, review each row, edit values/qualifier, and click Apply to
write the block back to disk.

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

Path traversal is blocked; only files under `../examples/` can be read or
written.

## Notes

- Edits in progress are stored in `localStorage`, so reloading the page doesn't
  lose work. Clicking Apply clears the draft for that file. The storage key is
  versioned; when the on-disk schema changes the key is bumped and stale drafts
  are discarded automatically.
- Keyboard: `j` / `k` (or `↑` / `↓`) navigates the sidebar; `/` focuses search.
