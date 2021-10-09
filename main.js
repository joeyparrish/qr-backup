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

const backupSize = Math.min(window.innerWidth, window.innerHeight);
const backup = new QRCode(qrBackup, {
  text: '',
  width: backupSize,
  height: backupSize,
  colorDark : '#000000',
  colorLight : '#ffffff',
  correctLevel : QRCode.CorrectLevel.H,
});

backupButton.addEventListener('click', async () => {
  scanner.stop();

  backup.makeCode(qrText.textContent);
  setStatus('Scan this to restore your backup');

  await delay(0.25);  // Extra time for the QR output to update
  setStage('backup');

  await delay(0.1);  // Extra time for the UI to settle before printing
  window.print();
});

function readyToScan() {
  setStage('scan');
  setStatus('Scan QR');
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
