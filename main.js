/**
 * QR Backup
 * Copyright (C) 2021, Joey Parrish
 * GPLv3 license, see LICENSE.md
 */

import { identify } from './parse/identify.js';
import { CameraInput } from './ui/camera-input.js';
import { PasteInput } from './ui/paste-input.js';
import { ResultView } from './ui/result-view.js';
import { createPrinter } from './ui/print-qr.js';

const cameraRoot = document.getElementById('cameraRoot');
const pasteRoot = document.getElementById('pasteRoot');
const resultRoot = document.getElementById('resultRoot');
const printSlot = document.getElementById('printSlot');

const printer = createPrinter(printSlot);
const resultView = new ResultView(resultRoot, { printer });

const pasteInput = new PasteInput(pasteRoot, {
  onResult: (text) => {
    resultView.show(identify(text));
  },
});

const cameraInput = new CameraInput(cameraRoot, {
  onResult: (text) => {
    pasteInput.set(text);
    resultView.show(identify(text));
  },
});

cameraInput.start().catch(() => {
  cameraRoot.replaceChildren();
  const msg = document.createElement('p');
  msg.className = 'result-hint';
  msg.textContent = 'No camera available. Paste a URL below instead.';
  cameraRoot.appendChild(msg);
});
