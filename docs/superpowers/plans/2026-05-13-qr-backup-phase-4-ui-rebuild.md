# QR Backup Phase 4: UI Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-stage scan-then-print UI with a continuous single-page tool that has live camera input, a paste box, and a structured result view supporting per-account copy and print actions for Google Authenticator migration QRs.

**Architecture:** Two new UI modules (`paste-input`, `result-view`) plus two small DOM helpers (`clipboard`, `print-qr`). Existing phase-3 modules are reused as-is; `qr-render` and `camera-input` move into a new `ui/` folder for symmetry with `parse/`. `main.js` is the only place that does `document.getElementById`; it instantiates the UI modules and wires both inputs' `onResult` callbacks to a single handler that runs `identify` and calls `resultView.show`.

**Tech Stack:** Plain ES modules. No new dependencies. CSS hand-written with a small set of custom-property tokens. Native browser print via a CSS `@media print` print-slot mechanism. Tests use Node's built-in `node:test` (existing tests carry forward unchanged except for one import-path update).

**Spec:** `docs/superpowers/specs/2026-05-13-qr-backup-phase-4-ui-design.md`

---

## File layout after this phase

```
qr-backup/
  index.html                            # rewritten body structure
  main.js                               # rewritten orchestrator
  styles.css                            # modest design pass
  favicon.svg                           # unchanged
  parse/
    identify.js                         # unchanged
    otpauth.js                          # unchanged
    otpauth-migration.js                # unchanged
  ui/
    qr-render.js                        # MOVED from root
    camera-input.js                     # MOVED from root
    paste-input.js                      # NEW
    result-view.js                      # NEW
    clipboard.js                        # NEW
    print-qr.js                         # NEW
  dist/qr.js                            # unchanged build artifact
  test/
    test-qr-render.js                   # import path updated for the move
    test-otpauth-migration.js           # unchanged
    test-otpauth.js                     # unchanged
    test-identify.js                    # unchanged
    fixtures/                           # unchanged
  package.json                          # unchanged
  README.md                             # unchanged
```

---

### Task 1: Move `qr-render.js` into `ui/`

Pure file relocation plus three import-path updates. Existing behavior unchanged.

**Files:**
- Move: `qr-render.js` → `ui/qr-render.js`
- Modify: `ui/qr-render.js` (after move; one import path)
- Modify: `main.js` (one import path)
- Modify: `test/test-qr-render.js` (one import path)

- [ ] **Step 1: Create the ui/ directory and move the file**

Run:
```
mkdir -p ui
git mv qr-render.js ui/qr-render.js
```

- [ ] **Step 2: Update the qrcode import inside the moved file**

`ui/qr-render.js` currently imports from `'./dist/qr.js'`. From inside `ui/`, the path is one level up. Open `ui/qr-render.js` and change:

```js
import qrcode from './dist/qr.js';
```

to:

```js
import qrcode from '../dist/qr.js';
```

- [ ] **Step 3: Update the renderQrSvg import in main.js**

Open `main.js`. Change:

```js
import { renderQrSvg } from './qr-render.js';
```

to:

```js
import { renderQrSvg } from './ui/qr-render.js';
```

- [ ] **Step 4: Update the qrMatrix import in the test**

Open `test/test-qr-render.js`. Change:

```js
import { qrMatrix } from '../qr-render.js';
```

to:

```js
import { qrMatrix } from '../ui/qr-render.js';
```

- [ ] **Step 5: Run tests**

Run: `npm test`
Expected: 20 tests pass.

- [ ] **Step 6: Static-load check**

Run `python3 -m http.server 8765 &`, then in a separate command:
```
curl -sI http://127.0.0.1:8765/ui/qr-render.js
curl -sI http://127.0.0.1:8765/main.js
```
Both should return 200. Stop the server (`kill %1`).

- [ ] **Step 7: Commit**

```
git add ui/qr-render.js main.js test/test-qr-render.js
git commit -m "Move qr-render.js into ui/" -m "Co-Authored-By: Claude Code (Opus 4.7) <noreply@anthropic.com>"
```

(`git mv` already staged the deletion side; the explicit `git add ui/qr-render.js` is a no-op confirmation. Use the path forms above. Do NOT `git add -A`.)

---

### Task 2: Move `camera-input.js` into `ui/`

Pure file relocation plus two import-path updates. Existing behavior unchanged.

**Files:**
- Move: `camera-input.js` → `ui/camera-input.js`
- Modify: `ui/camera-input.js` (after move; one import path)
- Modify: `main.js` (one import path)

- [ ] **Step 1: Move the file**

Run:
```
git mv camera-input.js ui/camera-input.js
```

- [ ] **Step 2: Update the QrScanner import inside the moved file**

`ui/camera-input.js` currently imports from `'./node_modules/qr-scanner/qr-scanner.min.js'`. From inside `ui/`, the path is one level up. Change:

```js
import QrScanner from './node_modules/qr-scanner/qr-scanner.min.js';
```

to:

```js
import QrScanner from '../node_modules/qr-scanner/qr-scanner.min.js';
```

- [ ] **Step 3: Update the CameraInput import in main.js**

Change:

```js
import { CameraInput } from './camera-input.js';
```

to:

```js
import { CameraInput } from './ui/camera-input.js';
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: 20 tests pass. (No tests directly touch camera-input, but this confirms nothing transitively broke.)

- [ ] **Step 5: Static-load check**

`python3 -m http.server 8765 &` then:
```
curl -sI http://127.0.0.1:8765/ui/camera-input.js
curl -sI http://127.0.0.1:8765/main.js
```
Both 200. Stop server.

- [ ] **Step 6: Commit**

```
git add ui/camera-input.js main.js
git commit -m "Move camera-input.js into ui/" -m "Co-Authored-By: Claude Code (Opus 4.7) <noreply@anthropic.com>"
```

---

### Task 3: Add `ui/clipboard.js`

Small pure helper that wraps `navigator.clipboard.writeText` and flips the calling button's label for two seconds. No tests (UI behavior, verified manually).

**Files:**
- Create: `ui/clipboard.js`

- [ ] **Step 1: Create the module**

Create `ui/clipboard.js`:

```js
/**
 * QR Backup
 * Copyright (C) 2021, Joey Parrish
 * GPLv3 license, see LICENSE.md
 */

const SUCCESS_LABEL = '✓ Copied';
const FAILURE_LABEL = '✗ Failed';
const REVERT_DELAY_MS = 2000;

export async function copyToClipboard(text, button) {
  const original = button.textContent;
  let label;
  try {
    await navigator.clipboard.writeText(text);
    label = SUCCESS_LABEL;
  } catch (e) {
    label = FAILURE_LABEL;
  }
  button.textContent = label;
  setTimeout(() => {
    if (button.textContent === label) {
      button.textContent = original;
    }
  }, REVERT_DELAY_MS);
}
```

The unicode escapes (`✓` checkmark, `✗` ballot X) avoid embedding glyphs that might confuse some editors.

The `if (button.textContent === label)` guard prevents the revert from clobbering a state set by a later click (rapid double-click).

- [ ] **Step 2: Run tests**

Run: `npm test`
Expected: 20 tests pass. (No new tests for this module.)

- [ ] **Step 3: Static-load check**

`python3 -m http.server 8765 &` then `curl -sI http://127.0.0.1:8765/ui/clipboard.js` returns 200. Stop server.

- [ ] **Step 4: Commit**

```
git add ui/clipboard.js
git commit -m "Add ui/clipboard.js" -m "Co-Authored-By: Claude Code (Opus 4.7) <noreply@anthropic.com>"
```

---

### Task 4: Add `ui/print-qr.js`

Factory that takes the print-slot element and returns a `print(text)` function. Each call renders the target QR into the slot, calls `window.print()`, and clears the slot on `afterprint`. No tests.

**Files:**
- Create: `ui/print-qr.js`

- [ ] **Step 1: Create the module**

Create `ui/print-qr.js`:

```js
/**
 * QR Backup
 * Copyright (C) 2021, Joey Parrish
 * GPLv3 license, see LICENSE.md
 */

import { renderQrSvg } from './qr-render.js';

export function createPrinter(slot) {
  window.addEventListener('afterprint', () => {
    slot.replaceChildren();
  });
  return {
    print(text) {
      slot.replaceChildren(renderQrSvg(text));
      window.print();
    },
  };
}
```

The `afterprint` listener handles cleanup whether `window.print()` is synchronous (Chromium) or asynchronous (some Firefox versions).

- [ ] **Step 2: Run tests**

Run: `npm test`
Expected: 20 tests pass.

- [ ] **Step 3: Static-load check**

Confirm `curl -sI http://127.0.0.1:8765/ui/print-qr.js` returns 200.

- [ ] **Step 4: Commit**

```
git add ui/print-qr.js
git commit -m "Add ui/print-qr.js" -m "Co-Authored-By: Claude Code (Opus 4.7) <noreply@anthropic.com>"
```

---

### Task 5: Add `ui/paste-input.js`

UI module. Owns its container. Builds a labeled textarea. Debounces input events at 300 ms and fires `onResult(text)` for non-empty input. No tests.

**Files:**
- Create: `ui/paste-input.js`

- [ ] **Step 1: Create the module**

Create `ui/paste-input.js`:

```js
/**
 * QR Backup
 * Copyright (C) 2021, Joey Parrish
 * GPLv3 license, see LICENSE.md
 */

const DEBOUNCE_MS = 300;

export class PasteInput {
  constructor(container, { onResult } = {}) {
    this.container = container;
    this.onResult = onResult || (() => {});

    const label = document.createElement('label');
    label.textContent = 'Paste a URL';
    label.className = 'paste-input__label';
    label.htmlFor = 'paste-input-field';

    this.textarea = document.createElement('textarea');
    this.textarea.id = 'paste-input-field';
    this.textarea.className = 'paste-input__field';
    this.textarea.placeholder = 'otpauth://... or otpauth-migration://...';
    this.textarea.rows = 3;
    this.textarea.spellcheck = false;
    this.textarea.autocapitalize = 'none';
    this.textarea.autocomplete = 'off';

    container.appendChild(label);
    container.appendChild(this.textarea);

    this._timer = null;
    this.textarea.addEventListener('input', () => {
      if (this._timer) clearTimeout(this._timer);
      this._timer = setTimeout(() => this._fire(), DEBOUNCE_MS);
    });
  }

  _fire() {
    const text = this.textarea.value.trim();
    if (text) {
      this.onResult(text);
    }
  }
}
```

The id `paste-input-field` is set to associate the `<label>` with the textarea. The autocomplete-disabling attributes are appropriate for a field that takes URLs and secrets, not user content.

- [ ] **Step 2: Run tests**

Run: `npm test`
Expected: 20 tests pass.

- [ ] **Step 3: Static-load check**

`curl -sI http://127.0.0.1:8765/ui/paste-input.js` returns 200.

- [ ] **Step 4: Commit**

```
git add ui/paste-input.js
git commit -m "Add ui/paste-input.js" -m "Co-Authored-By: Claude Code (Opus 4.7) <noreply@anthropic.com>"
```

---

### Task 6: Add `ui/result-view.js`

UI module. Owns its container. Exposes `show(result)` which renders one of three block shapes based on `result.kind`. Builds per-row action buttons wired to clipboard and print helpers. Largest new module in this phase; still focused on one job (rendering a result).

**Files:**
- Create: `ui/result-view.js`

- [ ] **Step 1: Create the module**

Create `ui/result-view.js`:

```js
/**
 * QR Backup
 * Copyright (C) 2021, Joey Parrish
 * GPLv3 license, see LICENSE.md
 */

import { parseOtpauthUrl } from '../parse/otpauth.js';
import { copyToClipboard } from './clipboard.js';

export class ResultView {
  constructor(container, { printer } = {}) {
    this.container = container;
    this.printer = printer;
    this._renderEmpty();
  }

  show(result) {
    if (!result) {
      this._renderEmpty();
      return;
    }
    switch (result.kind) {
      case 'migration': this._renderMigration(result); break;
      case 'otpauth':   this._renderOtpauth(result); break;
      case 'other':     this._renderOther(result); break;
      default:          this._renderEmpty();
    }
  }

  _renderEmpty() {
    const hint = document.createElement('p');
    hint.className = 'result-hint';
    hint.textContent = 'Scan a QR with the camera or paste a URL above to begin.';
    this.container.replaceChildren(hint);
  }

  _renderMigration(result) {
    const card = document.createElement('div');
    card.className = 'result-card';

    const header = document.createElement('div');
    header.className = 'result-card__header';
    const title = document.createElement('h2');
    title.className = 'result-card__title';
    title.textContent = `Migration backup (${result.accounts.length} accounts)`;
    header.appendChild(title);
    header.appendChild(this._makeActions([
      this._copyButton('Copy URL', result.input),
      this._printButton(result.input),
    ]));
    card.appendChild(header);

    for (const accountUrl of result.accounts) {
      card.appendChild(this._renderAccountRow(accountUrl));
    }
    this.container.replaceChildren(card);
  }

  _renderOtpauth(result) {
    const card = document.createElement('div');
    card.className = 'result-card';
    card.appendChild(this._renderAccountRow(result.input));
    this.container.replaceChildren(card);
  }

  _renderOther(result) {
    const card = document.createElement('div');
    card.className = 'result-card';

    const header = document.createElement('div');
    header.className = 'result-card__header';
    const title = document.createElement('h2');
    title.className = 'result-card__title';
    title.textContent = 'Plain text or unknown URL';
    header.appendChild(title);
    card.appendChild(header);

    const body = document.createElement('div');
    body.className = 'result-card__row';
    const text = document.createElement('pre');
    text.className = 'result-card__text';
    text.textContent = result.input;
    body.appendChild(text);
    body.appendChild(this._makeActions([
      this._copyButton('Copy text', result.input),
      this._printButton(result.input),
    ]));
    card.appendChild(body);

    this.container.replaceChildren(card);
  }

  _renderAccountRow(otpauthUrl) {
    const parsed = parseOtpauthUrl(otpauthUrl);
    const row = document.createElement('div');
    row.className = 'result-card__row';

    const title = document.createElement('div');
    title.className = 'result-row__title';
    title.textContent = parsed.issuer || '(no issuer)';
    row.appendChild(title);

    const sub = document.createElement('div');
    sub.className = 'result-row__sub';
    sub.textContent = parsed.label;
    row.appendChild(sub);

    row.appendChild(this._makeActions([
      this._copyButton('Copy URL', otpauthUrl),
      this._copyButton('Copy key', parsed.secret),
      this._printButton(otpauthUrl),
    ]));

    return row;
  }

  _makeActions(buttons) {
    const div = document.createElement('div');
    div.className = 'result-row__actions';
    for (const b of buttons) div.appendChild(b);
    return div;
  }

  _copyButton(label, text) {
    const btn = document.createElement('button');
    btn.className = 'button button--copy';
    btn.textContent = label;
    btn.addEventListener('click', () => copyToClipboard(text, btn));
    return btn;
  }

  _printButton(text) {
    const btn = document.createElement('button');
    btn.className = 'button button--print';
    btn.textContent = 'Print QR';
    btn.addEventListener('click', () => this.printer.print(text));
    return btn;
  }
}
```

Note: `parseOtpauthUrl` is called at render time for each account row, which is necessary in order to display the issuer and label. The parsed secret is captured at the same time and used as the Copy-key button's target. (The phase-4 spec mentioned "lazy parse at click time"; that wording was inaccurate because the friendly-label display requires parsing at render time anyway. The plan reflects the realistic design.)

- [ ] **Step 2: Run tests**

Run: `npm test`
Expected: 20 tests pass.

- [ ] **Step 3: Static-load check**

`curl -sI http://127.0.0.1:8765/ui/result-view.js` returns 200.

- [ ] **Step 4: Commit**

```
git add ui/result-view.js
git commit -m "Add ui/result-view.js" -m "Co-Authored-By: Claude Code (Opus 4.7) <noreply@anthropic.com>"
```

---

### Task 7: Switch over `index.html`, `styles.css`, and `main.js`

Rewrite the three top-level files together so the page stays internally consistent across the commit boundary. After this task the new UI is live.

**Files:**
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `main.js`

- [ ] **Step 1: Replace `index.html`**

Open `index.html` and replace the entire file with:

```html
<!DOCTYPE html>
<!--
 * QR Backup
 * Copyright (C) 2021, Joey Parrish
 * GPLv3 license, see LICENSE.md
-->
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy"
          content="default-src 'self'; connect-src 'none'; img-src 'self' data: blob:; media-src 'self' blob:; script-src 'self'; style-src 'self' 'unsafe-inline'; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'none'">
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1.0, user-scalable=no">
    <title>QR Backup</title>
    <link rel="icon" href="favicon.svg" type="image/svg+xml">
    <link href="styles.css" rel="stylesheet">
  </head>
  <body>
    <header>QR Backup</header>
    <main>
      <section id="cameraRoot" class="section section--camera"></section>
      <section id="pasteRoot" class="section section--paste"></section>
      <section id="resultRoot" class="section section--result"></section>
    </main>
    <div id="printSlot" aria-hidden="true"></div>
    <script type="module" src="main.js"></script>
  </body>
</html>
```

- [ ] **Step 2: Replace `styles.css`**

Open `styles.css` and replace the entire file with:

```css
/**
 * QR Backup
 * Copyright (C) 2021, Joey Parrish
 * GPLv3 license, see LICENSE.md
 */

:root {
  --space-1: 0.5rem;
  --space-2: 1rem;
  --space-3: 1.5rem;
  --radius: 0.375rem;
  --border-color: #d0d0d0;
  --muted: #555;
  --accent: #0066cc;
}

* { box-sizing: border-box; }

html, body { margin: 0; padding: 0; }

body {
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 16px;
  line-height: 1.5;
  padding: var(--space-2);
  max-width: 40rem;
  margin: 0 auto;
}

header {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: var(--space-2);
}

main {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

/* Camera section: camera-input creates its own internal markup using
   legacy utility classes and ids that are preserved below. */
.center-contents {
  text-align: center;
}

.margin-below {
  margin-bottom: var(--space-2);
}

#cameraRoot #video {
  width: 100%;
  max-height: 40vh;
}

#cameraRoot #camList,
#cameraRoot #flashToggle {
  font-size: 1rem;
  padding: var(--space-1);
  min-height: 44px;
}

/* Paste section */
.paste-input__label {
  display: block;
  margin-bottom: var(--space-1);
  font-weight: 500;
}

.paste-input__field {
  width: 100%;
  padding: var(--space-1);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.875rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius);
  resize: vertical;
  min-height: 4rem;
}

/* Result section */
.result-hint {
  color: var(--muted);
  text-align: center;
  margin: 0;
}

.result-card {
  border: 1px solid var(--border-color);
  border-radius: var(--radius);
  overflow: hidden;
}

.result-card__header,
.result-card__row {
  padding: var(--space-2);
}

.result-card__header + .result-card__row,
.result-card__row + .result-card__row {
  border-top: 1px solid var(--border-color);
}

.result-card__title {
  font-size: 1rem;
  font-weight: 600;
  margin: 0 0 var(--space-1) 0;
}

.result-card__text {
  background: #f5f5f5;
  padding: var(--space-1);
  border-radius: var(--radius);
  font-size: 0.875rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  overflow-wrap: break-word;
  white-space: pre-wrap;
  margin: 0 0 var(--space-1) 0;
}

.result-row__title {
  font-weight: 600;
}

.result-row__sub {
  font-size: 0.875rem;
  color: var(--muted);
  margin-bottom: var(--space-1);
}

.result-row__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
  margin-top: var(--space-1);
}

.button {
  min-height: 44px;
  padding: 0 var(--space-2);
  font-size: 1rem;
  font-family: inherit;
  border: 1px solid var(--accent);
  background: white;
  color: var(--accent);
  border-radius: var(--radius);
  cursor: pointer;
}

.button:hover {
  background: var(--accent);
  color: white;
}

/* Print slot */
#printSlot { display: none; }

@media print {
  body > * { display: none !important; }
  body > #printSlot {
    display: block !important;
    width: 100%;
    height: 100%;
  }
  #printSlot > svg {
    width: 100%;
    height: auto;
    max-height: 100vh;
  }
}
```

This replaces every previous rule. The legacy utility classes `.center-contents` and `.margin-below` are kept because `ui/camera-input.js` still emits them in its DOM (per the spec, that module is reused unchanged in this phase).

- [ ] **Step 3: Replace `main.js`**

Open `main.js` and replace the entire file with:

```js
/**
 * QR Backup
 * Copyright (C) 2021, Joey Parrish
 * GPLv3 license, see LICENSE.md
 */

import { identify } from './parse/identify.js';
import { CameraInput } from './ui/camera-input.js';
import { PasteInput } from './ui/paste-input.js';
import { ResultView } from './ui/result-view.js';
import { createPrinter } from './ui/print-qr.js';

const cameraRoot = document.getElementById('cameraRoot');
const pasteRoot = document.getElementById('pasteRoot');
const resultRoot = document.getElementById('resultRoot');
const printSlot = document.getElementById('printSlot');

const printer = createPrinter(printSlot);
const resultView = new ResultView(resultRoot, { printer });

function handleInput(text) {
  resultView.show(identify(text));
}

new PasteInput(pasteRoot, { onResult: handleInput });

const cameraInput = new CameraInput(cameraRoot, { onResult: handleInput });
cameraInput.start().catch(() => {
  cameraRoot.replaceChildren();
  const msg = document.createElement('p');
  msg.className = 'result-hint';
  msg.textContent = 'No camera available. Paste a URL above instead.';
  cameraRoot.appendChild(msg);
});
```

The PasteInput instance isn't kept in a local variable because nothing else needs to address it after construction. The CameraInput is kept because we await `start()` to handle the no-camera path.

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: 20 tests pass.

- [ ] **Step 5: Static-load check**

Run a local server and confirm every asset is reachable:

```
python3 -m http.server 8765 &
curl -sI http://127.0.0.1:8765/index.html
curl -sI http://127.0.0.1:8765/styles.css
curl -sI http://127.0.0.1:8765/main.js
curl -sI http://127.0.0.1:8765/ui/qr-render.js
curl -sI http://127.0.0.1:8765/ui/camera-input.js
curl -sI http://127.0.0.1:8765/ui/paste-input.js
curl -sI http://127.0.0.1:8765/ui/result-view.js
curl -sI http://127.0.0.1:8765/ui/clipboard.js
curl -sI http://127.0.0.1:8765/ui/print-qr.js
curl -sI http://127.0.0.1:8765/parse/identify.js
```

All should return 200. Stop the server (`kill %1`).

- [ ] **Step 6: Manual browser verification**

You cannot complete this from a subagent. Document the gaps clearly so the user can run them. The manual test matrix from the spec is:

| Input | Expected |
|---|---|
| Camera scans a migration QR | Migration card with N accounts |
| Camera scans a single otpauth QR | Single account card |
| Camera scans plain URL/text | Other card |
| Paste migration URL | Migration card |
| Paste otpauth URL | Single account card |
| Paste plain text | Other card |
| Type partial URL, pause, finish | Result updates after debounce |
| Click Copy URL | Clipboard contains URL; button flips to "Copied" |
| Click Copy key on TOTP row | Clipboard contains base32 secret |
| Click Print QR | Native print dialog with the right QR full-page; on-screen UI unchanged |
| Print and cancel | App returns to prior state |
| Scan, then paste different URL | Result replaces |
| Empty paste field after typing | Existing result stays (no clear on empty) |
| No camera available | Camera section shows "No camera available" message; paste still works |

- [ ] **Step 7: Commit**

```
git add index.html styles.css main.js
git commit -m "Switch to phase 4 single-page UI" -m "Single column page with always-present camera and paste inputs. Result section dispatches to migration/otpauth/other layouts. Per-row Copy URL, Copy key, Print QR buttons. Native print via a hidden print slot and CSS @media print rules; on-screen UI never changes during print." -m "Co-Authored-By: Claude Code (Opus 4.7) <noreply@anthropic.com>"
```

---

## Definition of done

At the end of this plan:

- `npm test` passes (20 tests).
- The page loads with three sections (camera, paste, result) and a hint in the result section.
- Scanning or pasting an `otpauth-migration://` URL produces a Migration card with one row per account, each with Copy URL, Copy key, and Print QR buttons.
- Scanning or pasting an `otpauth://` URL produces a single account card.
- Scanning or pasting anything else produces an "Other" card with Copy text and Print QR buttons.
- Copy buttons flip to "Copied" for ~2 seconds on success and "Failed" on rejection.
- Print buttons trigger the native print dialog with only the target QR visible; the on-screen UI is unchanged before, during, and after.
- A new successful input replaces the result; an empty paste field does not.
- When the camera is unavailable, the camera section shows a message and the paste input still works.
- No `document.getElementById` outside `main.js`. No module imports `window.*` beyond declared imports.
- No deprecation warnings or CSP violations in the browser console (apart from the expected source-map blocks visible only with devtools open).
