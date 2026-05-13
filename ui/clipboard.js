/**
 * QR Backup
 * Copyright (C) 2021, Joey Parrish
 * GPLv3 license, see LICENSE.md
 */

const SUCCESS_LABEL = '✓ Copied';
const FAILURE_LABEL = '✗ Failed';
const REVERT_DELAY_MS = 2000;

export async function copyToClipboard(text, button) {
  const original = button.textContent;
  let label;
  try {
    await navigator.clipboard.writeText(text);
    label = SUCCESS_LABEL;
  } catch (e) {
    label = FAILURE_LABEL;
  }
  button.textContent = label;
  setTimeout(() => {
    if (button.textContent === label) {
      button.textContent = original;
    }
  }, REVERT_DELAY_MS);
}
