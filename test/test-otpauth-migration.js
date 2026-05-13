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
