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
    print(title, text) {
      slot.replaceChildren();

      const h2 = document.createElement('h2');
      h2.textContent = title;
      slot.appendChild(h2);

      const svg = renderQrSvg(text);
      slot.appendChild(svg);

      window.print();
    },
  };
}
