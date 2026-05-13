/**
 * QR Backup
 * Copyright (C) 2021, Joey Parrish
 * GPLv3 license, see LICENSE.md
 */

import QrScanner from './node_modules/qr-scanner/qr-scanner.min.js';

// The installed qr-scanner version does not accept workerPath as a constructor
// option; the options-object constructor only supports returnDetailedScanResult,
// onDecodeError, preferredCamera, maxScansPerSecond, highlightScanRegion,
// highlightCodeOutline, and overlay.  The WORKER_PATH static setter is marked
// @deprecated in the type definitions but is the only supported way to supply a
// custom worker path in this version.
QrScanner.WORKER_PATH = './node_modules/qr-scanner/qr-scanner-worker.min.js';

export class CameraInput {
  constructor(container, { onResult } = {}) {
    this.container = container;
    this.onResult = onResult || (() => {});
    this.scanner = null;

    this.camListGroup = document.createElement('div');
    this.camListGroup.className = 'center-contents';
    const camLabelRow = document.createElement('div');
    const camLabel = document.createElement('label');
    camLabel.setAttribute('for', 'camList');
    camLabel.textContent = 'Preferred camera:';
    camLabelRow.appendChild(camLabel);
    this.camListGroup.appendChild(camLabelRow);
    const camSelectRow = document.createElement('div');
    this.camList = document.createElement('select');
    this.camList.id = 'camList';
    const placeholder = document.createElement('option');
    placeholder.textContent = 'Select a camera';
    placeholder.selected = true;
    placeholder.disabled = true;
    this.camList.add(placeholder);
    camSelectRow.appendChild(this.camList);
    this.camListGroup.appendChild(camSelectRow);

    this.flashRow = document.createElement('div');
    this.flashRow.className = 'center-contents margin-below';
    this.flashToggle = document.createElement('button');
    this.flashToggle.id = 'flashToggle';
    this.flashToggle.textContent = 'Flash: ';
    this.flashState = document.createElement('span');
    this.flashState.id = 'flashState';
    this.flashState.textContent = 'off';
    this.flashToggle.appendChild(this.flashState);
    this.flashRow.appendChild(this.flashToggle);

    this.videoRow = document.createElement('div');
    this.videoRow.className = 'center-contents margin-below';
    this.video = document.createElement('video');
    this.video.id = 'video';
    this.videoRow.appendChild(this.video);

    this.container.appendChild(this.camListGroup);
    this.container.appendChild(this.flashRow);
    this.container.appendChild(this.videoRow);

    this.camList.addEventListener('change', async (event) => {
      if (!this.scanner) return;
      await this.scanner.setCamera(event.target.value);
      await this._refreshFlash();
    });

    this.flashToggle.addEventListener('click', async () => {
      if (!this.scanner) return;
      await this.scanner.toggleFlash();
      this.flashState.textContent = this.scanner.isFlashOn() ? 'on' : 'off';
    });
  }

  async start() {
    const hasCamera = await QrScanner.hasCamera();
    if (!hasCamera) {
      throw new Error('No camera found');
    }

    const cameras = await QrScanner.listCameras(true);
    if (cameras.length === 1) {
      this.camListGroup.style.display = 'none';
      this.video.classList.add('no-camera-list');
    } else {
      for (const camera of cameras) {
        const option = document.createElement('option');
        option.value = camera.id;
        option.text = camera.label;
        this.camList.add(option);
      }
    }

    this.scanner = new QrScanner(
      this.video,
      (scan) => this.onResult(scan.data),
      {
        returnDetailedScanResult: true,
        highlightScanRegion: true,
        highlightCodeOutline: true,
      },
    );
    this.scanner.setInversionMode('both');

    await this.scanner.start();
    await this._refreshFlash();
  }

  async stop() {
    if (this.scanner) {
      this.scanner.stop();
    }
  }

  async _refreshFlash() {
    if (!this.scanner) {
      this.flashRow.style.display = 'none';
      return;
    }
    const hasFlash = await this.scanner.hasFlash();
    this.flashRow.style.display = hasFlash ? '' : 'none';
  }
}
