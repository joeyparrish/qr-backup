import QrScanner from './node_modules/qr-scanner/qr-scanner.min.js';
QrScanner.WORKER_PATH = './node_modules/qr-scanner/qr-scanner-worker.min.js';

let scanner = null;
window.QrScanner = QrScanner;

function setStage(name) {
  document.body.setAttribute('stage', name);
}

function setStatus(content) {
  statusMessage.textContent = content;
}

function delay(seconds) {
  return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

async function updateFlashOptions() {
  const hasFlash = await scanner.hasFlash();
  flashToggle.style.display = hasFlash ? '' : 'none';
}

function onScannerResult(result) {
  backupButton.style.display = 'inline-block';
  qrText.textContent = result;
}

flashToggle.addEventListener('click', async () => {
  await scanner.toggleFlash();
  flashState.textContent = scanner.isFlashOn() ? 'on' : 'off';
});

camList.addEventListener('change', async (event) => {
  await scanner.setCamera(event.target.value);
  await updateFlashOptions();
});

function qrSvg(text, svgElement) {
  while (svgElement.children.length) {
    svgElement.children[0].remove();
  }

  const backup = qrcode(text, {
    errorCorrectLevel: qrcode.ErrorCorrectLevel.H,
  });
  const modules = backup.modules;
  const height = modules.length;
  const width = modules[0].length;
  svgElement.setAttributeNS(null, 'viewBox', `0 0 ${width} ${height}`);

  const svgNs = 'http://www.w3.org/2000/svg';
  for (let y = 0; y < height; ++y) {
    const row = modules[y];
    for (let x = 0; x < row.length; ++x) {
      const cell = row[x];
      const color = cell ? 'black' : 'white';
      const rect = document.createElementNS(svgNs, 'rect');
      rect.setAttributeNS(null, 'x', x.toString());
      rect.setAttributeNS(null, 'y', y.toString());
      rect.setAttributeNS(null, 'width', '1');
      rect.setAttributeNS(null, 'height', '1');
      rect.setAttributeNS(null, 'fill', color);
      rect.setAttributeNS(null, 'stroke', 'none');
      svgElement.appendChild(rect);
    }
  }
}

backupButton.addEventListener('click', async () => {
  scanner.stop();

  qrSvg(qrText.textContent, qrBackup);

  setStatus('Scan this to restore your backup');

  await delay(0.25);  // Extra time for the QR output to update
  setStage('backup');

  await delay(0.1);  // Extra time for the UI to settle before printing
  window.print();
});

function readyToScan() {
  setStage('scan');
  setStatus('Open Google Authenticator, "Transfer accounts", "Export accounts", "Next", Scan QR');
}

printButton.addEventListener('click', () => {
  window.print();
});

goBackButton.addEventListener('click', async () => {
  await scanner.start();
  readyToScan();
});

async function main() {
  setStatus('Detecting cameras...');
  const hasCamera = await QrScanner.hasCamera();
  if (!hasCamera) {
    setStatus('No camera found!');
    return;
  }

  setStatus('Camera found!');

  const cameras = await QrScanner.listCameras(true);
  if (cameras.length == 1) {
    camListGroup.style.display = 'none';
    video.classList.add('no-camera-list');
  } else {
    for (const camera of cameras) {
      const option = document.createElement('option');
      option.value = camera.id;
      option.text = camera.label;
      camList.add(option);
    }
  }

  scanner = window.scanner = new QrScanner(video,
      onScannerResult,
      error => {});

  scanner.setInversionMode('both');
  await scanner.start();
  await updateFlashOptions();

  await delay(1);
  readyToScan();
}

main();
