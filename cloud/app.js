(() => {
  const storageKey = 'sowwwl-cloud-guest';
  const guestStatus = document.getElementById('guestStatus');
  const arStatus = document.getElementById('arStatus');
  const audioStatus = document.getElementById('audioStatus');
  const guestName = document.getElementById('guestName');
  const guestCopy = document.getElementById('guestCopy');
  const guestSection = document.getElementById('guestSection');
  const cameraFeed = document.getElementById('cameraFeed');
  const cameraFallback = document.getElementById('cameraFallback');
  const cameraNote = document.getElementById('cameraNote');
  const visionButton = document.getElementById('visionButton');
  const visionPause = document.getElementById('visionPause');
  const launchAr = document.getElementById('launchAr');
  const launchGuest = document.getElementById('launchGuest');
  const launchInstrument = document.getElementById('launchInstrument');
  const guestGenerate = document.getElementById('guestGenerate');
  const guestShare = document.getElementById('guestShare');
  const guestReset = document.getElementById('guestReset');
  const audioButton = document.getElementById('audioButton');
  const audioStop = document.getElementById('audioStop');
  const instrumentNote = document.getElementById('instrumentNote');
  const readoutValue = document.getElementById('readoutValue');
  const tiltMeter = document.getElementById('tiltMeter');
  const pads = Array.from(document.querySelectorAll('.pad'));
  const glyphA = document.getElementById('glyphA');
  const glyphB = document.getElementById('glyphB');
  const glyphC = document.getElementById('glyphC');

  const state = {
    guest: loadGuest(),
    stream: null,
    tilt: { x: 0, y: 0 },
    audioContext: null,
    gainNode: null,
    filterNode: null,
    oscillators: new Map(),
    motionReady: false,
    cameraReady: false
  };

  const adjectives = ['brume', 'ferme', 'legere', 'vive', 'sourde', 'ardente', 'claire'];
  const nouns = ['nuage', 'table', 'trace', 'source', 'veine', 'porte', 'onde'];

  function setPill(element, text, mode) {
    element.className = `status-pill${mode ? ` is-${mode}` : ''}`;
    element.innerHTML = `<span></span>${text}`;
  }

  function loadGuest() {
    try {
      const raw = window.localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function saveGuest(guest) {
    state.guest = guest;

    if (!guest) {
      window.localStorage.removeItem(storageKey);
      return;
    }

    window.localStorage.setItem(storageKey, JSON.stringify(guest));
  }

  function createGuest() {
    const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const suffix = String(Math.floor(100 + Math.random() * 900));

    return {
      name: `${adjective}-${noun}-${suffix}`,
      token: `${adjective}-${noun}-${suffix}-${Date.now().toString(36)}`,
      createdAt: new Date().toISOString()
    };
  }

  function guestUrl() {
    if (!state.guest) {
      return window.location.href;
    }

    const url = new URL(window.location.href);
    url.hash = `guest=${state.guest.token}`;
    return url.toString();
  }

  function renderGuest() {
    if (!state.guest) {
      guestName.textContent = 'aucune signature pour l instant';
      guestCopy.textContent = 'Entre sans compte pour obtenir un nom de passage et un lien partageable.';
      setPill(guestStatus, 'mode invite en veille', '');
      return;
    }

    guestName.textContent = state.guest.name;
    guestCopy.textContent =
      'Cette signature reste locale a cet appareil. Elle suffit pour revenir, partager la porte et memoriser une premiere presence.';
    setPill(guestStatus, 'mode invite actif', 'live');
  }

  async function shareGuest() {
    if (!state.guest) {
      return;
    }

    const url = guestUrl();

    try {
      if (navigator.share) {
        await navigator.share({
          title: 'sowwwl.cloud',
          text: `Entre par ${state.guest.name}`,
          url
        });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        throw new Error('clipboard absent');
      }

      guestCopy.textContent = `Lien invite pret: ${url}`;
    } catch {
      guestCopy.textContent = 'Le partage automatique n a pas reussi. Garde la signature locale et reessaie plus tard.';
    }
  }

  async function requestMotion() {
    if (
      typeof DeviceOrientationEvent !== 'undefined' &&
      typeof DeviceOrientationEvent.requestPermission === 'function'
    ) {
      try {
        const result = await DeviceOrientationEvent.requestPermission();
        if (result !== 'granted') {
          return false;
        }
      } catch {
        return false;
      }
    }

    if (!('DeviceOrientationEvent' in window)) {
      return false;
    }

    if (!state.motionReady) {
      window.addEventListener('deviceorientation', (event) => {
        state.tilt.x = Math.max(-1, Math.min(1, (event.gamma || 0) / 35));
        state.tilt.y = Math.max(-1, Math.min(1, (event.beta || 0) / 45));
        const x = 50 + state.tilt.x * 26;
        tiltMeter.style.left = `${x}%`;
        moveGlyphs();

        if (state.filterNode) {
          state.filterNode.frequency.value = 440 + (state.tilt.y + 1) * 820;
        }
      });
      state.motionReady = true;
    }

    return true;
  }

  function moveGlyphs() {
    const dx = state.tilt.x * 24;
    const dy = state.tilt.y * 18;

    glyphA.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
    glyphB.style.transform = `translate3d(${-dx * 0.7}px, ${dy * 0.6}px, 0)`;
    glyphC.style.transform = `translate3d(${dx * 0.35}px, ${-dy * 0.8}px, 0)`;
  }

  async function startCamera() {
    if (state.stream) {
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setPill(arStatus, 'camera absente', 'error');
      cameraNote.textContent = 'Cet appareil ne propose pas getUserMedia. On garde le mode apparition en attente.';
      return;
    }

    await requestMotion();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      state.stream = stream;
      state.cameraReady = true;
      cameraFeed.srcObject = stream;
      cameraFeed.hidden = false;
      cameraFallback.hidden = true;
      await cameraFeed.play().catch(() => {});
      setPill(arStatus, 'apparition active', 'live');
      cameraNote.textContent =
        'La couche cloud se pose sur la camera. Incline l appareil pour deplacer les reperes et sentir la profondeur.';
    } catch (error) {
      setPill(arStatus, 'camera refusee', 'warn');
      cameraNote.textContent =
        'L apparition reste lisible meme sans camera. Autorise l acces plus tard pour activer la couche visuelle.';
    }
  }

  function stopCamera() {
    if (!state.stream) {
      return;
    }

    state.stream.getTracks().forEach((track) => track.stop());
    state.stream = null;
    state.cameraReady = false;
    cameraFeed.srcObject = null;
    cameraFeed.hidden = true;
    cameraFallback.hidden = false;
    setPill(arStatus, 'camera en veille', 'warn');
    cameraNote.textContent = 'Le mode apparition est en veille. Tu peux le reouvrir quand tu veux.';
  }

  async function ensureAudio() {
    if (state.audioContext) {
      return;
    }

    const Context = window.AudioContext || window.webkitAudioContext;

    if (!Context) {
      setPill(audioStatus, 'audio indisponible', 'error');
      instrumentNote.textContent = 'Le navigateur ne propose pas Web Audio sur cet appareil.';
      return;
    }

    state.audioContext = new Context();
    state.gainNode = state.audioContext.createGain();
    state.gainNode.gain.value = 0.16;
    state.filterNode = state.audioContext.createBiquadFilter();
    state.filterNode.type = 'lowpass';
    state.filterNode.frequency.value = 920;
    state.filterNode.Q.value = 4;
    state.filterNode.connect(state.gainNode);
    state.gainNode.connect(state.audioContext.destination);

    await requestMotion();

    if (state.audioContext.state === 'suspended') {
      await state.audioContext.resume();
    }

    setPill(audioStatus, 'instrument pret', 'live');
    instrumentNote.textContent = 'Appuie sur une case. Si le capteur repond, l inclinaison change le timbre.';
  }

  function stopNote(pad) {
    const voice = state.oscillators.get(pad);
    pad.classList.remove('is-playing');

    if (!voice) {
      return;
    }

    const now = state.audioContext.currentTime;
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
    voice.gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    voice.osc.stop(now + 0.2);
    state.oscillators.delete(pad);

    if (!state.oscillators.size) {
      readoutValue.textContent = 'silence prepare';
    }
  }

  async function startNote(pad) {
    await ensureAudio();

    if (!state.audioContext || state.oscillators.has(pad)) {
      return;
    }

    const frequency = Number(pad.dataset.note);
    const osc = state.audioContext.createOscillator();
    const gain = state.audioContext.createGain();

    osc.type = 'sawtooth';
    osc.frequency.value = frequency;
    gain.gain.value = 0.0001;
    osc.connect(gain);
    gain.connect(state.filterNode);

    const now = state.audioContext.currentTime;
    gain.gain.linearRampToValueAtTime(0.22, now + 0.05);
    osc.start(now);

    state.oscillators.set(pad, { osc, gain });
    pad.classList.add('is-playing');
    readoutValue.textContent = `${pad.textContent} en vibration`;
    setPill(audioStatus, 'instrument actif', 'live');
  }

  function stopAllNotes() {
    pads.forEach((pad) => stopNote(pad));
    setPill(audioStatus, 'instrument en veille', 'warn');
  }

  function wirePad(pad) {
    pad.addEventListener('pointerdown', async () => {
      await startNote(pad);
    });

    pad.addEventListener('pointerup', () => stopNote(pad));
    pad.addEventListener('pointerleave', () => stopNote(pad));
    pad.addEventListener('pointercancel', () => stopNote(pad));
  }

  launchGuest.addEventListener('click', () => {
    if (!state.guest) {
      saveGuest(createGuest());
    }
    renderGuest();
    guestSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  launchAr.addEventListener('click', async () => {
    await startCamera();
    document.getElementById('visionPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  launchInstrument.addEventListener('click', async () => {
    await ensureAudio();
    document.getElementById('instrumentPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  visionButton.addEventListener('click', startCamera);
  visionPause.addEventListener('click', stopCamera);
  guestGenerate.addEventListener('click', () => {
    saveGuest(createGuest());
    renderGuest();
  });
  guestShare.addEventListener('click', shareGuest);
  guestReset.addEventListener('click', () => {
    saveGuest(null);
    renderGuest();
  });
  audioButton.addEventListener('click', ensureAudio);
  audioStop.addEventListener('click', stopAllNotes);

  pads.forEach(wirePad);
  renderGuest();
  moveGlyphs();

  if (navigator.xr?.isSessionSupported) {
    navigator.xr.isSessionSupported('immersive-ar').then((supported) => {
      if (supported) {
        setPill(arStatus, 'ar native possible', 'live');
      }
    }).catch(() => {});
  }
})();
