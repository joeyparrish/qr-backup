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
