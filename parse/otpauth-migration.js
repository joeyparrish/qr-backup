/**
 * QR Backup
 * Copyright (C) 2021, Joey Parrish
 * GPLv3 license, see LICENSE.md
 */

// Decodes otpauth-migration:// URLs (Google Authenticator export format) into
// individual otpauth:// URLs.  The migration payload is a protobuf message
// base64-encoded in the `data` query parameter.

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(bytes) {
  let bits = 0, value = 0, output = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      output += BASE32[(value >>> bits) & 31];
    }
  }
  if (bits > 0) {
    output += BASE32[(value << (5 - bits)) & 31];
  }
  return output;
}

function readVarint(bytes, pos) {
  let result = 0, shift = 0, byte;
  do {
    byte = bytes[pos++];
    result |= (byte & 0x7f) << shift;
    shift += 7;
  } while (byte & 0x80);
  return { value: result, pos };
}

function readLengthDelimited(bytes, pos) {
  const { value: len, pos: p } = readVarint(bytes, pos);
  return { data: bytes.slice(p, p + len), pos: p + len };
}

function parseOtpParameters(bytes) {
  const otp = {};
  let pos = 0;
  const decoder = new TextDecoder();
  while (pos < bytes.length) {
    const { value: tag, pos: p1 } = readVarint(bytes, pos);
    pos = p1;
    const field = tag >>> 3;
    const wire = tag & 7;
    if (wire === 0) {
      const { value, pos: p2 } = readVarint(bytes, pos);
      pos = p2;
      if (field === 4) otp.algorithm = value;
      else if (field === 5) otp.digits = value;
      else if (field === 6) otp.type = value;
      else if (field === 7) otp.counter = value;
    } else if (wire === 2) {
      const { data, pos: p2 } = readLengthDelimited(bytes, pos);
      pos = p2;
      if (field === 1) otp.secret = data;
      else if (field === 2) otp.name = decoder.decode(data);
      else if (field === 3) otp.issuer = decoder.decode(data);
    }
  }
  return otp;
}

function parsePayload(bytes) {
  const payload = { otpParameters: [] };
  let pos = 0;
  while (pos < bytes.length) {
    const { value: tag, pos: p1 } = readVarint(bytes, pos);
    pos = p1;
    const field = tag >>> 3;
    const wire = tag & 7;
    if (wire === 0) {
      const { pos: p2 } = readVarint(bytes, pos);
      pos = p2;
    } else if (wire === 2) {
      const { data, pos: p2 } = readLengthDelimited(bytes, pos);
      pos = p2;
      if (field === 1) {
        payload.otpParameters.push(parseOtpParameters(data));
      }
    }
  }
  return payload;
}

// proto enum values match array indices: unspecified=0, hotp=1, totp=2
const OTP_TYPE = ['totp', 'hotp', 'totp'];
// unspecified=0 (defaults to SHA1), sha1=1, sha256=2, sha512=3, md5=4
const ALGORITHM = ['SHA1', 'SHA1', 'SHA256', 'SHA512', 'MD5'];
// unspecified=0 (defaults to 6), six=1, eight=2
const DIGITS = [6, 6, 8];

// Encode a label for the otpauth:// path segment.
// The Go url package encodes the path segment with PathEscape, which encodes
// spaces as %20 but leaves : and @ unencoded (they are valid in path segments).
function encodeLabelPath(label) {
  // encodeURIComponent encodes everything except: A-Z a-z 0-9 - _ . ! ~ * ' ( )
  // We additionally want to leave : and @ unencoded, matching Go's url.PathEscape.
  return encodeURIComponent(label).replaceAll('%3A', ':').replaceAll('%40', '@');
}

function otpToUrl(otp) {
  const type = OTP_TYPE[otp.type || 0];
  // Build params in alphabetical order to match Go's url.Values.Encode() output.
  const params = new URLSearchParams();
  if (otp.issuer) params.set('issuer', otp.issuer);
  if (otp.algorithm) params.set('algorithm', ALGORITHM[otp.algorithm]);
  if (otp.digits) params.set('digits', DIGITS[otp.digits]);
  if (type === 'hotp') params.set('counter', otp.counter || 0);
  else params.set('period', '30');
  params.set('secret', base32Encode(otp.secret));
  return `otpauth://${type}/${encodeLabelPath(otp.name || '')}?${params}`;
}

export function isMigrationUrl(url) {
  return url.startsWith('otpauth-migration:');
}

// Returns an array of otpauth:// URL strings, one per account.
export function decodeMigrationUrl(url) {
  const u = new URL(url);
  // URL parsing turns base64 '+' into spaces; put them back before decoding.
  const data = u.searchParams.get('data').replaceAll(' ', '+');
  const bytes = Uint8Array.from(atob(data), c => c.charCodeAt(0));
  return parsePayload(bytes).otpParameters.map(otpToUrl);
}
