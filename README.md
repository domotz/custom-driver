# Domotz Custom Drivers

A collection of ready-to-use [Domotz](https://www.domotz.com) custom driver examples.
Custom drivers are JavaScript scripts executed by a Domotz collector against a
target device to extract custom monitoring variables, populate tables, and
optionally expose custom actions.

The scripting API is documented at
[portal.domotz.com/custom-driver](https://portal.domotz.com/custom-driver).

## Repository layout

- `examples/` — the driver library, organized by communication protocol:
  `http/`, `icmp/`, `snmp/`, `ssh/`, `telnet/`, `winrm/`. Each driver consists of:
  - `<driver>.js` — the driver source code;
  - `<driver>.json` — companion metadata: name, description, category, logo,
    requirements (credentials, sandbox version), tags, protocols, tested
    devices, and an optional `compatibility` block describing which devices
    the driver is meant to run against.
- `logos/` — vendor/product SVG logos referenced by the `logo` field of the
  driver metadata.
- `compatibility-editor/` — a small browser-based tool for editing the
  `compatibility` block of the driver metadata files. See its
  [README](compatibility-editor/README.md).
- `resources/` — auxiliary data files used by some drivers.
