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
