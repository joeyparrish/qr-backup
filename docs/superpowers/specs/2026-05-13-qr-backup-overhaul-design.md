# QR Backup Overhaul: Design

Date: 2026-05-13

## Motivation

QR Backup is a small, fully client-side tool for scanning sensitive QR codes
(primarily Google Authenticator exports and individual `otpauth://` URLs) and
producing paper backups. The current code was written pre-LLM in a hurry. It
works, but it is structured in a way that makes it hard to extend and audit.

The goal of this overhaul is to make the tool easier to add to, easier to
update, and easier to trust, while keeping its essential property: it never
touches the network and runs entirely in the user's browser.

This document captures the requirements, architecture, and refactor plan
agreed on during brainstorming. It is the basis for an implementation plan
that follows.

## Requirements

In priority order:

- **P0: Zero networking.** This tool handles secrets. All processing must
  happen locally. Networking must be impossible by construction, not just by
  policy.
- **P0: Minimal-to-no dependencies.** Sensitive data demands exceptional
  trust. Today the tool uses `qr-scanner` and `qr.js`. These are trusted as
  currently pinned. Replacing them with self-owned code is a possible future
  step but is not a goal of this overhaul. Adding new runtime dependencies is
  out of scope.
- **P1: Scan QR codes** from a camera.
- **P1: Reproduce QR codes for print.** Produce a printable QR for any URL or
  text the user wants to back up to paper.
- **P2: Parse Google Authenticator backup QRs** (`otpauth-migration://`) into
  the individual `otpauth://` URLs they contain.
- **P2: Extract the authenticator key** from an `otpauth://` URL so it can be
  pasted into a password manager with built-in OTP support.

Only TOTP entries are expected in practice. HOTP is not a target.

## Decisions made during brainstorming

- **Dependency policy:** keep `qr-scanner` and `qr.js` at currently pinned
  versions. Do not add new runtime deps. Replacement is a possible future
  effort, not part of this overhaul. Update our usage of `qr-scanner` to
  match the current API, since the installed version logs deprecation
  warnings against the existing code.
- **CSP:** enforce zero networking at the browser level via a meta CSP tag
  with `connect-src 'none'` and `default-src 'self'`. Verify the camera,
  worker, and `qr.js` still load.
- **Clipboard:** plain clipboard writes for copied URLs and secrets. No
  auto-clear, no reveal-only mode. The user accepts that clipboard managers
  may persist values briefly.
- **Inputs:** both camera scan and a paste-text box. Paste is especially
  useful for testing and for handling already-extracted URLs without the
  glare and focus issues of a phone camera.
- **Other URL schemes:** for any QR that is not `otpauth-migration://` or
  `otpauth://`, the only outputs are copy-text and print-QR. No parsing, no
  extraction.
- **Tests:** required, using Node's built-in `node:test` and `node:assert`.
  No new test dependencies.
- **HOTP:** out of scope. No counter-warning UI.

## Architecture

The overall data flow is **inputs to processing to outputs**:

- **Inputs** produce text. Today: camera. Phase 4 adds: paste box.
- **Processing** identifies the scheme of a piece of text and, where
  appropriate, parses it into structured data.
- **Outputs** render results to the user: copyable text, extracted keys, and
  printable QR codes.

### Module categories

Modules fall into one of two categories.

**Pure modules** never touch the DOM and have no instance state. They take
data and return data, which makes them straightforward to test and
straightforward to reason about. The parsing layer and the QR rendering
layer are pure modules.

**UI modules** receive a container element at construction and own
everything inside it. They expose methods that change their own state
(start, stop, show, clear, etc.) and emit events or invoke callbacks for
things the outside world cares about (a QR was scanned, text was pasted).
A UI module never reads or writes anything outside its own container, and
no other module reaches into its container.

`main.js` is the only orchestrator. It instantiates UI modules with
containers carved out of the page, holds references to them, and wires
callbacks between them. UI modules do not import each other. The dependency
graph is a tree rooted at `main.js`.

### Pure modules (planned)

- `qr-render.js`: takes text, returns an `SVGElement` containing the QR
  code. The caller decides where and how to mount it.
- `parse/identify.js`: takes text, returns a normalized result describing
  the scheme and any parsed details. Dispatches to the specific parsers
  below.
- `parse/otpauth.js`: takes an `otpauth://` URL, returns the label, issuer,
  secret, and type.
- `parse/otpauth-migration.js`: takes an `otpauth-migration://` URL,
  returns the list of `otpauth://` URLs it encodes. Already exists in
  draft form; will be audited against fixtures generated from the
  reference Go tool in `otpauth/`.

### UI modules (planned)

- `camera-input.js`: wraps `qr-scanner` behind a small surface. Owns the
  video element, camera list, and flash toggle, all rendered into the
  container it is given. Calls an `onResult` callback with scanned text.
- Phase 4 additions: `paste-input.js`, `result-view.js`. Out of scope for
  the refactor phase.

### Ownership rule

A UI module fully owns the children of its container. `main.js` gives it
an empty container at construction and does not touch the contents after.
If two visual regions need to coexist, `main.js` wraps each in its own
sub-container.

### No-globals rule

Modules must not read or write window-level globals (with the obvious
exception of imports from declared dependencies). They must not call
`document.getElementById` or any other DOM-wide lookup. All DOM access goes
through the container they were handed at construction.

### Bundling

Our own code ships as separate ES modules, loaded directly by the browser.
This favors transparency and auditability over byte count. The existing
build step continues to bundle `qr.js` (CommonJS) into `dist/qr.js`. No
other bundling.

## Phased plan

The overhaul is split into phases. This spec covers all phases at a high
level. The implementation plan that follows this spec covers **phase 3 only**
(the refactor). Subsequent phases will get their own plans.

1. **Requirements.** Done, captured above.
2. **Identify refactoring targets.** Done, captured below.
3. **Refactor.** Restructure existing code into the module shape above,
   add CSP, add tests, verify the migration parser. Existing UI keeps
   working with no visible change.
4. **New UI with placeholders for added features.** Rebuild the page to
   match the inputs-to-processing-to-outputs model, with paste input,
   hierarchical results view, per-result copy and print buttons. Buttons
   for parsing/extraction can be visible but stubbed if needed.
5. **Wire up new features.** Connect the result view to the parsing
   modules so that scanning a migration URL produces a hierarchy of
   individual accounts, each with copyable URL, copyable secret, and a
   print button.

## Refactor phase targets

These are the changes in scope for phase 3. Out-of-scope items are listed
separately below.

1. **Decompose `main.js`.** Pull QR rendering, camera handling, and
   parsing into the pure and UI modules described above. `main.js`
   becomes thin wiring only.
2. **Update `qr-scanner` usage** to match the installed version's
   current API, removing the deprecation warnings.
3. **Add a CSP meta tag.** Lock down with `default-src 'self';
   connect-src 'none'; img-src 'self' data:; script-src 'self'`. Verify
   the camera, worker, and `qr.js` still load. Adjust the policy
   minimally if a specific resource needs it.
4. **Eliminate implicit-global DOM access.** Replace today's reliance on
   the browser's id-to-window behavior with explicit container-scoped
   lookups inside each UI module. No `document.getElementById` calls
   outside `main.js`.
5. **Add test infrastructure** using Node's built-in `node:test` and
   `node:assert`. Add an `npm test` script. No new dependencies.
6. **Verify `otpauth-migration.js` with fixtures.** Use the Go reference
   tool in `otpauth/` once, offline, to generate ground-truth pairs
   mapping migration URLs to lists of `otpauth://` URLs. Commit those
   fixtures as JSON. Tests run our parser against them and assert
   equality.
7. **Test individual `otpauth://` parsing.** Once `parse/otpauth.js`
   exists, test it against hand-built URLs covering the fields the tool
   needs: label, issuer, secret, type.
8. **Confirm and document the build pipeline.** Our code is plain ES
   modules and is not bundled. `qr.js` continues to be bundled because
   it is CommonJS. The README or a short note should make this explicit
   so a future contributor does not try to bundle the whole app.

Suggested order of operations: tests and fixtures first (they raise our
confidence in everything that follows), then module decomposition and
no-globals cleanup, then `qr-scanner` update, then CSP last (it is most
likely to flush out a runtime problem and is easiest to debug once the
code is otherwise clean).

## Explicitly out of scope for the refactor phase

- CSS rewrite, layout, design polish.
- Paste-text input UI.
- Hierarchical result view.
- Per-result copy and print buttons.
- HOTP-specific UI.
- Stage-machine redesign.
- Replacing `qr-scanner` or `qr.js` with self-owned code.

These belong to phase 4 or phase 5 and will be designed and planned
separately.

## Testing approach

Tests run in Node with `node --test`. Pure modules are imported and called
directly. The `qr-render` module returns an `SVGElement`; tests assert on
the returned node structure (module count, viewBox, fill values) rather
than visual rendering.

UI modules are not unit-tested in this phase. Their correctness is
verified by exercising the existing UI manually after the refactor: scan a
QR with the camera, click print backup, confirm the printed QR is
unchanged from today's behavior.

Fixtures for the migration parser live under `test/fixtures/` as JSON
files. Each fixture pairs an input `otpauth-migration://` URL with an
expected ordered list of `otpauth://` URLs. Fixtures are generated once
and committed.

Fixture inputs come from two sources, neither of which exposes real
secrets:

- The public example `otpauth-migration://` URL in the `otpauth/`
  tool's README, decoded with the same Go tool to obtain the expected
  `otpauth://` list.
- Synthetic accounts built from hand-chosen labels and fake secrets,
  passed through the Go tool's `-rev` flag to produce the matching
  `otpauth-migration://` URL. The Go tool then decodes them back to
  confirm the round trip before we record the pair.

Fixtures should cover, at minimum: a single account, multiple accounts,
accounts with and without an issuer, and labels containing characters
that need URL encoding.

## Risks and notes

- The current `otpauth-migration.js` was generated in an earlier session
  and has not been verified. The fixture-based test step is what
  validates it. If the fixture tests fail, fixing the parser is part of
  the refactor.
- CSP can break things in surprising ways (workers, blob URLs, inline
  styles). The policy may need a minimal carve-out for the qr-scanner
  worker. Any carve-out should be the narrowest one that works and
  should be commented in the HTML.
- `qr-scanner`'s deprecated `WORKER_PATH` API is the most visible
  out-of-date usage, but other deprecations may surface once that one
  is fixed. The refactor task is "match the current API," not just
  "silence one warning."

## Next step

Hand this spec to the writing-plans skill to produce a detailed
implementation plan for the refactor phase.
