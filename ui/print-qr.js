/**
 * QR Backup
 * Copyright (C) 2021, Joey Parrish
 * GPLv3 license, see LICENSE.md
 */

import { renderQrSvg } from './qr-render.js';

export function createPrinter(slot) {
  window.addEventListener('afterprint', () => {
    slot.replaceChildren();
  });
  return {
    print(text) {
      slot.replaceChildren(renderQrSvg(text));
      window.print();
    },
  };
}
