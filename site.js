(() => {
  const localAddress = '192.168.1.22:5051';
  const localBaseUrl = `http://${localAddress}`;
  const localCandidates = ['', '/stream', '/video', '/mjpeg'].map((path) => `${localBaseUrl}${path}`);

  const cameraImage = document.getElementById('cameraImage');
  const cameraFrame = document.getElementById('cameraFrame');
  const cameraPlaceholder = document.getElementById('cameraPlaceholder');
  const cameraMode = document.getElementById('cameraMode');
  const cameraStatus = document.getElementById('cameraStatus');
  const cameraAddress = document.getElementById('cameraAddress');
  const cameraOpen = document.getElementById('cameraOpen');
  const cameraCopy = document.getElementById('cameraCopy');
  const consoleTone = document.getElementById('consoleTone');

  cameraAddress.textContent = localAddress;
  cameraOpen.href = `${localBaseUrl}/`;

  cameraCopy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(localBaseUrl);
      cameraCopy.textContent = 'adresse copiee';
      window.setTimeout(() => {
        cameraCopy.textContent = 'copier l adresse';
      }, 1600);
    } catch (error) {
      cameraCopy.textContent = 'copie impossible';
      window.setTimeout(() => {
        cameraCopy.textContent = 'copier l adresse';
      }, 1600);
    }
  });

  function showPlaceholder(message, status, mode) {
    cameraImage.hidden = true;
    cameraFrame.hidden = true;
    cameraPlaceholder.hidden = false;
    cameraPlaceholder.textContent = message;
    cameraStatus.textContent = status;
    cameraMode.textContent = mode;
    consoleTone.textContent = mode;
  }

  function useImage(url, status, mode) {
    cameraFrame.hidden = true;
    cameraPlaceholder.hidden = true;
    cameraImage.hidden = false;
    cameraImage.src = url;
    cameraStatus.textContent = status;
    cameraMode.textContent = mode;
    consoleTone.textContent = mode;
  }

  function useFrame(url, status, mode) {
    cameraImage.hidden = true;
    cameraPlaceholder.hidden = true;
    cameraFrame.hidden = false;
    cameraFrame.src = url;
    cameraStatus.textContent = status;
    cameraMode.textContent = mode;
    consoleTone.textContent = mode;
  }

  async function fetchCameraConfig() {
    try {
      const response = await fetch('/api/camera', { cache: 'no-store' });

      if (!response.ok) {
        return null;
      }

      return response.json();
    } catch (error) {
      return null;
    }
  }

  function tryLocalCandidates(index = 0) {
    if (index >= localCandidates.length) {
      useFrame(
        `${localBaseUrl}/`,
        'flux local a ouvrir',
        'Le flux ne se laisse pas accrocher en image directe. Le lieu garde le portail local ouvert.'
      );
      return;
    }

    const testImage = new Image();
    const candidate = `${localCandidates[index]}${localCandidates[index].includes('?') ? '&' : '?'}v=${Date.now()}`;

    testImage.onload = () => {
      useImage(
        candidate,
        'camera locale en direct',
        'Flux local accroche en direct depuis le meme reseau.'
      );
    };

    testImage.onerror = () => {
      tryLocalCandidates(index + 1);
    };

    testImage.src = candidate;
  }

  async function initCamera() {
    const config = await fetchCameraConfig();

    if (config?.proxyPath) {
      const proxyUrl = new URL(config.proxyPath, window.location.origin).toString();

      useImage(
        `${proxyUrl}${proxyUrl.includes('?') ? '&' : '?'}v=${Date.now()}`,
        'camera relayee',
        'Le hub relaie la camera locale a travers la meme origine.'
      );
      cameraOpen.href = proxyUrl;
      return;
    }

    if (window.location.protocol === 'https:') {
      showPlaceholder(
        'Le flux reste local: une page HTTPS ne peut pas afficher directement une source HTTP privee. Ouvre le flux local ou branche le relais /camera/live.',
        'relais requis',
        'Le lieu connait l adresse camera, mais attend encore son passage en HTTPS.'
      );
      return;
    }

    tryLocalCandidates();
  }

  initCamera();
})();
