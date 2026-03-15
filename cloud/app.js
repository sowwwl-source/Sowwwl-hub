(() => {
  const storageKey = 'sowwwl-cloud-guest';
  const scrollOptions = { behavior: 'smooth', block: 'start' };
  const guestStatus = document.getElementById('guestStatus');
  const arStatus = document.getElementById('arStatus');
  const audioStatus = document.getElementById('audioStatus');
  const guestName = document.getElementById('guestName');
  const guestCopy = document.getElementById('guestCopy');
  const guestSection = document.getElementById('guestSection');
  const visionPanel = document.getElementById('visionPanel');
  const instrumentPanel = document.getElementById('instrumentPanel');
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
  const link3dStage = document.getElementById('link3dStage');
  const link3dScene = document.getElementById('link3dScene');
  const link3dStatus = document.getElementById('link3dStatus');
  const link3dTitle = document.getElementById('link3dTitle');
  const link3dText = document.getElementById('link3dText');
  const link3dAction = document.getElementById('link3dAction');
  const linkNodes = Array.from(document.querySelectorAll('.link-node'));

  const state = {
    guest: loadGuest(),
    stream: null,
    tilt: { x: 0, y: 0 },
    audioContext: null,
    gainNode: null,
    filterNode: null,
    oscillators: new Map(),
    motionReady: false,
    cameraReady: false,
    reducedMotion:
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    link3d: {
      selected: 'cloud',
      pointerX: 0,
      pointerY: 0,
      currentX: 0,
      currentY: 0,
      targetX: 0,
      targetY: 0,
      raf: 0
    }
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

  function defaultLink3dStatus() {
    if (state.motionReady) {
      return 'Le LINK 3D suit maintenant l inclinaison de l appareil.';
    }

    return 'Glisse ou incline l appareil pour orienter la constellation.';
  }

  function setLink3dStatus(text) {
    if (!link3dStatus) {
      return;
    }

    link3dStatus.textContent = text || defaultLink3dStatus();
  }

  function moveGlyphs() {
    const dx = state.tilt.x * 24 + state.link3d.pointerX * 10;
    const dy = state.tilt.y * 18 + state.link3d.pointerY * 8;

    glyphA.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
    glyphB.style.transform = `translate3d(${-dx * 0.7}px, ${dy * 0.6}px, 0)`;
    glyphC.style.transform = `translate3d(${dx * 0.35}px, ${-dy * 0.8}px, 0)`;
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
        tiltMeter.style.left = `${50 + state.tilt.x * 26}%`;
        moveGlyphs();

        if (state.filterNode) {
          state.filterNode.frequency.value = 440 + (state.tilt.y + 1) * 820;
        }
      });
      state.motionReady = true;
      setLink3dStatus();
    }

    return true;
  }

  async function startCamera() {
    if (state.stream) {
      renderLink3dSelection();
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setPill(arStatus, 'camera absente', 'error');
      cameraNote.textContent = 'Cet appareil ne propose pas getUserMedia. On garde le mode apparition en attente.';
      renderLink3dSelection();
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
    } catch {
      setPill(arStatus, 'camera refusee', 'warn');
      cameraNote.textContent =
        'L apparition reste lisible meme sans camera. Autorise l acces plus tard pour activer la couche visuelle.';
    }

    renderLink3dSelection();
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
    renderLink3dSelection();
  }

  async function ensureAudio() {
    if (state.audioContext) {
      if (state.audioContext.state === 'suspended') {
        await state.audioContext.resume();
      }

      setPill(audioStatus, state.oscillators.size ? 'instrument actif' : 'instrument pret', 'live');
      renderLink3dSelection();
      return;
    }

    const Context = window.AudioContext || window.webkitAudioContext;

    if (!Context) {
      setPill(audioStatus, 'audio indisponible', 'error');
      instrumentNote.textContent = 'Le navigateur ne propose pas Web Audio sur cet appareil.';
      renderLink3dSelection();
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
    renderLink3dSelection();
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
      renderLink3dSelection();
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
    renderLink3dSelection();
  }

  function stopAllNotes() {
    pads.forEach((pad) => stopNote(pad));
    setPill(audioStatus, 'instrument en veille', 'warn');
    renderLink3dSelection();
  }

  async function activateGuest() {
    if (!state.guest) {
      saveGuest(createGuest());
      renderGuest();
      renderLink3dSelection();
    }

    guestSection.scrollIntoView(scrollOptions);
  }

  async function activateInstrument() {
    await ensureAudio();
    instrumentPanel.scrollIntoView(scrollOptions);
  }

  async function activateCloud() {
    await startCamera();
    visionPanel.scrollIntoView(scrollOptions);
  }

  function getLink3dEntry(key) {
    if (key === 'org') {
      return {
        title: 'sowwwl.org',
        text: 'Le comptoir vivant. La facade habitee qui relie les passages, la camera et la presence du lieu.',
        actionLabel: 'aller au hub',
        glyphB: 'comptoir',
        glyphC: 'org',
        run: () => {
          window.location.assign('/');
        }
      };
    }

    if (key === 'com') {
      return {
        title: 'sowwwl.com',
        text: 'Le foyer minimal. Une presence dense, centrale, presque muette, depuis laquelle le reste respire.',
        actionLabel: 'ouvrir le foyer',
        glyphB: 'foyer',
        glyphC: 'com',
        run: () => {
          window.open('https://sowwwl.com', '_blank', 'noopener,noreferrer');
        }
      };
    }

    if (key === 'net') {
      return {
        title: 'sowwwl.net',
        text: 'La marche et l usage. Un territoire plus praticable, plus outille, plus deja en mouvement.',
        actionLabel: 'ouvrir la marche',
        glyphB: 'marche',
        glyphC: 'net',
        run: () => {
          window.open('https://sowwwl.net', '_blank', 'noopener,noreferrer');
        }
      };
    }

    if (key === 'instrument') {
      return {
        title: 'instrument mobile',
        text: state.audioContext
          ? 'Le smartphone est pret a vibrer. Une simple pression suffit pour jouer et l inclinaison colore le timbre.'
          : 'Le smartphone devient un petit instrument vivant. Appui, glisse et inclinaison suffisent pour entrer.',
        actionLabel: 'jouer maintenant',
        glyphB: 'fer',
        glyphC: 'vin',
        run: activateInstrument
      };
    }

    if (key === 'guest') {
      return {
        title: 'mode invite',
        text: state.guest
          ? `La signature ${state.guest.name} reste ici, sur cet appareil, comme premiere appartenance partageable.`
          : 'Une signature locale suffit pour entrer tout de suite et garder une premiere trace sans compte.',
        actionLabel: state.guest ? 'ouvrir la signature' : 'generer une signature',
        glyphB: 'invite',
        glyphC: 'passage',
        run: activateGuest
      };
    }

    return {
      title: 'sowwwl.cloud',
      text: state.cameraReady
        ? 'La couche mobile est ouverte. Le lieu se pose sur la camera et le LINK 3D garde les autres passages a portee.'
        : 'Le noyau mobile du lieu. La couche qui met SOWWWL dans la main avant meme la creation d un compte.',
      actionLabel: state.cameraReady ? 'recentrer l apparition' : 'ouvrir l apparition',
      glyphB: 'sowwwl',
      glyphC: 'cloud',
      run: activateCloud
    };
  }

  function renderLink3dSelection() {
    const entry = getLink3dEntry(state.link3d.selected);

    if (!entry) {
      return;
    }

    link3dTitle.textContent = entry.title;
    link3dText.textContent = entry.text;
    link3dAction.textContent = entry.actionLabel;
    glyphB.textContent = entry.glyphB;
    glyphC.textContent = entry.glyphC;

    linkNodes.forEach((node) => {
      node.classList.toggle('is-active', node.dataset.linkKey === state.link3d.selected);
    });
  }

  function activateLink3d(key, options = {}) {
    if (!getLink3dEntry(key)) {
      return;
    }

    state.link3d.selected = key;
    renderLink3dSelection();

    if (options.announce === false) {
      return;
    }

    const entry = getLink3dEntry(key);
    const tail = state.motionReady
      ? 'Incline pour sentir la profondeur.'
      : 'Glisse pour orienter la scene.';
    setLink3dStatus(`${entry.title} au premier plan. ${tail}`);
  }

  async function runLink3dAction() {
    const entry = getLink3dEntry(state.link3d.selected);

    if (!entry) {
      return;
    }

    await entry.run();
    renderLink3dSelection();
    setLink3dStatus();
  }

  function animateLink3d() {
    if (!link3dScene || !link3dStage) {
      return;
    }

    const intensity = state.reducedMotion ? 0.45 : 1;
    const floatY = state.reducedMotion ? 0 : Math.sin(window.performance.now() / 1100) * 3.5;

    state.link3d.targetX = (-state.link3d.pointerY * 10 - state.tilt.y * 14) * intensity;
    state.link3d.targetY = (state.link3d.pointerX * 14 + state.tilt.x * 18) * intensity;
    state.link3d.currentX += (state.link3d.targetX - state.link3d.currentX) * 0.08;
    state.link3d.currentY += (state.link3d.targetY - state.link3d.currentY) * 0.08;

    link3dScene.style.transform =
      `translate3d(0, ${floatY}px, 0) rotateX(${state.link3d.currentX.toFixed(2)}deg) ` +
      `rotateY(${state.link3d.currentY.toFixed(2)}deg)`;

    link3dStage.style.setProperty(
      '--glow-x',
      `${50 + (state.link3d.pointerX * 10 + state.tilt.x * 12) * intensity}%`
    );
    link3dStage.style.setProperty(
      '--glow-y',
      `${42 + (state.link3d.pointerY * 8 - state.tilt.y * 10) * intensity}%`
    );

    moveGlyphs();
    state.link3d.raf = window.requestAnimationFrame(animateLink3d);
  }

  function wirePad(pad) {
    pad.addEventListener('pointerdown', async () => {
      activateLink3d('instrument', { announce: false });
      await startNote(pad);
    });

    pad.addEventListener('pointerup', () => stopNote(pad));
    pad.addEventListener('pointerleave', () => stopNote(pad));
    pad.addEventListener('pointercancel', () => stopNote(pad));
  }

  launchGuest.addEventListener('click', async () => {
    activateLink3d('guest', { announce: false });
    await activateGuest();
  });

  launchAr.addEventListener('click', async () => {
    activateLink3d('cloud', { announce: false });
    await activateCloud();
  });

  launchInstrument.addEventListener('click', async () => {
    activateLink3d('instrument', { announce: false });
    await activateInstrument();
  });

  visionButton.addEventListener('click', async () => {
    activateLink3d('cloud', { announce: false });
    await startCamera();
  });

  visionPause.addEventListener('click', stopCamera);

  guestGenerate.addEventListener('click', () => {
    saveGuest(createGuest());
    renderGuest();
    renderLink3dSelection();
  });

  guestShare.addEventListener('click', async () => {
    activateLink3d('guest', { announce: false });
    await shareGuest();
  });

  guestReset.addEventListener('click', () => {
    saveGuest(null);
    renderGuest();
    renderLink3dSelection();
  });

  audioButton.addEventListener('click', async () => {
    activateLink3d('instrument', { announce: false });
    await ensureAudio();
  });

  audioStop.addEventListener('click', stopAllNotes);

  linkNodes.forEach((node) => {
    const key = node.dataset.linkKey;

    node.addEventListener('pointerenter', () => {
      activateLink3d(key, { announce: false });
    });

    node.addEventListener('focus', () => {
      activateLink3d(key, { announce: false });
    });

    node.addEventListener('click', (event) => {
      event.preventDefault();
      activateLink3d(key);
    });
  });

  if (link3dStage) {
    link3dStage.addEventListener('pointerenter', () => {
      setLink3dStatus('Le LINK 3D suit la main et garde le passage selectionne au centre.');
    });

    link3dStage.addEventListener('pointermove', (event) => {
      const rect = link3dStage.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width;
      const y = (event.clientY - rect.top) / rect.height;
      state.link3d.pointerX = Math.max(-1, Math.min(1, x * 2 - 1));
      state.link3d.pointerY = Math.max(-1, Math.min(1, y * 2 - 1));
      moveGlyphs();
    });

    link3dStage.addEventListener('pointerleave', () => {
      state.link3d.pointerX = 0;
      state.link3d.pointerY = 0;
      setLink3dStatus();
      moveGlyphs();
    });
  }

  if (link3dAction) {
    link3dAction.addEventListener('click', runLink3dAction);
  }

  pads.forEach(wirePad);
  renderGuest();
  renderLink3dSelection();
  setLink3dStatus();
  moveGlyphs();

  if (link3dScene) {
    state.link3d.raf = window.requestAnimationFrame(animateLink3d);
  }

  if (navigator.xr?.isSessionSupported) {
    navigator.xr.isSessionSupported('immersive-ar').then((supported) => {
      if (supported && !state.cameraReady) {
        setPill(arStatus, 'ar native possible', 'live');
      }
    }).catch(() => {});
  }
})();
