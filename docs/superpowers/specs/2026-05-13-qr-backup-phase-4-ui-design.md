# QR Backup Phase 4: UI Rebuild

Date: 2026-05-13

## Motivation

Phase 3 of the overhaul restructured the code: parsers, QR rendering, and
camera input live in small focused modules with no implicit globals and a
CSP that blocks all networking. The on-screen UI, however, is still the
original 2021 single-stage scan-then-print flow. It only handles one QR
at a time, has no paste input, and offers no way to extract individual
accounts from a Google Authenticator migration QR.

Phase 4 replaces the on-screen UI with one that matches the
inputs-to-processing-to-outputs model agreed during the phase 1
brainstorm. It folds in what was originally planned as phase 5 (wiring
the new features to the parsers): since phase 3 left the parsers fully
working, every feature in the new UI can be functional from day one
without an intermediate stub stage.

## Core values (forever)

These shape what is built and, more importantly, what is never built.

- **Simple.** A small page that does one thing.
- **Reviewable.** Plain ES modules, no bundler for our own code, no UI
  framework. Anyone can read every line.
- **Reliable.** No optional features that could break unexpectedly. No
  background behavior the user has not asked for.
- **Trustable.** No networking, no analytics, no persistence, no
  dependencies beyond the two already vendored. The user can scan a
  secret and the tool's behavior is fully accounted for by code visible
  in the repo.

What will never be added to this project, even when it might seem to
fit:

- Dark mode.
- Web fonts.
- Icon fonts or icon libraries.
- UI animations beyond the trivial button label flip the spec calls for.
- HOTP-specific UI (counter warnings, etc.). The user only expects TOTP
  in practice; HOTP entries are handled the same as TOTP and the user
  accepts the inherent limitation that printing a HOTP backup freezes
  the counter.

These are not "out of scope for now" items. They are "never" items. They
would add code, surface, and complexity without serving the core values.

## Decisions made during this brainstorm

- **Replace, not accumulate.** A new successful input replaces the
  current result. Frames where the camera fails to find a QR do not
  clear an existing result.
- **Account row layout.** Issuer and label are shown; the raw URL is
  not. Three actions: Copy URL, Copy key, Print QR.
- **Migration result layout.** A parent section (Migration backup, N
  accounts) with Copy URL and Print QR for the whole migration URL,
  followed by one row per account using the account row layout.
- **Print flow.** Native browser print, no view change. A hidden print
  slot is filled with the target QR's SVG just before `window.print()`
  is called, and emptied via `afterprint`. CSS print rules hide
  everything except the print slot's contents.
- **Copy feedback.** The clicked button briefly shows a check mark and
  the word "Copied", then reverts after about two seconds. If the
  clipboard write fails, the button shows a cross and "Failed" instead,
  on the same timeout.
- **Paste UX.** A textarea with a debounced input listener (about 300
  ms idle). Any change while non-empty triggers identification; an
  empty field does not clear an existing result.
- **Page shape.** Single column, mobile first, three sections stacked
  vertically: camera, paste, result. No stage attribute. No
  full-screen result mode. No navigation.

## Architecture

The page is one continuous view. Two input modules sit at the top and
emit text via a callback. A central handler in `main.js` runs `identify`
on the text and passes the result to a single result-view module that
owns the result section. There is no central state object; the current
result lives only as DOM children of the result section.

### Module decomposition

The codebase reorganizes around two folders. `parse/` continues to hold
the pure data-transform modules from phase 3. A new `ui/` folder holds
every module that touches the DOM or wraps an interactive component.
`main.js` stays at the root as the entry point and the only file that
calls `document.getElementById`.

**Pure modules (unchanged from phase 3):**

- `parse/identify.js`
- `parse/otpauth.js`
- `parse/otpauth-migration.js`

**UI modules:**

- `ui/qr-render.js` (moved from the root; same code; pure `qrMatrix`
  remains testable in Node).
- `ui/camera-input.js` (moved from the root; same code).
- `ui/paste-input.js` (new). `class PasteInput`. Renders a labeled
  textarea into its container. Listens for input events with a debounce
  of about 300 ms and calls `onResult(text)` when the field is non-empty
  and stable.
- `ui/result-view.js` (new). `class ResultView`. Exposes `show(result)`
  which replaces the container's children with the appropriate block
  for `result.kind` (migration, otpauth, or other). Dispatch and the
  three block renderers live inside this module.
- `ui/clipboard.js` (new). `copyToClipboard(text, button)`. Writes to
  the clipboard, flips the button label, and restores it after the
  timeout. Knows nothing about which row or kind of action triggered
  it.
- `ui/print-qr.js` (new). Exports `createPrinter(slot)` which returns
  a `print(text)` function. Each call renders the target SVG into
  `slot`, calls `window.print()`, and clears the slot on `afterprint`.
  Receiving the slot at creation keeps the rule that no module outside
  `main.js` looks up DOM elements by id.

**main.js:** four `getElementById` calls (the three section roots and
the print slot). Instantiates `CameraInput`, `PasteInput`, and
`ResultView` with their respective roots. Passes the print slot
reference to `ui/print-qr.js` at startup (the simplest shape: a
`createPrinter(slot)` factory that returns a `print(text)` function,
which `main.js` injects into the result view). Wires both inputs'
`onResult` to the single handler:

```
handleInput(text) {
  resultView.show(identify(text));
}
```

That is the entire orchestration logic.

### DOM structure

`index.html`'s body holds four siblings: a header, a main element with
three section roots, and the print slot.

```
<body>
  <header>QR Backup</header>
  <main>
    <section id="cameraRoot"></section>
    <section id="pasteRoot"></section>
    <section id="resultRoot"></section>
  </main>
  <div id="printSlot" aria-hidden="true"></div>
</body>
```

Each UI module fully owns its container's contents and never touches
anything outside it. The print slot is referenced only by
`ui/print-qr.js`.

## Layout

Mobile first, single column. Camera at the top, paste box below it,
result block below that. All three sections are always visible; the
result section shows a brief hint when there is no result yet.

The result block has three shapes.

**Empty state:** a short instruction. "Scan a QR with the camera or
paste a URL above to begin."

**Migration result:** a unified card. Header section shows
"Migration backup (N accounts)" and the parent actions (Copy URL,
Print QR). Below the header, one row per account, each using the
single-account layout.

**Single otpauth result:** one row using the single-account layout, by
itself.

**Other result:** a card showing the raw scanned text in a code-style
block, with Copy text and Print QR buttons. No issuer or label,
because the input was not an otpauth URL.

The account row layout shows the issuer on the first line and the
label (typically an account name or email) on the second line, with
the three action buttons below. Buttons are at least 44 pixels tall to
suit touch input.

## Data flow

```
camera-input ──onResult(text)──┐
                                ├──► handleInput(text) ──► identify(text) ──► resultView.show(result)
paste-input  ──onResult(text)──┘
```

`identify` is total: it never throws and always returns one of the
three result kinds. The result view dispatches on `result.kind` and
renders the matching block.

Per-row button handlers are wired by the result view as it builds
each row. Copy handlers call `ui/clipboard.js` directly (a pure
function). Print handlers call the `print` function provided by
`main.js` at result-view construction (the factory output of
`ui/print-qr.js`'s `createPrinter(slot)`). The Copy key handler calls
`parseOtpauthUrl` lazily on click; the parsed object is not
pre-computed at render time.

**Replace semantics.** `show()` unconditionally replaces the children
of its container. The "don't clear on no-detection" rule lives in the
input modules: each only fires `onResult` when there is genuinely new
input. The camera input already only fires on a successful scan. The
paste input only fires when the field is non-empty after its debounce.

**Error handling.** Three places things can go wrong, all handled
locally:

- `identify` is total; no error path.
- `parseOtpauthUrl` could throw on a non-otpauth string. The result
  view only attaches the Copy key handler to rows that originated from
  an otpauth URL, so the call is never made with bad input. As a
  defensive measure, the handler wraps the call in try/catch and the
  button silently no-ops on error.
- `navigator.clipboard.writeText` can reject (no permission, insecure
  context, browser restriction). `copyToClipboard` catches the
  rejection and flips the button to a "Failed" state on the same
  timeout.

There is no global error UI, no toast system, no logger.

## Print mechanism

A single hidden `<div id="printSlot">` lives in the body. On screen it
is `display: none`. In print media, CSS hides every element on the
page except the print slot, and scales the slot's SVG child to fill
the page.

```
@media print {
  body > * { display: none !important; }
  body > #printSlot {
    display: block !important;
    width: 100%; height: 100%;
  }
  #printSlot > svg {
    width: 100%; height: auto; max-height: 100vh;
  }
}
```

`ui/print-qr.js` renders the target QR into the slot, calls
`window.print()`, and clears the slot on the `afterprint` event. The
on-screen UI is never modified.

## CSS scope

A modest design pass at the same time, since the structure changes
anyway. Not a framework, not a design system, not a token library.

- A handful of custom properties at `:root` for the few values that
  repeat: a base font size, two or three spacing values, a corner
  radius, a border color.
- A small reset: `box-sizing: border-box`, font, line-height. The
  existing `vh`-based font scaling rules go away.
- Class-based selectors for the new components, written in a BEM-ish
  style (`.result-card__header`, `.result-row__title`, and so on).
  Readable from the class name alone.
- Print rules consolidated at the bottom of the file.
- Buttons have a consistent shape and minimum height suitable for
  touch.

All styles stay in a single `styles.css`. The file will grow modestly
(estimated 100-150 lines from today's ~70).

## Testing

No new unit tests in this phase. The phase 3 testing rule applies: UI
modules are verified manually in a browser.

One test file moves with `ui/qr-render.js`: `test/test-qr-render.js`
updates its import path from `../qr-render.js` to `../ui/qr-render.js`.
All other tests are unchanged and continue to pass.

**Manual verification matrix** (must pass before declaring phase 4
done):

| Input | Expected result |
|---|---|
| Camera scans a migration QR | Migration card with the right number of accounts |
| Camera scans a single otpauth QR | Single account card |
| Camera scans a plain URL or arbitrary text | Other card |
| Paste migration URL | Migration card |
| Paste otpauth URL | Single account card |
| Paste plain text | Other card |
| Type a partial URL, pause, finish typing | Result updates after debounce; never settles on a transient wrong kind |
| Click Copy URL | Clipboard contains the URL; button flips to "Copied" then reverts |
| Click Copy key on a TOTP row | Clipboard contains the base32 secret |
| Click Print QR on any row of any kind | Native print dialog shows the correct QR full-page; on-screen UI does not change |
| Print and cancel the dialog | App returns to exactly its prior state |
| Scan, then paste a different URL | Result is replaced |
| Empty the paste field after typing | Existing result stays; no clear on empty |
| No camera available | App shows the existing "No camera found" status; paste still works |

## Out of scope for phase 4

These items have a plausible future and are deferred, not forbidden:

- Tightening `style-src` to remove `'unsafe-inline'`. The new code
  still uses a few `element.style.display = ...` assignments. Could be
  refactored to class toggles later.
- Replacing `qr-scanner` or `qr.js` with self-owned code.
- Multi-print ("Print all accounts" for a migration result).
- A short transient warning when an `otpauth://` URL appears to be HOTP
  (just a one-line hint, no special UI).

The items listed under "Core values (forever)" earlier are not in this
list because they are project-level decisions, not phase-level
deferrals.

## Next step

Hand this spec to the writing-plans skill to produce a detailed
implementation plan for phase 4.
