/**
 * QR Backup
 * Copyright (C) 2021, Joey Parrish
 * GPLv3 license, see LICENSE.md
 */

import qrcode from '../dist/qr.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

export function qrMatrix(text) {
  const code = qrcode(text, { errorCorrectLevel: qrcode.ErrorCorrectLevel.H });
  const modules = code.modules.map(row => row.map(cell => Boolean(cell)));
  const height = modules.length;
  const width = modules[0].length;
  return { modules, width, height };
}

export function renderQrSvg(text) {
  const { modules, width, height } = qrMatrix(text);
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttributeNS(null, 'viewBox', `0 0 ${width} ${height}`);
  for (let y = 0; y < height; ++y) {
    const row = modules[y];
    for (let x = 0; x < row.length; ++x) {
      const rect = document.createElementNS(SVG_NS, 'rect');
      rect.setAttributeNS(null, 'x', x.toString());
      rect.setAttributeNS(null, 'y', y.toString());
      rect.setAttributeNS(null, 'width', '1');
      rect.setAttributeNS(null, 'height', '1');
      rect.setAttributeNS(null, 'fill', row[x] ? 'black' : 'white');
      rect.setAttributeNS(null, 'stroke', 'none');
      svg.appendChild(rect);
    }
  }
  return svg;
}
