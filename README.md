# QR Backup

QR Backup is a client-side tool for printing paper backups of authenticator QRs
and for breaking a Google Authenticator export QR into individual accounts.
When you die, the executor of your will can use your paper backups to access
your accounts.

**Nothing you scan or type leaves your device. Ever.**

There is no server, and no data is sent anywhere, so your backups are safe.
You can run a copy of this offline if you wish.

## Official Release

Every push to this repo is automatically built and served from
[https://joeyparrish.github.io/qr-backup/](https://joeyparrish.github.io/qr-backup/).

You can also trivially run your own copy.  See ["Building"](#building).

## Philosophy

 - Zero networking once the page is loaded. Enforced by design and reinforced by a
   strict Content Security Policy (`connect-src 'none'`).
 - Only two pinned, auditable runtime dependencies. JavaScript ships unbundled
   as plain ES modules so every line is readable in your browser's devtools.

## Features

 - Scan a QR with your camera or paste a URL.
 - Print a paper backup of any QR.
 - For a Google Authenticator export QR, break it into individual accounts and
   copy or print each one.
 - Copy each account's base32 secret into a password manager.
 - Edit an account's issuer or subject fields before printing or copying.

## Dependencies

 - [`qr-scanner`](https://www.npmjs.com/package/qr-scanner) reads QR codes from
   a video stream.
 - [`qr.js`](https://www.npmjs.com/package/qr.js) generates QR codes for
   printing.

Both are small, and neither has its own dependencies. Versions are pinned in
`package-lock.json`.

## Building

The only built artifact is `dist/qr.js`, a CommonJS-to-ESM repackage of
[`qr.js`](https://www.npmjs.com/package/qr.js). Our own JavaScript is plain ES
modules and ships unbundled.

```
npm ci
npm run build
```

## Testing

Tests use Node's built-in test runner. No additional test dependencies.

```
npm test
```

Tests cover the pure parsing modules (`parse/`) and the pure surface of the QR
matrix builder (`ui/qr-render.js`). UI behavior is verified manually in a
browser.
