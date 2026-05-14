# QR Backup

A completely client-side QR backup tool.  Scan the "export" code from your
authenticator app, then print a hard copy you can keep in a safe.  Then when
you die, your executor has a way to get into your accounts.

There is no server, and no data is sent anywhere, so your backups are safe.
You can run a copy of this offline if you wish.

## Building

The only third-party blob that needs building is `dist/qr.js`, a CommonJS
to ESM repackage of `qr.js`. Our own JavaScript is plain ES modules and
ships unbundled for auditability.

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
