(() => {
  const storageKey = 'sowwwl-cloud-guest';
  const scrollOptions = { behavior: 'smooth', block: 'start' };
  const guestStatus = document.getElementById('guestStatus');
  const arStatus = document.getElementById('arStatus');
  const audioStatus = document.getElementById('audioStatus');
  const xrStatus = document.getElementById('xrStatus');
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
  const immersiveNote = document.getElementById('immersiveNote');
  const immersiveButton = document.getElementById('immersiveButton');
  const immersiveReset = document.getElementById('immersiveReset');
  const immersiveCanvas = document.getElementById('immersiveCanvas');
  const immersiveOverlay = document.getElementById('immersiveOverlay');
  const immersiveOverlayText = document.getElementById('immersiveOverlayText');
  const immersiveOverlayReset = document.getElementById('immersiveOverlayReset');
  const immersiveExit = document.getElementById('immersiveExit');

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
    },
    xr: {
      supported: false,
      isEntering: false,
      session: null,
      gl: null,
      referenceSpace: null,
      viewerSpace: null,
      hitTestSource: null,
      renderer: null,
      latestHitMatrix: null,
      anchorMatrix: null,
      sawSurface: false
    }
  };

  const adjectives = ['brume', 'ferme', 'legere', 'vive', 'sourde', 'ardente', 'claire'];
  const nouns = ['nuage', 'table', 'trace', 'source', 'veine', 'porte', 'onde'];

  function setPill(element, text, mode) {
    element.className = `status-pill${mode ? ` is-${mode}` : ''}`;
    element.innerHTML = `<span></span>${text}`;
  }

  function setImmersiveStatus(text, mode) {
    setPill(xrStatus, text, mode);
  }

  function setImmersiveNote(text) {
    immersiveNote.textContent = text;
  }

  function setImmersiveOverlayText(text) {
    immersiveOverlayText.textContent = text;
  }

  function setImmersiveUi(active) {
    immersiveOverlay.hidden = !active;
    immersiveReset.disabled = !active;
    immersiveOverlayReset.disabled = !active;
    immersiveButton.disabled = active || state.xr.isEntering || !state.xr.supported;
    immersiveButton.textContent = active ? 'ar immersive active' : 'entrer en ar immersive';
    document.body.classList.toggle('is-immersive-live', active);
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
    if (state.xr.session) {
      return 'Le seuil immersif est ouvert. Le LINK 3D garde les passages en memoire.';
    }

    if (state.motionReady) {
      return 'Le LINK 3D suit maintenant l inclinaison de l appareil.';
    }

    return 'Glisse ou incline l appareil pour orienter la constellation.';
  }

  function setLink3dStatus(text) {
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
        'Le cadre vivant se pose sur la camera. Incline l appareil pour deplacer les reperes et sentir la profondeur.';
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
      text: state.xr.supported
        ? 'La couche mobile ouvre deux portes: apparition camera pour sentir le lieu, puis seuil immersif pour poser le cadre dans le monde reel.'
        : 'Le noyau mobile du lieu. La couche qui met SOWWWL dans la main avant meme la creation d un compte.',
      actionLabel: state.cameraReady ? 'recentrer l apparition' : 'ouvrir l apparition',
      glyphB: 'voyage',
      glyphC: 'cloud',
      run: activateCloud
    };
  }

  function renderLink3dSelection() {
    const entry = getLink3dEntry(state.link3d.selected);

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

  function identityMatrix() {
    return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  }

  function rotationYMatrix(angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);

    return new Float32Array([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]);
  }

  function multiplyMatrices(a, b) {
    const out = new Float32Array(16);
    const a00 = a[0];
    const a01 = a[1];
    const a02 = a[2];
    const a03 = a[3];
    const a10 = a[4];
    const a11 = a[5];
    const a12 = a[6];
    const a13 = a[7];
    const a20 = a[8];
    const a21 = a[9];
    const a22 = a[10];
    const a23 = a[11];
    const a30 = a[12];
    const a31 = a[13];
    const a32 = a[14];
    const a33 = a[15];
    const b00 = b[0];
    const b01 = b[1];
    const b02 = b[2];
    const b03 = b[3];
    const b10 = b[4];
    const b11 = b[5];
    const b12 = b[6];
    const b13 = b[7];
    const b20 = b[8];
    const b21 = b[9];
    const b22 = b[10];
    const b23 = b[11];
    const b30 = b[12];
    const b31 = b[13];
    const b32 = b[14];
    const b33 = b[15];

    out[0] = b00 * a00 + b01 * a10 + b02 * a20 + b03 * a30;
    out[1] = b00 * a01 + b01 * a11 + b02 * a21 + b03 * a31;
    out[2] = b00 * a02 + b01 * a12 + b02 * a22 + b03 * a32;
    out[3] = b00 * a03 + b01 * a13 + b02 * a23 + b03 * a33;
    out[4] = b10 * a00 + b11 * a10 + b12 * a20 + b13 * a30;
    out[5] = b10 * a01 + b11 * a11 + b12 * a21 + b13 * a31;
    out[6] = b10 * a02 + b11 * a12 + b12 * a22 + b13 * a32;
    out[7] = b10 * a03 + b11 * a13 + b12 * a23 + b13 * a33;
    out[8] = b20 * a00 + b21 * a10 + b22 * a20 + b23 * a30;
    out[9] = b20 * a01 + b21 * a11 + b22 * a21 + b23 * a31;
    out[10] = b20 * a02 + b21 * a12 + b22 * a22 + b23 * a32;
    out[11] = b20 * a03 + b21 * a13 + b22 * a23 + b23 * a33;
    out[12] = b30 * a00 + b31 * a10 + b32 * a20 + b33 * a30;
    out[13] = b30 * a01 + b31 * a11 + b32 * a21 + b33 * a31;
    out[14] = b30 * a02 + b31 * a12 + b32 * a22 + b33 * a32;
    out[15] = b30 * a03 + b31 * a13 + b32 * a23 + b33 * a33;

    return out;
  }

  function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(shader) || 'shader error');
    }

    return shader;
  }

  function createProgram(gl, vertexSource, fragmentSource) {
    const program = gl.createProgram();
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) || 'program error');
    }

    return program;
  }

  function createMesh(gl, positions, colors, mode) {
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

    const colorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);

    return {
      positionBuffer,
      colorBuffer,
      mode,
      count: positions.length / 3
    };
  }

  function pushQuad(positions, colors, a, b, c, d, colorA, colorB, colorC, colorD) {
    positions.push(...a, ...b, ...c, ...a, ...c, ...d);
    colors.push(...colorA, ...colorB, ...colorC, ...colorA, ...colorC, ...colorD);
  }

  function createFrameMesh(gl) {
    const positions = [];
    const colors = [];

    pushQuad(
      positions,
      colors,
      [-0.52, 0.0, 0],
      [-0.36, 0.0, 0],
      [-0.36, 1.52, 0],
      [-0.52, 1.52, 0],
      [0.78, 0.64, 0.45, 0.92],
      [0.82, 0.69, 0.48, 0.92],
      [0.88, 0.76, 0.58, 0.94],
      [0.84, 0.72, 0.54, 0.94]
    );

    pushQuad(
      positions,
      colors,
      [0.36, 0.0, 0],
      [0.52, 0.0, 0],
      [0.52, 1.52, 0],
      [0.36, 1.52, 0],
      [0.82, 0.69, 0.48, 0.92],
      [0.78, 0.64, 0.45, 0.92],
      [0.84, 0.72, 0.54, 0.94],
      [0.88, 0.76, 0.58, 0.94]
    );

    pushQuad(
      positions,
      colors,
      [-0.52, 1.34, 0],
      [0.52, 1.34, 0],
      [0.52, 1.52, 0],
      [-0.52, 1.52, 0],
      [0.66, 0.52, 0.34, 0.9],
      [0.7, 0.56, 0.38, 0.9],
      [0.88, 0.76, 0.58, 0.94],
      [0.84, 0.72, 0.54, 0.94]
    );

    pushQuad(
      positions,
      colors,
      [-0.52, 0.0, 0],
      [0.52, 0.0, 0],
      [0.52, 0.16, 0],
      [-0.52, 0.16, 0],
      [0.66, 0.52, 0.34, 0.88],
      [0.7, 0.56, 0.38, 0.88],
      [0.76, 0.62, 0.42, 0.9],
      [0.72, 0.58, 0.38, 0.9]
    );

    return createMesh(gl, positions, colors, gl.TRIANGLES);
  }

  function createVeilMesh(gl) {
    const positions = [];
    const colors = [];

    pushQuad(
      positions,
      colors,
      [-0.28, 0.18, -0.01],
      [0.28, 0.18, -0.01],
      [0.28, 1.2, -0.01],
      [-0.28, 1.2, -0.01],
      [0.76, 0.62, 0.44, 0.06],
      [0.58, 0.72, 0.8, 0.06],
      [0.58, 0.72, 0.8, 0.24],
      [0.8, 0.84, 0.66, 0.18]
    );

    return createMesh(gl, positions, colors, gl.TRIANGLES);
  }

  function createCircleMesh(gl, radius, y, color, segments, mode) {
    const positions = [];
    const colors = [];

    for (let index = 0; index < segments; index += 1) {
      const angle = (index / segments) * Math.PI * 2;
      positions.push(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
      colors.push(...color);
    }

    return createMesh(gl, positions, colors, mode);
  }

  function createCrossMesh(gl, radius, y, color) {
    const positions = [
      -radius,
      y,
      0,
      radius,
      y,
      0,
      0,
      y,
      -radius,
      0,
      y,
      radius
    ];
    const colors = [...color, ...color, ...color, ...color];

    return createMesh(gl, positions, colors, gl.LINES);
  }

  function createImmersiveRenderer(gl) {
    const program = createProgram(
      gl,
      `
        attribute vec3 aPosition;
        attribute vec4 aColor;
        uniform mat4 uMvp;
        uniform float uTime;
        uniform float uWave;
        varying vec4 vColor;

        void main() {
          vec3 pos = aPosition;
          pos.x += sin(uTime * 0.001 + aPosition.y * 3.8) * uWave;
          pos.z += cos(uTime * 0.0014 + aPosition.x * 6.2) * uWave * 0.45;
          gl_Position = uMvp * vec4(pos, 1.0);
          vColor = aColor;
        }
      `,
      `
        precision mediump float;
        varying vec4 vColor;

        void main() {
          gl_FragColor = vColor;
        }
      `
    );

    return {
      program,
      positionLocation: gl.getAttribLocation(program, 'aPosition'),
      colorLocation: gl.getAttribLocation(program, 'aColor'),
      mvpLocation: gl.getUniformLocation(program, 'uMvp'),
      timeLocation: gl.getUniformLocation(program, 'uTime'),
      waveLocation: gl.getUniformLocation(program, 'uWave'),
      meshes: {
        frame: createFrameMesh(gl),
        veil: createVeilMesh(gl),
        halo: createCircleMesh(gl, 0.6, 0.015, [0.56, 0.72, 0.8, 0.52], 40, gl.LINE_LOOP),
        reticle: createCircleMesh(gl, 0.12, 0.01, [0.95, 0.92, 0.82, 0.85], 32, gl.LINE_LOOP),
        reticleCross: createCrossMesh(gl, 0.08, 0.01, [0.95, 0.92, 0.82, 0.72])
      }
    };
  }

  function drawMesh(gl, renderer, mesh, mvp, time, wave) {
    gl.useProgram(renderer.program);

    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.positionBuffer);
    gl.enableVertexAttribArray(renderer.positionLocation);
    gl.vertexAttribPointer(renderer.positionLocation, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.colorBuffer);
    gl.enableVertexAttribArray(renderer.colorLocation);
    gl.vertexAttribPointer(renderer.colorLocation, 4, gl.FLOAT, false, 0, 0);

    gl.uniformMatrix4fv(renderer.mvpLocation, false, mvp);
    gl.uniform1f(renderer.timeLocation, time);
    gl.uniform1f(renderer.waveLocation, wave);
    gl.drawArrays(mesh.mode, 0, mesh.count);
  }

  async function detectImmersiveSupport() {
    if (!window.isSecureContext) {
      setImmersiveStatus('ar immersive hors contexte sur', 'warn');
      setImmersiveNote('Le mode immersive demande un contexte HTTPS ou localhost pour ouvrir WebXR.');
      renderLink3dSelection();
      return;
    }

    if (!navigator.xr?.isSessionSupported) {
      setImmersiveStatus('ar immersive indisponible', 'warn');
      setImmersiveNote('Le device peut garder l apparition camera, mais pas encore ouvrir une session WebXR immersive.');
      renderLink3dSelection();
      return;
    }

    try {
      state.xr.supported = await navigator.xr.isSessionSupported('immersive-ar');
    } catch {
      state.xr.supported = false;
    }

    if (state.xr.supported) {
      setImmersiveStatus('ar immersive possible', 'live');
      setImmersiveNote('Le device peut poser le cadre vivant dans l espace reel. Ouvre puis touche pour le placer.');
    } else {
      setImmersiveStatus('ar immersive indisponible', 'warn');
      setImmersiveNote('Le device garde la sculpture camera, mais la vraie entree immersive demande un navigateur WebXR compatible.');
    }

    setImmersiveUi(false);
    renderLink3dSelection();
  }

  async function requestBestReferenceSpace(session) {
    try {
      return await session.requestReferenceSpace('local-floor');
    } catch {
      return session.requestReferenceSpace('local');
    }
  }

  function resetImmersivePlacement() {
    if (!state.xr.session) {
      return;
    }

    state.xr.anchorMatrix = null;
    state.xr.latestHitMatrix = null;
    state.xr.sawSurface = false;
    setImmersiveOverlayText('Cherche une autre surface. Un anneau apparaitra, puis touche pour poser le cadre.');
    setImmersiveNote('Le cadre est a nouveau mobile. Cherche une surface stable pour le poser ailleurs.');
  }

  function placePortalAtLatestHit() {
    if (!state.xr.latestHitMatrix) {
      return;
    }

    state.xr.anchorMatrix = new Float32Array(state.xr.latestHitMatrix);
    setImmersiveOverlayText('Cadre pose. Touche replacer pour chercher un autre seuil, ou sortir pour revenir.');
    setImmersiveNote('Le cadre est maintenant pose dans le monde reel. Tu peux encore le replacer.');
  }

  function handleXrSelect() {
    if (!state.xr.session) {
      return;
    }

    placePortalAtLatestHit();
  }

  function endImmersiveSession() {
    if (state.xr.session) {
      state.xr.session.end().catch(() => {});
    }
  }

  function cleanupImmersiveSession() {
    if (state.xr.hitTestSource) {
      state.xr.hitTestSource.cancel();
    }

    state.xr.session = null;
    state.xr.gl = null;
    state.xr.referenceSpace = null;
    state.xr.viewerSpace = null;
    state.xr.hitTestSource = null;
    state.xr.renderer = null;
    state.xr.latestHitMatrix = null;
    state.xr.anchorMatrix = null;
    state.xr.sawSurface = false;
    setImmersiveUi(false);
    setImmersiveOverlayText('Cherche une surface calme. Un anneau apparaitra, puis touche pour poser le cadre.');

    if (state.xr.supported) {
      setImmersiveStatus('ar immersive possible', 'live');
      setImmersiveNote('Le seuil immersif est referme. Tu peux le reouvrir des que tu veux.');
    } else {
      setImmersiveStatus('ar immersive indisponible', 'warn');
    }
  }

  function onXrFrame(time, frame) {
    const session = frame.session;
    session.requestAnimationFrame(onXrFrame);

    if (!state.xr.referenceSpace || !state.xr.renderer || !state.xr.gl) {
      return;
    }

    const pose = frame.getViewerPose(state.xr.referenceSpace);
    if (!pose) {
      return;
    }

    const gl = state.xr.gl;
    const renderer = state.xr.renderer;
    const layer = session.renderState.baseLayer;

    gl.bindFramebuffer(gl.FRAMEBUFFER, layer.framebuffer);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    state.xr.latestHitMatrix = null;
    if (state.xr.hitTestSource) {
      const results = frame.getHitTestResults(state.xr.hitTestSource);
      if (results.length) {
        const hitPose = results[0].getPose(state.xr.referenceSpace);
        if (hitPose) {
          state.xr.latestHitMatrix = new Float32Array(hitPose.transform.matrix);
          if (!state.xr.sawSurface) {
            state.xr.sawSurface = true;
            setImmersiveOverlayText('Surface trouvee. Touche pour poser le cadre dans le monde reel.');
          }
        }
      }
    }

    for (const view of pose.views) {
      const viewport = layer.getViewport(view);
      gl.viewport(viewport.x, viewport.y, viewport.width, viewport.height);

      const projectionMatrix = view.projectionMatrix;
      const viewMatrix = view.transform.inverse.matrix;

      if (state.xr.anchorMatrix) {
        const swayMatrix = rotationYMatrix(Math.sin(time * 0.00032) * 0.12);
        const frameModelMatrix = multiplyMatrices(state.xr.anchorMatrix, swayMatrix);
        const frameMvp = multiplyMatrices(
          projectionMatrix,
          multiplyMatrices(viewMatrix, frameModelMatrix)
        );
        const haloMvp = multiplyMatrices(
          projectionMatrix,
          multiplyMatrices(viewMatrix, state.xr.anchorMatrix)
        );

        drawMesh(gl, renderer, renderer.meshes.frame, frameMvp, time, 0);
        drawMesh(gl, renderer, renderer.meshes.veil, frameMvp, time, 0.02);
        drawMesh(gl, renderer, renderer.meshes.halo, haloMvp, time, 0.005);
      } else if (state.xr.latestHitMatrix) {
        const reticleMvp = multiplyMatrices(
          projectionMatrix,
          multiplyMatrices(viewMatrix, state.xr.latestHitMatrix)
        );

        drawMesh(gl, renderer, renderer.meshes.reticle, reticleMvp, time, 0);
        drawMesh(gl, renderer, renderer.meshes.reticleCross, reticleMvp, time, 0);
      }
    }
  }

  async function startImmersiveSession() {
    let session = null;

    if (state.xr.session || state.xr.isEntering) {
      return;
    }

    if (!state.xr.supported) {
      setImmersiveStatus('ar immersive indisponible', 'warn');
      setImmersiveNote('Le mode immersive reste ferme ici. Garde la sculpture camera ou ouvre un navigateur WebXR compatible.');
      return;
    }

    if (!window.XRWebGLLayer) {
      setImmersiveStatus('xr webgl absent', 'warn');
      setImmersiveNote('Le navigateur annonce WebXR mais ne propose pas encore la couche WebGL necessaire pour afficher le cadre.');
      return;
    }

    state.xr.isEntering = true;
    setImmersiveUi(false);
    stopCamera();

    try {
      const sessionOptions = {
        requiredFeatures: ['hit-test', 'local'],
        optionalFeatures: ['dom-overlay', 'local-floor'],
        domOverlay: immersiveOverlay ? { root: immersiveOverlay } : undefined
      };
      session = await navigator.xr.requestSession('immersive-ar', sessionOptions);
      const gl = immersiveCanvas.getContext('webgl', {
        alpha: true,
        antialias: true,
        preserveDrawingBuffer: false
      });

      if (!gl) {
        throw new Error('webgl absent');
      }

      await gl.makeXRCompatible();

      session.updateRenderState({
        baseLayer: new XRWebGLLayer(session, gl, { alpha: true, antialias: true })
      });

      const referenceSpace = await requestBestReferenceSpace(session);
      const viewerSpace = await session.requestReferenceSpace('viewer');
      const hitTestSource = await session.requestHitTestSource({ space: viewerSpace });

      state.xr.session = session;
      state.xr.gl = gl;
      state.xr.referenceSpace = referenceSpace;
      state.xr.viewerSpace = viewerSpace;
      state.xr.hitTestSource = hitTestSource;
      state.xr.renderer = createImmersiveRenderer(gl);
      state.xr.latestHitMatrix = null;
      state.xr.anchorMatrix = null;
      state.xr.sawSurface = false;

      session.addEventListener('end', cleanupImmersiveSession, { once: true });
      session.addEventListener('select', handleXrSelect);
      setImmersiveUi(true);
      setImmersiveStatus('ar immersive active', 'live');
      setImmersiveNote('Cherche une surface calme. Un anneau apparait puis un toucher pose le cadre vivant.');
      setImmersiveOverlayText('Cherche une surface calme. Un anneau apparaitra, puis touche pour poser le cadre.');
      session.requestAnimationFrame(onXrFrame);
    } catch {
      if (session) {
        session.end().catch(() => {});
      }

      state.xr.session = null;
      state.xr.gl = null;
      state.xr.referenceSpace = null;
      state.xr.viewerSpace = null;
      state.xr.hitTestSource = null;
      state.xr.renderer = null;
      state.xr.latestHitMatrix = null;
      state.xr.anchorMatrix = null;
      state.xr.sawSurface = false;
      setImmersiveStatus('ar immersive refusee', 'warn');
      setImmersiveNote('Le device a refuse la session immersive. Garde la sculpture camera puis reessaie depuis un navigateur compatible.');
      setImmersiveOverlayText('Cherche une surface calme. Un anneau apparaitra, puis touche pour poser le cadre.');
    } finally {
      state.xr.isEntering = false;
      setImmersiveUi(Boolean(state.xr.session));
      renderLink3dSelection();
    }
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
  immersiveButton.addEventListener('click', startImmersiveSession);
  immersiveReset.addEventListener('click', resetImmersivePlacement);
  immersiveOverlayReset.addEventListener('click', resetImmersivePlacement);
  immersiveExit.addEventListener('click', endImmersiveSession);

  if (immersiveOverlay) {
    immersiveOverlay.addEventListener('beforexrselect', (event) => {
      event.preventDefault();
    });
  }

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
  setImmersiveUi(false);
  moveGlyphs();

  if (link3dScene) {
    state.link3d.raf = window.requestAnimationFrame(animateLink3d);
  }

  detectImmersiveSupport();
})();
