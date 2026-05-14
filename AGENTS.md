# AGENTS.md

## Purpose

Client-side QR backup tool. Scan or paste a QR/URL; print backups; extract individual `otpauth://` URLs and base32 secrets from Google Authenticator migration QRs.

## Layout

- `index.html`, `main.js`, `styles.css`, `favicon.svg` at the root.
- `parse/` for pure data transforms (no DOM).
- `ui/` for DOM-touching components.
- `dist/qr.js` is the built ESM bundle of the `qr.js` package.
- `test/` for `node:test` files and JSON fixtures.

## Requirements

- **P0** Zero networking. Enforced via CSP `connect-src 'none'`.
- **P0** Minimal dependencies. Two pinned runtime deps (`qr-scanner`, `qr.js`). No test deps beyond `node:test`.
- **P1** Scan QRs and accept pasted URLs. Reproduce QRs for printing.
- **P2** Parse `otpauth-migration://` into accounts. Extract base32 secrets.

## Architecture rules

- `parse/` is pure. `ui/` is DOM. `main.js` is the only file that does `document.getElementById`.
- UI modules receive a container at construction and own its contents. They never reach outside; `main.js` never reaches inside.
- No central state. The current result lives only as DOM children of the result section.
- `CameraInput` and `PasteInput` both call the same `handleInput(text)` in `main.js`, which runs `identify(text)` and passes the result to `resultView.show()`.
- A new successful input replaces the previous result. Empty input does not clear.

## Core values (forever)

Simple. Reviewable. Reliable. Trustable. Plain ES modules; no bundler for our own code; no UI framework.

## Never added

Dark mode, web fonts, icon libraries, UI animations beyond the button-label flip, HOTP-specific UI, server-side anything, analytics, telemetry, persistence.

## Testing

- `npm test` runs `node --test test/*.js`.
- Test pure modules. UI modules are verified manually in a browser.
- Migration fixtures are generated from the dim13/otpauth Go tool. Do not hand-edit.

