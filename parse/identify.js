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
