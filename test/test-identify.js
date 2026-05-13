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
