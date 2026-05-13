/**
 * QR Backup
 * Copyright (C) 2021, Joey Parrish
 * GPLv3 license, see LICENSE.md
 */

import { renderQrSvg } from './ui/qr-render.js';
import { CameraInput } from './camera-input.js';

const cameraRoot = document.getElementById('cameraRoot');
const qrText = document.getElementById('qrText');
const backupButton = document.getElementById('backupButton');
const statusMessage = document.getElementById('statusMessage');
const qrBackup = document.getElementById('qrBackup');
const printButton = document.getElementById('printButton');
const goBackButton = document.getElementById('goBackButton');

let cameraInput = null;

function setStage(name) {
  document.body.setAttribute('stage', name);
}

function setStatus(content) {
  statusMessage.textContent = content;
}

function delay(seconds) {
  return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

function readyToScan() {
  setStage('scan');
  setStatus('Open Google Authenticator, "Transfer accounts", "Export accounts", "Next", Scan QR');
}

function handleScanResult(text) {
  backupButton.style.display = 'inline-block';
  qrText.textContent = text;
}

backupButton.addEventListener('click', async () => {
  await cameraInput.stop();
  qrBackup.replaceChildren(renderQrSvg(qrText.textContent));
  setStatus('Scan this to restore your backup');
  await delay(0.25);
  setStage('backup');
  await delay(0.1);
  window.print();
});

printButton.addEventListener('click', () => {
  window.print();
});

goBackButton.addEventListener('click', async () => {
  await cameraInput.start();
  readyToScan();
});

async function main() {
  setStatus('Detecting cameras...');
  cameraInput = new CameraInput(cameraRoot, { onResult: handleScanResult });
  try {
    await cameraInput.start();
  } catch (e) {
    setStatus('No camera found!');
    return;
  }
  setStatus('Camera found!');
  await delay(1);
  readyToScan();
}

main();
