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
  const params = new Map(url.searchParams.entries());
  return { type, label, params };
}

export function assembleOtpauthUrl(otp) {
  const url = new URL('otpauth://');
  url.host = otp.type;
  url.pathname = `/${otp.label}`;
  for (const [key, value] of otp.params) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}
