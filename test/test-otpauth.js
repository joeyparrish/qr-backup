import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseOtpauthUrl } from '../parse/otpauth.js';

test('parseOtpauthUrl: TOTP with issuer query param and prefixed label', () => {
  const result = parseOtpauthUrl(
    'otpauth://totp/Example:alice@google.com?issuer=Example&secret=JBSWY3DPEHPK3PXP'
  );
  assert.equal(result.type, 'totp');
  assert.equal(result.label, 'Example:alice@google.com');
  assert.equal(result.params.get('issuer'), 'Example');
  assert.equal(result.params.get('secret'), 'JBSWY3DPEHPK3PXP');
});

test('parseOtpauthUrl: TOTP with no issuer', () => {
  const result = parseOtpauthUrl(
    'otpauth://totp/user-without-issuer?secret=JBSWY3DPEHPK3PXP'
  );
  assert.equal(result.type, 'totp');
  assert.equal(result.label, 'user-without-issuer');
  assert.equal(result.params.get('issuer'), undefined);
  assert.equal(result.params.get('secret'), 'JBSWY3DPEHPK3PXP');
});

test('parseOtpauthUrl: URL-encoded label and issuer', () => {
  const result = parseOtpauthUrl(
    'otpauth://totp/Acme%20Corp%3Auser%40acme.example?issuer=Acme%20Corp&secret=JBSWY3DPEHPK3PXP'
  );
  assert.equal(result.label, 'Acme Corp:user@acme.example');
  assert.equal(result.params.get('issuer'), 'Acme Corp');
  assert.equal(result.params.get('secret'), 'JBSWY3DPEHPK3PXP');
});

test('parseOtpauthUrl: HOTP type recognised', () => {
  const result = parseOtpauthUrl(
    'otpauth://hotp/test?secret=JBSWY3DPEHPK3PXP&counter=0'
  );
  assert.equal(result.type, 'hotp');
});

test('parseOtpauthUrl: missing secret returns empty string for secret', () => {
  const result = parseOtpauthUrl('otpauth://totp/foo?issuer=Bar');
  assert.equal(result.params.get('secret'), undefined);
});

test('parseOtpauthUrl: non-otpauth URL throws', () => {
  assert.throws(() => parseOtpauthUrl('https://example.com'), /otpauth/);
});
