# QR Backup Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the existing QR Backup code into pure and UI modules with no implicit-global access, add a test suite covering the parsers, update `qr-scanner` usage, and enforce zero-networking via CSP. Existing UI behavior must be preserved end to end.

**Architecture:** The runtime splits into pure modules (parsers, QR matrix builder) that take data and return data, and UI modules (camera input today) that own a container element handed to them by `main.js`. `main.js` is the only orchestrator and the only place allowed to do page-wide DOM lookups. Tests use Node's built-in `node:test` and run pure modules directly.

**Tech Stack:** Plain ES modules in the browser. `qr-scanner` (vendored via `node_modules`) for camera decoding. `qr.js` bundled to ESM via `esbuild` for QR generation. `node:test` for unit tests. No new runtime or test dependencies.

**Spec:** `docs/superpowers/specs/2026-05-13-qr-backup-overhaul-design.md`

---

## File layout after this phase

Files that will exist at the end of the refactor:

```
qr-backup/
  index.html                            # CSP meta tag added; camera container element
  main.js                               # thin wiring, only place using getElementById
  styles.css                            # unchanged in this phase
  qr-render.js                          # NEW: pure qrMatrix + renderQrSvg
  camera-input.js                       # NEW: UI module wrapping qr-scanner
  parse/
    identify.js                         # NEW: scheme detection / dispatch
    otpauth.js                          # NEW: parse a single otpauth:// URL
    otpauth-migration.js                # MOVED here from top level
  dist/
    qr.js                               # rebuilt as ESM
  test/
    test-otpauth-migration.js
    test-otpauth.js
    test-identify.js
    test-qr-render.js
    fixtures/
      README.md
      migration-readme-example.json
      migration-single.json
      migration-multi.json
      migration-no-issuer.json
      migration-encoded-label.json
  package.json                          # updated test + build scripts
  README.md                             # short note on build / test commands
```

CSS, license headers, and the existing UI flow stay the way they are.

---

### Task 1: Add test infrastructure

**Files:**
- Modify: `package.json`
- Create: `test/test-smoke.js`

- [ ] **Step 1: Confirm Node is recent enough**

Run: `node --version`
Expected: `v18.x` or newer (built-in `node:test` requires 18+).

If older, the engineer should install a newer Node before continuing.

- [ ] **Step 2: Add a test script to `package.json`**

Open `package.json`. Add a `test` entry under `scripts` so the scripts block looks like:

```json
"scripts": {
  "build": "esbuild --bundle --global-name=qrcode --outfile=dist/qr.js node_modules/qr.js/index.js",
  "test": "node --test test/"
}
```

(The `build` line stays as-is for this task; it is updated in Task 6.)

- [ ] **Step 3: Add a smoke test so `npm test` has something to run**

Create `test/test-smoke.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('node test runner is wired up', () => {
  assert.equal(1 + 1, 2);
});
```

- [ ] **Step 4: Run the test**

Run: `npm test`
Expected: one test passes. No new dependencies were installed.

- [ ] **Step 5: Commit**

```
git add package.json test/test-smoke.js
git commit -m "Add node:test test infrastructure" -m "Co-Authored-By: Claude Code (Opus 4.7) <noreply@anthropic.com>"
```

---

### Task 2: Generate fixtures for the migration parser

The fixtures pair `otpauth-migration://` URLs with the ordered list of `otpauth://` URLs they should decode to. They are produced by a small Go helper that uses the same `migration` package the reference tool in `otpauth/` is built on. No real secrets are used.

**Files:**
- Create: `test/fixtures/gen.go`
- Create: `test/fixtures/README.md`
- Create: `test/fixtures/migration-readme-example.json`
- Create: `test/fixtures/migration-single.json`
- Create: `test/fixtures/migration-multi.json`
- Create: `test/fixtures/migration-no-issuer.json`
- Create: `test/fixtures/migration-encoded-label.json`

- [ ] **Step 1: Confirm Go is available**

Run: `go version`
Expected: Go 1.20 or newer. The plan was authored against Go 1.22.

- [ ] **Step 2: Build the reference tool for sanity checks**

Run:
```
go build -C otpauth -o /tmp/otpauth-ref .
```

Expected: `/tmp/otpauth-ref` exists and is executable. Confirm it works:

```
/tmp/otpauth-ref -link "otpauth-migration://offline?data=CjEKCkhlbGxvId6tvu8SGEV4YW1wbGU6YWxpY2VAZ29wZ2xlLmNvbRoHRXhhbXBsZTAC" 2>/dev/null || true
/tmp/otpauth-ref -link "otpauth-migration://offline?data=CjEKCkhlbGxvId6tvu8SGEV4YW1wbGU6YWxpY2VAZ29vZ2xlLmNvbRoHRXhhbXBsZTAC"
```

The second invocation (the canonical example from the README) should print:

```
otpauth://totp/Example:alice@google.com?issuer=Example&secret=JBSWY3DPEHPK3PXP
```

- [ ] **Step 3: Save the README example as a fixture**

Create `test/fixtures/migration-readme-example.json`:

```json
{
  "description": "Public example URL from the otpauth tool README. Single TOTP account.",
  "input": "otpauth-migration://offline?data=CjEKCkhlbGxvId6tvu8SGEV4YW1wbGU6YWxpY2VAZ29vZ2xlLmNvbRoHRXhhbXBsZTAC",
  "expected": [
    "otpauth://totp/Example:alice@google.com?issuer=Example&secret=JBSWY3DPEHPK3PXP"
  ]
}
```

- [ ] **Step 4: Write the Go fixture generator**

The `otpauth/migration` package exposes everything we need:

- `migration.Payload` and `migration.Payload_OtpParameters` (proto types).
- `proto.Marshal(*Payload)` to encode.
- `migration.URL([]byte) *url.URL` to wrap the encoded bytes in the `otpauth-migration://` URL.
- `op.URL()` on each `Payload_OtpParameters` to produce the canonical `otpauth://` form.

Create `test/fixtures/gen.go`. This file lives outside the otpauth project's Go module, so it uses a `replace` directive trick: instead of declaring its own module, copy the file into `otpauth/` at build time. The plan does that explicitly in Step 5; the source itself is plain Go:

```go
// Generates JSON fixtures for the qr-backup migration parser tests.
// Run via the wrapper script described in test/fixtures/README.md.
package main

import (
	"encoding/json"
	"fmt"
	"os"

	"github.com/dim13/otpauth/migration"
	"google.golang.org/protobuf/proto"
)

type fixture struct {
	Description string   `json:"description"`
	Input       string   `json:"input"`
	Expected    []string `json:"expected"`
}

type account struct {
	Type   migration.Payload_OtpParameters_OtpType
	Name   string
	Issuer string
	Secret []byte
}

func build(desc string, accounts []account) fixture {
	payload := &migration.Payload{Version: 1, BatchSize: 1, BatchIndex: 0}
	for _, a := range accounts {
		payload.OtpParameters = append(payload.OtpParameters, &migration.Payload_OtpParameters{
			Secret: a.Secret,
			Name:   a.Name,
			Issuer: a.Issuer,
			Type:   a.Type,
		})
	}
	data, err := proto.Marshal(payload)
	if err != nil {
		panic(err)
	}
	u := migration.URL(data)
	expected := make([]string, 0, len(payload.OtpParameters))
	for _, op := range payload.OtpParameters {
		expected = append(expected, op.URL().String())
	}
	return fixture{Description: desc, Input: u.String(), Expected: expected}
}

func write(path string, f fixture) {
	out, err := json.MarshalIndent(f, "", "  ")
	if err != nil {
		panic(err)
	}
	out = append(out, '\n')
	if err := os.WriteFile(path, out, 0644); err != nil {
		panic(err)
	}
	fmt.Println("wrote", path)
}

func main() {
	totp := migration.Payload_OtpParameters_OTP_TYPE_TOTP

	// Bytes chosen so that the base32 encodings are easy to recognise.
	// "HelloWorld" -> JBSWY3DPK5XXE3DE  (no padding, matches the Go tool).
	secretA := []byte("HelloWorld")
	// Different bytes, different length.
	secretB := []byte("0123456789")
	// Short secret to exercise the no-padding path.
	secretC := []byte{0x48, 0x65, 0x6c, 0x6c, 0x6f}

	write("migration-single.json", build(
		"Single synthetic TOTP account with issuer.",
		[]account{{Type: totp, Name: "Test:user1@test", Issuer: "Test", Secret: secretA}},
	))

	write("migration-multi.json", build(
		"Three synthetic TOTP accounts with mixed issuers.",
		[]account{
			{Type: totp, Name: "Test:user1@test", Issuer: "Test", Secret: secretA},
			{Type: totp, Name: "Test:user2@test", Issuer: "Test", Secret: secretB},
			{Type: totp, Name: "Other:user3@test", Issuer: "Other", Secret: secretC},
		},
	))

	write("migration-no-issuer.json", build(
		"Synthetic account with no issuer field.",
		[]account{{Type: totp, Name: "user-without-issuer", Secret: secretA}},
	))

	write("migration-encoded-label.json", build(
		"Synthetic account whose label and issuer contain characters that must be URL-encoded.",
		[]account{{Type: totp, Name: "Acme Corp:user@acme.example", Issuer: "Acme Corp", Secret: secretA}},
	))
}
```

- [ ] **Step 5: Run the generator**

The generator imports `github.com/dim13/otpauth/migration`, which is the package inside `otpauth/`. The easiest way to give it that import path is to run it from inside the `otpauth/` directory:

```
cp test/fixtures/gen.go otpauth/gen_fixtures.go
( cd otpauth && go run ./gen_fixtures.go )
mv otpauth/migration-*.json test/fixtures/
rm otpauth/gen_fixtures.go
```

Expected: four JSON files appear in `test/fixtures/`. Each has a `description`, an `input` (the migration URL), and an `expected` array of `otpauth://` URLs.

- [ ] **Step 6: Sanity-check one of the generated fixtures**

Pick `test/fixtures/migration-multi.json`. Take its `input` value and pass it back through the reference tool:

```
/tmp/otpauth-ref -link "<input value here>"
```

Expected: stdout contains exactly the three URLs in the fixture's `expected` array, in the same order. If the fixture and the tool disagree, the generator or the package version is wrong; do not proceed until they agree.

- [ ] **Step 7: Write `test/fixtures/README.md`**

```markdown
# Migration parser fixtures

Each `migration-*.json` file pairs an `otpauth-migration://` URL with the
ordered list of `otpauth://` URLs it should decode to. They were
generated by `gen.go` in this directory, which builds protobuf payloads
using the `dim13/otpauth/migration` package (the same package the
reference tool in `../../otpauth/` is built on) and records both the
encoded migration URL and the canonical `otpauth://` form for each
account.

Synthetic secrets only. No real account data.

The exception is `migration-readme-example.json`, whose input is the
public example URL from the `dim13/otpauth` README. It was decoded with
the reference tool to obtain the expected output.

To regenerate the synthetic fixtures:

    cp test/fixtures/gen.go otpauth/gen_fixtures.go
    ( cd otpauth && go run ./gen_fixtures.go )
    mv otpauth/migration-*.json test/fixtures/
    rm otpauth/gen_fixtures.go

Do not hand-edit the `expected` arrays. If a fixture needs to change,
edit `gen.go` and regenerate.
```

- [ ] **Step 8: Run `npm test` to confirm nothing regressed**

Run: `npm test`
Expected: smoke test still passes. New JSON files are not tests yet.

- [ ] **Step 9: Commit**

```
git add test/fixtures/
git commit -m "Add otpauth-migration parser fixtures" -m "Generated via a small Go program using the dim13/otpauth migration package. Synthetic secrets only." -m "Co-Authored-By: Claude Code (Opus 4.7) <noreply@anthropic.com>"
```

---

### Task 3: Move `otpauth-migration.js` to `parse/` and add fixture tests

**Files:**
- Move: `otpauth-migration.js` to `parse/otpauth-migration.js`
- Create: `test/test-otpauth-migration.js`

- [ ] **Step 1: Move the existing module**

Run:
```
mkdir -p parse
git mv otpauth-migration.js parse/otpauth-migration.js
```

- [ ] **Step 2: Write the fixture-driven failing test**

Create `test/test-otpauth-migration.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { decodeMigrationUrl, isMigrationUrl } from '../parse/otpauth-migration.js';

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

async function loadFixtures() {
  const names = (await readdir(fixturesDir)).filter(n => n.startsWith('migration-') && n.endsWith('.json'));
  const fixtures = [];
  for (const name of names) {
    const body = await readFile(join(fixturesDir, name), 'utf8');
    fixtures.push({ name, ...JSON.parse(body) });
  }
  return fixtures;
}

const fixtures = await loadFixtures();

for (const fixture of fixtures) {
  test(`decodeMigrationUrl: ${fixture.name}`, () => {
    assert.equal(isMigrationUrl(fixture.input), true);
    const actual = decodeMigrationUrl(fixture.input);
    assert.deepEqual(actual, fixture.expected);
  });
}

test('isMigrationUrl rejects non-migration URLs', () => {
  assert.equal(isMigrationUrl('otpauth://totp/foo?secret=ABC'), false);
  assert.equal(isMigrationUrl('https://example.com'), false);
  assert.equal(isMigrationUrl(''), false);
});
```

- [ ] **Step 3: Run tests**

Run: `npm test`
Expected: all five migration fixture tests run. If any fail, the parser
is wrong; do not skip them.

- [ ] **Step 4: If any tests fail, fix `parse/otpauth-migration.js`**

The parser must match the Go reference tool's output exactly. Likely
failure points to check:
- `base32Encode` padding (`==`) for secret lengths that are not multiples
  of 5 bytes. The fixtures may include both padded and unpadded forms;
  align with what the Go tool emits.
- URL-encoding of the label: `encodeURIComponent` vs. `URLSearchParams`
  may differ from the Go tool. Match the Go tool's output.
- Optional fields (issuer absent, algorithm default, digits default,
  period default).

Re-run `npm test` after each fix until all fixture tests pass.

- [ ] **Step 5: Commit**

```
git add parse/otpauth-migration.js test/test-otpauth-migration.js
git commit -m "Move otpauth-migration parser into parse/ and test it" -m "Fixture-driven tests verify the parser against the dim13/otpauth Go reference tool's output." -m "Co-Authored-By: Claude Code (Opus 4.7) <noreply@anthropic.com>"
```

---

### Task 4: Add `parse/identify.js` with tests

This module is the dispatch layer. It takes any text scanned or pasted and returns a normalized object describing what it found.

**Files:**
- Create: `parse/identify.js`
- Create: `test/test-identify.js`

The return type is one of:

```
{ kind: 'migration', input, accounts }   // accounts: string[] of otpauth:// URLs
{ kind: 'otpauth',   input }             // a single otpauth:// URL
{ kind: 'other',     input }             // anything else (plain text, http URL, etc.)
```

`accounts` for migration is the result of running the migration parser. Parsing the individual `otpauth://` URLs into structured form is the job of `parse/otpauth.js` (Task 5) and is not done here; the dispatcher only identifies and splits.

- [ ] **Step 1: Write the failing test**

Create `test/test-identify.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { identify } from '../parse/identify.js';

test('identify: migration URL returns kind=migration with accounts', () => {
  const migration = 'otpauth-migration://offline?data=CjEKCkhlbGxvId6tvu8SGEV4YW1wbGU6YWxpY2VAZ29vZ2xlLmNvbRoHRXhhbXBsZTAC';
  const result = identify(migration);
  assert.equal(result.kind, 'migration');
  assert.equal(result.input, migration);
  assert.ok(Array.isArray(result.accounts));
  assert.equal(result.accounts.length, 1);
  assert.match(result.accounts[0], /^otpauth:\/\/totp\//);
});

test('identify: single otpauth URL returns kind=otpauth', () => {
  const url = 'otpauth://totp/Example:alice@google.com?issuer=Example&secret=JBSWY3DPEHPK3PXP';
  const result = identify(url);
  assert.equal(result.kind, 'otpauth');
  assert.equal(result.input, url);
});

test('identify: arbitrary text returns kind=other', () => {
  const result = identify('https://example.com/some-page');
  assert.equal(result.kind, 'other');
  assert.equal(result.input, 'https://example.com/some-page');
});

test('identify: plain text returns kind=other', () => {
  const result = identify('hello world');
  assert.equal(result.kind, 'other');
});

test('identify: empty input returns kind=other', () => {
  const result = identify('');
  assert.equal(result.kind, 'other');
  assert.equal(result.input, '');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: identify tests fail with module not found.

- [ ] **Step 3: Implement the module**

Create `parse/identify.js`:

```js
/**
 * QR Backup
 * Copyright (C) 2021, Joey Parrish
 * GPLv3 license, see LICENSE.md
 */

import { isMigrationUrl, decodeMigrationUrl } from './otpauth-migration.js';

export function identify(text) {
  if (typeof text !== 'string') {
    return { kind: 'other', input: '' };
  }
  if (isMigrationUrl(text)) {
    return {
      kind: 'migration',
      input: text,
      accounts: decodeMigrationUrl(text),
    };
  }
  if (text.startsWith('otpauth://')) {
    return { kind: 'otpauth', input: text };
  }
  return { kind: 'other', input: text };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all identify tests pass; all earlier tests still pass.

- [ ] **Step 5: Commit**

```
git add parse/identify.js test/test-identify.js
git commit -m "Add parse/identify.js for QR scheme dispatch" -m "Co-Authored-By: Claude Code (Opus 4.7) <noreply@anthropic.com>"
```

---

### Task 5: Add `parse/otpauth.js` with tests

Parses a single `otpauth://` URL into a structured object. The fields the tool needs are: `type` (`totp` or `hotp`), `label` (decoded), `issuer` (decoded, optional), and `secret` (base32 string as it appears in the URL).

**Files:**
- Create: `parse/otpauth.js`
- Create: `test/test-otpauth.js`

- [ ] **Step 1: Write the failing test**

Create `test/test-otpauth.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseOtpauthUrl } from '../parse/otpauth.js';

test('parseOtpauthUrl: TOTP with issuer query param and prefixed label', () => {
  const result = parseOtpauthUrl(
    'otpauth://totp/Example:alice@google.com?issuer=Example&secret=JBSWY3DPEHPK3PXP'
  );
  assert.equal(result.type, 'totp');
  assert.equal(result.label, 'Example:alice@google.com');
  assert.equal(result.issuer, 'Example');
  assert.equal(result.secret, 'JBSWY3DPEHPK3PXP');
});

test('parseOtpauthUrl: TOTP with no issuer', () => {
  const result = parseOtpauthUrl(
    'otpauth://totp/user-without-issuer?secret=JBSWY3DPEHPK3PXP'
  );
  assert.equal(result.type, 'totp');
  assert.equal(result.label, 'user-without-issuer');
  assert.equal(result.issuer, '');
  assert.equal(result.secret, 'JBSWY3DPEHPK3PXP');
});

test('parseOtpauthUrl: URL-encoded label and issuer', () => {
  const result = parseOtpauthUrl(
    'otpauth://totp/Acme%20Corp%3Auser%40acme.example?issuer=Acme%20Corp&secret=JBSWY3DPEHPK3PXP'
  );
  assert.equal(result.label, 'Acme Corp:user@acme.example');
  assert.equal(result.issuer, 'Acme Corp');
  assert.equal(result.secret, 'JBSWY3DPEHPK3PXP');
});

test('parseOtpauthUrl: HOTP type recognised', () => {
  const result = parseOtpauthUrl(
    'otpauth://hotp/test?secret=JBSWY3DPEHPK3PXP&counter=0'
  );
  assert.equal(result.type, 'hotp');
});

test('parseOtpauthUrl: missing secret returns empty string for secret', () => {
  const result = parseOtpauthUrl('otpauth://totp/foo?issuer=Bar');
  assert.equal(result.secret, '');
});

test('parseOtpauthUrl: non-otpauth URL throws', () => {
  assert.throws(() => parseOtpauthUrl('https://example.com'), /otpauth/);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: otpauth tests fail with module not found.

- [ ] **Step 3: Implement the module**

Create `parse/otpauth.js`:

```js
/**
 * QR Backup
 * Copyright (C) 2021, Joey Parrish
 * GPLv3 license, see LICENSE.md
 */

export function parseOtpauthUrl(text) {
  if (typeof text !== 'string' || !text.startsWith('otpauth://')) {
    throw new Error('Not an otpauth:// URL');
  }
  const url = new URL(text);
  const type = url.host.toLowerCase();
  const label = decodeURIComponent(url.pathname.replace(/^\//, ''));
  const issuer = url.searchParams.get('issuer') || '';
  const secret = url.searchParams.get('secret') || '';
  return { type, label, issuer, secret };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all otpauth tests pass; everything else still passes.

- [ ] **Step 5: Commit**

```
git add parse/otpauth.js test/test-otpauth.js
git commit -m "Add parse/otpauth.js for single otpauth URL parsing" -m "Co-Authored-By: Claude Code (Opus 4.7) <noreply@anthropic.com>"
```

---

### Task 6: Switch the `qr.js` build to ESM

Today the build emits an IIFE that assigns `qrcode` to `window`. The next task needs to import `qrcode` as a module. Switch the build output to ESM and update `main.js` to import it.

**Files:**
- Modify: `package.json`
- Modify: `index.html`
- Modify: `main.js`

- [ ] **Step 1: Update the build script**

Open `package.json`. Change the `build` script from:

```json
"build": "esbuild --bundle --global-name=qrcode --outfile=dist/qr.js node_modules/qr.js/index.js"
```

to:

```json
"build": "esbuild --bundle --format=esm --outfile=dist/qr.js node_modules/qr.js/index.js"
```

- [ ] **Step 2: Rebuild**

Run: `npm run build`
Expected: `dist/qr.js` is regenerated. Inspect the first and last few lines to confirm it ends with an `export { ... as default }` or similar ESM export, not an IIFE writing to `window`.

If `qr.js` does not export a default cleanly through esbuild's `--format=esm`, fall back to:

```
esbuild --bundle --format=esm --outfile=dist/qr.js --footer:js="export default qrcode;" --banner:js="let qrcode;" node_modules/qr.js/index.js
```

Verify the output names work in the next step.

- [ ] **Step 3: Remove the script tag from `index.html`**

In `index.html`, delete the line:

```html
    <script src="dist/qr.js"></script>
```

`main.js` will import from it instead.

- [ ] **Step 4: Update `main.js` to import `qrcode`**

In `main.js`, near the top (after the existing `QrScanner` import), add:

```js
import qrcode from './dist/qr.js';
```

Then remove any reliance on the global `qrcode` in `main.js`. The existing `qrSvg` function uses `qrcode(...)` and `qrcode.ErrorCorrectLevel`; both are still available through the imported value.

- [ ] **Step 5: Manually verify the page still works**

Serve the directory over HTTP (e.g., `python3 -m http.server`) and open it in a browser. Confirm:
- The page loads without console errors.
- The camera starts (status reaches "Open Google Authenticator...").
- Scanning a QR still updates `qrText`.
- Clicking "Print backup" still renders an SVG QR in the backup stage.

(`file://` opening may not work reliably with ES module imports; HTTP is fine for verification.)

- [ ] **Step 6: Run unit tests**

Run: `npm test`
Expected: all tests still pass. (No new tests in this task; the build change is browser-only.)

- [ ] **Step 7: Commit**

```
git add package.json index.html main.js dist/qr.js
git commit -m "Build dist/qr.js as ESM and import it in main.js" -m "Removes reliance on a window-level qrcode global." -m "Co-Authored-By: Claude Code (Opus 4.7) <noreply@anthropic.com>"
```

(Note: `dist/` is in `.gitignore`. Do not force-add `dist/qr.js` unless it was already tracked. If `git add dist/qr.js` is silently ignored, that is correct; leave it out of the commit.)

---

### Task 7: Add `qr-render.js` and use it from `main.js`

The pure surface (`qrMatrix`) is testable in Node. The DOM-producing surface (`renderQrSvg`) is verified manually.

**Files:**
- Create: `qr-render.js`
- Create: `test/test-qr-render.js`
- Modify: `main.js`

- [ ] **Step 1: Write the failing matrix test**

Create `test/test-qr-render.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { qrMatrix } from '../qr-render.js';

test('qrMatrix returns a square grid of booleans', () => {
  const result = qrMatrix('hello');
  assert.equal(typeof result, 'object');
  assert.ok(Array.isArray(result.modules));
  assert.equal(result.height, result.modules.length);
  assert.equal(result.width, result.modules[0].length);
  assert.equal(result.width, result.height);
  for (const row of result.modules) {
    assert.equal(row.length, result.width);
    for (const cell of row) {
      assert.equal(typeof cell, 'boolean');
    }
  }
});

test('qrMatrix grows with input length', () => {
  const small = qrMatrix('hi');
  const big = qrMatrix('hi'.repeat(200));
  assert.ok(big.width >= small.width);
});

test('qrMatrix produces deterministic output for the same input', () => {
  const a = qrMatrix('otpauth://totp/Example?secret=JBSWY3DPEHPK3PXP');
  const b = qrMatrix('otpauth://totp/Example?secret=JBSWY3DPEHPK3PXP');
  assert.deepEqual(a, b);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: qr-render tests fail with module not found.

- [ ] **Step 3: Implement the module**

Create `qr-render.js`:

```js
/**
 * QR Backup
 * Copyright (C) 2021, Joey Parrish
 * GPLv3 license, see LICENSE.md
 */

import qrcode from './dist/qr.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

export function qrMatrix(text) {
  const code = qrcode(text, { errorCorrectLevel: qrcode.ErrorCorrectLevel.H });
  const modules = code.modules.map(row => row.map(cell => Boolean(cell)));
  const height = modules.length;
  const width = modules[0].length;
  return { modules, width, height };
}

export function renderQrSvg(text) {
  const { modules, width, height } = qrMatrix(text);
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttributeNS(null, 'viewBox', `0 0 ${width} ${height}`);
  for (let y = 0; y < height; ++y) {
    const row = modules[y];
    for (let x = 0; x < row.length; ++x) {
      const rect = document.createElementNS(SVG_NS, 'rect');
      rect.setAttributeNS(null, 'x', x.toString());
      rect.setAttributeNS(null, 'y', y.toString());
      rect.setAttributeNS(null, 'width', '1');
      rect.setAttributeNS(null, 'height', '1');
      rect.setAttributeNS(null, 'fill', row[x] ? 'black' : 'white');
      rect.setAttributeNS(null, 'stroke', 'none');
      svg.appendChild(rect);
    }
  }
  return svg;
}
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: qrMatrix tests pass. The `qr.js` package was verified to have no browser-global references, so importing the ESM build in Node works without any shim.

- [ ] **Step 5: Update `main.js` to use `renderQrSvg`**

In `main.js`:

1. Remove the local `qrSvg` function.
2. Remove the `import qrcode from './dist/qr.js'` line added in Task 6, since it now lives in `qr-render.js`.
3. Add: `import { renderQrSvg } from './qr-render.js';`
4. In the `backupButton.addEventListener('click', ...)` handler, replace the `qrSvg(qrText.textContent, qrBackup)` call with:

```js
qrBackup.replaceChildren(renderQrSvg(qrText.textContent));
```

(Note: the old code mutated `qrBackup` directly. The new `renderQrSvg` returns a fresh `<svg>` so we mount it by replacing children. The outer container `#qrBackup` is itself an `<svg>` today; replace its tag with `<div id="qrBackup">` in `index.html` so the fresh `<svg>` is mounted inside.)

5. In `index.html`, change:

```html
      <div class="center-contents"><svg id="qrBackup"></svg></div>
```

to:

```html
      <div class="center-contents"><div id="qrBackup"></div></div>
```

6. In `styles.css`, the existing `#qrBackup` rule sets `width: 100%; max-height: 60vh; max-width: 60vh`. That still applies to the wrapping `<div>`. The inner `<svg>` should size to its parent; add a rule:

```css
#qrBackup > svg {
  width: 100%;
  height: auto;
  max-height: 60vh;
}
```

- [ ] **Step 6: Manually verify the page still works**

Run a local HTTP server (`python3 -m http.server`) and open the page. Scan a QR, click "Print backup", confirm the printed QR is visually unchanged from before this task.

- [ ] **Step 7: Run unit tests**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 8: Commit**

```
git add qr-render.js test/test-qr-render.js main.js index.html styles.css
git commit -m "Extract QR rendering into qr-render.js" -m "Pure qrMatrix is tested in Node; renderQrSvg returns a fresh SVG element that main.js mounts." -m "Co-Authored-By: Claude Code (Opus 4.7) <noreply@anthropic.com>"
```

---

### Task 8: Extract `camera-input.js` and modernize `qr-scanner` usage

The camera-input UI module owns its container's contents: the camera-selector group, the flash toggle, and the video element. It calls an `onResult` callback with the scanned text. The deprecated `QrScanner.WORKER_PATH` setter and the legacy `onDecode(string)` signature are replaced with the current API.

**Files:**
- Create: `camera-input.js`
- Modify: `index.html`
- Modify: `main.js`

- [ ] **Step 1: Add a single camera container to `index.html`**

In `index.html`, inside `<div class="stage stage-scan no-print">`, replace the existing camera-related markup (the `camListGroup` div, the flash-toggle div, and the video div) with a single empty container:

```html
    <div class="stage stage-scan no-print">
      <div id="cameraRoot"></div>

      <div class="center-contents margin-below">
        <button id="backupButton">Print backup</button>
        <div id="qrText"></div>
      </div>
    </div>
```

The `backupButton` + `qrText` block is unchanged.

- [ ] **Step 2: Implement `camera-input.js`**

Create `camera-input.js`:

```js
/**
 * QR Backup
 * Copyright (C) 2021, Joey Parrish
 * GPLv3 license, see LICENSE.md
 */

import QrScanner from './node_modules/qr-scanner/qr-scanner.min.js';

const WORKER_PATH = './node_modules/qr-scanner/qr-scanner-worker.min.js';

export class CameraInput {
  constructor(container, { onResult } = {}) {
    this.container = container;
    this.onResult = onResult || (() => {});
    this.scanner = null;

    this.camListGroup = document.createElement('div');
    this.camListGroup.className = 'center-contents';
    const camLabelRow = document.createElement('div');
    const camLabel = document.createElement('label');
    camLabel.setAttribute('for', 'camList');
    camLabel.textContent = 'Preferred camera:';
    camLabelRow.appendChild(camLabel);
    this.camListGroup.appendChild(camLabelRow);
    const camSelectRow = document.createElement('div');
    this.camList = document.createElement('select');
    this.camList.id = 'camList';
    const placeholder = document.createElement('option');
    placeholder.textContent = 'Select a camera';
    placeholder.selected = true;
    placeholder.disabled = true;
    this.camList.add(placeholder);
    camSelectRow.appendChild(this.camList);
    this.camListGroup.appendChild(camSelectRow);

    this.flashRow = document.createElement('div');
    this.flashRow.className = 'center-contents margin-below';
    this.flashToggle = document.createElement('button');
    this.flashToggle.id = 'flashToggle';
    this.flashToggle.textContent = 'Flash: ';
    this.flashState = document.createElement('span');
    this.flashState.id = 'flashState';
    this.flashState.textContent = 'off';
    this.flashToggle.appendChild(this.flashState);
    this.flashRow.appendChild(this.flashToggle);

    this.videoRow = document.createElement('div');
    this.videoRow.className = 'center-contents margin-below';
    this.video = document.createElement('video');
    this.video.id = 'video';
    this.videoRow.appendChild(this.video);

    this.container.appendChild(this.camListGroup);
    this.container.appendChild(this.flashRow);
    this.container.appendChild(this.videoRow);

    this.camList.addEventListener('change', async (event) => {
      if (!this.scanner) return;
      await this.scanner.setCamera(event.target.value);
      await this._refreshFlash();
    });

    this.flashToggle.addEventListener('click', async () => {
      if (!this.scanner) return;
      await this.scanner.toggleFlash();
      this.flashState.textContent = this.scanner.isFlashOn() ? 'on' : 'off';
    });
  }

  async start() {
    const hasCamera = await QrScanner.hasCamera();
    if (!hasCamera) {
      throw new Error('No camera found');
    }

    const cameras = await QrScanner.listCameras(true);
    if (cameras.length === 1) {
      this.camListGroup.style.display = 'none';
      this.video.classList.add('no-camera-list');
    } else {
      for (const camera of cameras) {
        const option = document.createElement('option');
        option.value = camera.id;
        option.text = camera.label;
        this.camList.add(option);
      }
    }

    this.scanner = new QrScanner(
      this.video,
      (scan) => this.onResult(scan.data),
      {
        returnDetailedScanResult: true,
        highlightScanRegion: true,
        highlightCodeOutline: true,
        workerPath: WORKER_PATH,
      },
    );
    this.scanner.setInversionMode('both');

    await this.scanner.start();
    await this._refreshFlash();
  }

  async stop() {
    if (this.scanner) {
      this.scanner.stop();
    }
  }

  async _refreshFlash() {
    if (!this.scanner) {
      this.flashRow.style.display = 'none';
      return;
    }
    const hasFlash = await this.scanner.hasFlash();
    this.flashRow.style.display = hasFlash ? '' : 'none';
  }
}
```

Notes:
- `returnDetailedScanResult: true` opts into the modern callback signature where the second arg is `{ data, ... }`.
- `workerPath` is passed via the options object instead of the deprecated `QrScanner.WORKER_PATH = ...` static setter.
- IDs on child elements (`camList`, `flashToggle`, `flashState`, `video`) are preserved so the existing CSS continues to match without change.

- [ ] **Step 3: Replace `main.js` with the full new version**

Overwrite the entire contents of `main.js` with:

```js
/**
 * QR Backup
 * Copyright (C) 2021, Joey Parrish
 * GPLv3 license, see LICENSE.md
 */

import { renderQrSvg } from './qr-render.js';
import { CameraInput } from './camera-input.js';

const cameraRoot = document.getElementById('cameraRoot');
const qrText = document.getElementById('qrText');
const backupButton = document.getElementById('backupButton');
const statusMessage = document.getElementById('statusMessage');
const qrBackup = document.getElementById('qrBackup');
const printButton = document.getElementById('printButton');
const goBackButton = document.getElementById('goBackButton');

let cameraInput = null;

function setStage(name) {
  document.body.setAttribute('stage', name);
}

function setStatus(content) {
  statusMessage.textContent = content;
}

function delay(seconds) {
  return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

function readyToScan() {
  setStage('scan');
  setStatus('Open Google Authenticator, "Transfer accounts", "Export accounts", "Next", Scan QR');
}

function handleScanResult(text) {
  backupButton.style.display = 'inline-block';
  qrText.textContent = text;
}

backupButton.addEventListener('click', async () => {
  await cameraInput.stop();
  qrBackup.replaceChildren(renderQrSvg(qrText.textContent));
  setStatus('Scan this to restore your backup');
  await delay(0.25);
  setStage('backup');
  await delay(0.1);
  window.print();
});

printButton.addEventListener('click', () => {
  window.print();
});

goBackButton.addEventListener('click', async () => {
  await cameraInput.start();
  readyToScan();
});

async function main() {
  setStatus('Detecting cameras...');
  cameraInput = new CameraInput(cameraRoot, { onResult: handleScanResult });
  try {
    await cameraInput.start();
  } catch (e) {
    setStatus('No camera found!');
    return;
  }
  setStatus('Camera found!');
  await delay(1);
  readyToScan();
}

main();
```

This file is the only place in the codebase that calls `document.getElementById`. The deprecated `QrScanner` imports and `WORKER_PATH` setter are gone (they now live inside `camera-input.js`, which uses the modern options-object form).

- [ ] **Step 4: Manually verify the page**

Serve over HTTP and open in a browser. Confirm:
- Page loads with no console errors and no deprecation warnings from `qr-scanner`.
- Camera starts.
- If multiple cameras exist, the dropdown lists them; if only one, the dropdown is hidden.
- Flash toggle appears only when the camera supports it.
- Scanning a QR shows the text and reveals the "Print backup" button.
- Clicking "Print backup" renders the printable QR and opens the print dialog.
- "Go back" returns to scanning.

- [ ] **Step 5: Run unit tests**

Run: `npm test`
Expected: all tests still pass.

- [ ] **Step 6: Commit**

```
git add camera-input.js main.js index.html
git commit -m "Extract camera-input.js and adopt current qr-scanner API" -m "Camera UI now owns its container and uses returnDetailedScanResult and workerPath options, removing the WORKER_PATH and string-result deprecation paths." -m "Co-Authored-By: Claude Code (Opus 4.7) <noreply@anthropic.com>"
```

---

### Task 9: Eliminate remaining implicit-global DOM access

After Task 8, `main.js` already calls `document.getElementById` for the elements it owns. This task is a sweep to confirm: no implicit `window.<id>` access anywhere in the JS, and no module other than `main.js` calls `document.getElementById` or any other document-wide lookup.

**Files:**
- Modify: `main.js` (only if violations are found)

- [ ] **Step 1: Grep for implicit-global access patterns**

Run:
```
grep -nE 'qrText|backupButton|statusMessage|qrBackup|printButton|goBackButton|cameraRoot|camList|flashToggle|flashState|video' main.js camera-input.js qr-render.js parse/*.js
```

For each hit, verify it is preceded by an explicit `document.getElementById` (in `main.js`) or refers to a local variable created via `document.createElement` (in `camera-input.js`). There must be no usages that rely on the browser silently exposing `id`-named elements as window properties.

- [ ] **Step 2: Grep for cross-module DOM lookups**

Run:
```
grep -nE 'document\.getElementById|document\.querySelector|document\.querySelectorAll|document\.body|window\.' camera-input.js qr-render.js parse/*.js
```

Expected: no hits. Modules other than `main.js` must not reach into the document.

If any hits appear, refactor them. Pure modules in `parse/` should never have any of these; `camera-input.js` should only touch its own `this.container` and descendants.

- [ ] **Step 3: Manually verify the page still works**

Serve over HTTP, run through the scan-print-go-back loop one more time. No console errors.

- [ ] **Step 4: Commit (if any changes were made)**

```
git add main.js camera-input.js qr-render.js parse/
git commit -m "Confirm no implicit-global DOM access outside main.js" -m "Co-Authored-By: Claude Code (Opus 4.7) <noreply@anthropic.com>"
```

If no changes were needed, skip the commit.

---

### Task 10: Add the CSP meta tag

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Add the meta tag**

In `index.html`, immediately after the `<meta charset>` line in `<head>`, add:

```html
    <meta http-equiv="Content-Security-Policy"
          content="default-src 'self'; connect-src 'none'; img-src 'self' data: blob:; media-src 'self' blob:; script-src 'self'; style-src 'self' 'unsafe-inline'; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'">
```

Notes on each directive:
- `default-src 'self'` is the baseline.
- `connect-src 'none'` is the load-bearing one for the zero-networking requirement: no `fetch`, `XHR`, or `WebSocket` is allowed to anywhere.
- `img-src 'self' data: blob:` permits `data:` URIs (qr-scanner uses canvases and blob URIs internally).
- `media-src 'self' blob:` permits the camera stream attached to the `<video>` element.
- `worker-src 'self' blob:` permits the qr-scanner worker. The `blob:` allowance covers the case where the worker bundle is dynamically wrapped.
- `style-src 'self' 'unsafe-inline'` permits the existing inline `style="display: ..."` mutations the JS does. (Phase 4 can tighten this when the CSS is rewritten.)
- `object-src 'none'`, `base-uri 'self'`, `form-action 'none'`, `frame-ancestors 'none'` close off other vectors.

- [ ] **Step 2: Serve and verify in the browser**

Run `python3 -m http.server` from the project root. Open the page. Check the browser console for CSP violation reports. Expected: none.

Step through the full UI:
- Camera starts (this exercises `media-src`, `worker-src`).
- Scanning produces a result (this exercises the worker).
- Print backup renders an SVG (this exercises in-DOM SVG creation, which is not network-related and is fine).

If a CSP violation appears for something the app legitimately needs, narrow the policy minimally to allow it and add a comment in the HTML explaining what required the carve-out. Do not loosen `connect-src`; that one is the policy's entire point.

- [ ] **Step 3: Verify networking is blocked**

Open the browser devtools network tab and reload the page. Confirm:
- All requests are to the local origin only (`localhost:<port>`).
- No requests to anything off-origin.

As a sanity check, paste this into the devtools console:

```js
fetch('https://example.com').then(r => console.log('LEAK')).catch(e => console.log('blocked:', e.message));
```

Expected: `blocked: <CSP violation message>`. If it prints `LEAK`, the policy is wrong; fix it.

- [ ] **Step 4: Run unit tests**

Run: `npm test`
Expected: all tests still pass.

- [ ] **Step 5: Commit**

```
git add index.html
git commit -m "Add CSP meta tag enforcing zero networking" -m "connect-src 'none' is the load-bearing directive. Worker and media allowances cover qr-scanner's camera and worker requirements." -m "Co-Authored-By: Claude Code (Opus 4.7) <noreply@anthropic.com>"
```

---

### Task 11: Update README with build / test notes

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Append build and test sections**

Add to the end of `README.md`:

```markdown
## Building

The only third-party blob that needs building is `dist/qr.js`, a CommonJS
to ESM repackage of `qr.js`. Our own JavaScript is plain ES modules and
ships unbundled for auditability.

```
npm install
npm run build
```

## Testing

Tests use Node's built-in test runner. No additional test dependencies.

```
npm test
```

Tests cover the pure parsing modules (`parse/`) and the pure surface of
the QR matrix builder (`qr-render.js`). UI behavior is verified manually
in a browser.
```

- [ ] **Step 2: Commit**

```
git add README.md
git commit -m "Document build and test commands" -m "Co-Authored-By: Claude Code (Opus 4.7) <noreply@anthropic.com>"
```

---

## Definition of done

At the end of this plan:

- `npm test` runs and passes, exercising the migration parser against
  Go-tool-generated fixtures, the individual otpauth URL parser, the
  identify dispatcher, and the QR matrix builder.
- The existing UI flow (scan, print backup, go back) works the same as
  before in a browser.
- No module other than `main.js` calls `document.getElementById` or any
  other page-wide DOM lookup; no module reads any `window.*` global
  beyond declared imports.
- A CSP meta tag is present, `connect-src 'none'` is in effect, and a
  manual `fetch` to an off-origin URL is blocked.
- The deprecated `qr-scanner` usage is gone; no deprecation warnings in
  the console.
- The codebase is ready for phase 4 to rebuild the UI without touching
  parsing, rendering, or camera logic.
