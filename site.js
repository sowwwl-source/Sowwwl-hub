(() => {
  const FRAME_WIDTH = 1280;
  const FRAME_HEIGHT = 860;
  const SAFE_TOP = 170;
  const SAFE_BOTTOM = 90;
  const EDGE_PADDING = 18;
  const POINTER_RADIUS = 300;
  const localDashboardUrl = 'http://192.168.1.22:8081/';
  const localStreamUrl = 'http://192.168.1.22:8081/stream.mjpg';
  const domains = [
    {
      name: 'sowwwl.com',
      url: 'https://sowwwl.com',
      accent: '#f2b066',
      bridgeRole: 'foyer central',
      bridgeFooter: 'Passage actif: sowwwl.org garde le foyer central de sowwwl.com pres de la main.'
    },
    { name: 'sowwwl.art', url: 'https://sowwwl.art', accent: '#9ed8c8' },
    {
      name: 'sowwwl.net',
      url: 'https://sowwwl.net',
      accent: '#f08b74',
      bridgeRole: 'territoire praticable',
      bridgeFooter: 'Passage actif: sowwwl.org laisse venir la chambre praticable de sowwwl.net.'
    },
    { name: 'sowwwl.fr', url: 'https://sowwwl.fr', accent: '#c4bc8b' },
    {
      name: 'sowwwl.cloud',
      url: 'https://sowwwl.cloud',
      accent: '#8ab7d8',
      bridgeRole: 'veille distante',
      bridgeFooter: 'Passage actif: sowwwl.org tient sowwwl.cloud dans un champ proche, meme quand il vacille.'
    }
  ];

  const playfield = document.getElementById('playfield');
  const cameraBackground = document.getElementById('cameraBackground');
  const cameraFallback = document.getElementById('cameraFallback');
  const cameraState = document.getElementById('cameraState');
  const motionState = document.getElementById('motionState');
  const motionToggle = document.getElementById('motionToggle');
  const cameraOpen = document.getElementById('cameraOpen');
  const cameraNote = document.getElementById('cameraNote');
  const footerText = document.getElementById('footerText');
  const pointerAura = document.getElementById('pointerAura');
  const bridgeGrid = document.getElementById('bridgeGrid');

  const state = {
    items: [],
    lastTime: performance.now(),
    pointer: {
      active: false,
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
      vx: 0,
      vy: 0,
      lastX: window.innerWidth / 2,
      lastY: window.innerHeight / 2
    },
    tilt: {
      active: false,
      x: 0,
      y: 0
    },
    motionPermissionAsked: false,
    zCounter: 5,
    hitTimers: new WeakMap(),
    camera: {
      sources: [],
      retryTimer: 0,
      attemptToken: 0,
      activeSource: ''
    },
    activeBridge: ''
  };

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  function activeBridgeDomain() {
    return domains.find((entry) => entry.name === state.activeBridge) || null;
  }

  function composeFooter(cameraMessage) {
    const activeDomain = activeBridgeDomain();

    if (!activeDomain?.bridgeFooter) {
      return cameraMessage;
    }

    return `${activeDomain.bridgeFooter} ${cameraMessage}`;
  }

  function sizeForViewport(index) {
    const basis = Math.min(window.innerWidth, window.innerHeight);
    const width = clamp(basis * (window.innerWidth < 700 ? 0.32 : 0.24) + index * 6, 180, 340);
    const height = width * (FRAME_HEIGHT / FRAME_WIDTH);

    return { width, height };
  }

  function createWindow(domain, index) {
    const { width, height } = sizeForViewport(index);
    const el = document.createElement('article');
    el.className = 'dvd-window';
    el.style.setProperty('--window-accent', domain.accent);
    el.style.setProperty('--window-width', `${width}px`);
    el.style.setProperty('--window-height', `${height}px`);
    el.style.setProperty('--frame-scale', `${width / FRAME_WIDTH}`);

    el.innerHTML = `
      <div class="dvd-window__chrome">
        <span>${domain.name}</span>
        <span class="dvd-window__dot">live</span>
      </div>
      <div class="dvd-window__surface">
        <iframe src="${domain.url}" title="${domain.name}" loading="eager" referrerpolicy="strict-origin-when-cross-origin"></iframe>
        <div class="dvd-window__grain"></div>
      </div>
      <div class="dvd-window__label">
        <span>home vision</span>
        <a href="${domain.url}" target="_blank" rel="noreferrer">ouvrir</a>
      </div>
      <div class="dvd-window__hover" aria-hidden="true"></div>
    `;

    const item = {
      domain,
      el,
      width,
      height,
      x: randomBetween(EDGE_PADDING, Math.max(EDGE_PADDING, window.innerWidth - width - EDGE_PADDING)),
      y: randomBetween(SAFE_TOP, Math.max(SAFE_TOP, window.innerHeight - SAFE_BOTTOM - height)),
      vx: randomBetween(-74, 74) || 56,
      vy: randomBetween(-60, 60) || -42,
      spin: randomBetween(-11, 11) || 5,
      angle: randomBetween(-5, 5),
      hover: false
    };

    el.dataset.domain = domain.name;

    el.addEventListener('pointerenter', () => {
      item.hover = true;
      bringWindowForward(item, 1.08);
      item.el.classList.add('is-hovered');
      if (domain.bridgeRole) {
        activateBridge(domain.name);
      }
    });

    el.addEventListener('pointerleave', () => {
      item.hover = false;
      item.el.classList.remove('is-hovered');
    });

    playfield.appendChild(el);
    return item;
  }

  function findItem(domainName) {
    return state.items.find((item) => item.domain.name === domainName) || null;
  }

  function bringWindowForward(item, multiplier = 1.14) {
    state.zCounter += 1;
    item.el.style.zIndex = String(state.zCounter);
    item.vx *= multiplier;
    item.vy *= multiplier;
    item.spin *= 1 + (multiplier - 1) * 1.15;
  }

  function focusWindow(item, withSummon = false) {
    if (!item) {
      return;
    }

    bringWindowForward(item, withSummon ? 1.2 : 1.1);
    item.el.classList.add('is-bridged');
    window.setTimeout(() => {
      item.el.classList.remove('is-bridged');
    }, 1200);

    if (withSummon) {
      const targetX = clamp((window.innerWidth - item.width) * 0.5, EDGE_PADDING, Math.max(EDGE_PADDING, window.innerWidth - item.width - EDGE_PADDING));
      const targetY = clamp(window.innerHeight * 0.36 - item.height * 0.5, SAFE_TOP, Math.max(SAFE_TOP, window.innerHeight - SAFE_BOTTOM - item.height));
      item.x = targetX;
      item.y = targetY;
      item.vx += (Math.random() > 0.5 ? 1 : -1) * 14;
      item.vy -= 10;
      item.spin += Math.random() > 0.5 ? 4.5 : -4.5;
      flashBounce(item);
    }
  }

  function updateBridgeCards() {
    if (!bridgeGrid) {
      return;
    }

    bridgeGrid.querySelectorAll('.bridge-card').forEach((card) => {
      card.classList.toggle('is-active', card.dataset.domain === state.activeBridge);
    });
  }

  function activateBridge(domainName) {
    const domain = domains.find((entry) => entry.name === domainName);

    if (!domain?.bridgeRole) {
      return;
    }

    state.activeBridge = domainName;
    document.documentElement.style.setProperty('--bridge-current', domain.accent);
    updateBridgeCards();
    footerText.textContent = composeFooter('Le fond et les autres passages continuent de respirer autour.');
  }

  function flashBounce(item) {
    item.el.classList.add('is-hit');
    const existing = state.hitTimers.get(item.el);
    if (existing) {
      window.clearTimeout(existing);
    }
    const timer = window.setTimeout(() => {
      item.el.classList.remove('is-hit');
    }, 180);
    state.hitTimers.set(item.el, timer);
  }

  function updateBounds(item) {
    const maxX = Math.max(EDGE_PADDING, window.innerWidth - item.width - EDGE_PADDING);
    const maxY = Math.max(SAFE_TOP, window.innerHeight - item.height - SAFE_BOTTOM);

    if (item.x < EDGE_PADDING) {
      item.x = EDGE_PADDING;
      item.vx = Math.abs(item.vx);
      item.spin += 4;
      flashBounce(item);
    } else if (item.x > maxX) {
      item.x = maxX;
      item.vx = -Math.abs(item.vx);
      item.spin -= 4;
      flashBounce(item);
    }

    if (item.y < SAFE_TOP) {
      item.y = SAFE_TOP;
      item.vy = Math.abs(item.vy);
      item.spin += 3.2;
      flashBounce(item);
    } else if (item.y > maxY) {
      item.y = maxY;
      item.vy = -Math.abs(item.vy);
      item.spin -= 3.2;
      flashBounce(item);
    }
  }

  function updatePointerAura() {
    if (!state.pointer.active) {
      pointerAura.style.opacity = '0';
      return;
    }

    pointerAura.style.opacity = '1';
    pointerAura.style.transform = `translate3d(${state.pointer.x}px, ${state.pointer.y}px, 0)`;
  }

  function pointerMove(event) {
    const x = event.clientX;
    const y = event.clientY;
    state.pointer.vx = x - state.pointer.lastX;
    state.pointer.vy = y - state.pointer.lastY;
    state.pointer.x = x;
    state.pointer.y = y;
    state.pointer.lastX = x;
    state.pointer.lastY = y;
    state.pointer.active = true;
    updatePointerAura();
  }

  function pointerLeave() {
    state.pointer.active = false;
    state.pointer.vx = 0;
    state.pointer.vy = 0;
    updatePointerAura();
    if (state.activeBridge) {
      footerText.textContent = composeFooter('Le fond et les autres passages restent en tenue.');
    }
  }

  function setMotionState(message, mode) {
    motionState.className = `status-pill ${mode === 'warn' ? 'status-pill--warn' : 'status-pill--secondary'}`;
    motionState.innerHTML = `<span class="status-pill__dot"></span><span>${message}</span>`;
  }

  function enableOrientationTracking() {
    window.addEventListener('deviceorientation', (event) => {
      state.tilt.active = true;
      state.tilt.x = clamp((event.gamma || 0) / 28, -1.2, 1.2);
      state.tilt.y = clamp((event.beta || 0) / 34, -1.2, 1.2);
    });
    setMotionState('mouvement actif', 'ok');
    motionToggle.textContent = 'mouvement actif';
  }

  async function requestMotion() {
    if (
      typeof DeviceOrientationEvent !== 'undefined' &&
      typeof DeviceOrientationEvent.requestPermission === 'function'
    ) {
      if (state.motionPermissionAsked) {
        return;
      }
      state.motionPermissionAsked = true;

      try {
        const result = await DeviceOrientationEvent.requestPermission();
        if (result === 'granted') {
          enableOrientationTracking();
        } else {
          setMotionState('mouvement refuse', 'warn');
        }
      } catch (error) {
        setMotionState('mouvement indisponible', 'warn');
      }
      return;
    }

    if ('DeviceOrientationEvent' in window) {
      enableOrientationTracking();
      return;
    }

    setMotionState('accelerometre absent', 'warn');
  }

  function updateCameraState(message, warn = false) {
    cameraState.className = `status-pill ${warn ? 'status-pill--warn' : ''}`;
    cameraState.innerHTML = `<span class="status-pill__dot"></span><span>${message}</span>`;
  }

  function uniqueSources(sources) {
    return [...new Set(sources.filter(Boolean))];
  }

  function scheduleCameraRetry(delay = 8000) {
    if (state.camera.retryTimer) {
      window.clearTimeout(state.camera.retryTimer);
    }

    state.camera.retryTimer = window.setTimeout(() => {
      void initCamera();
    }, delay);
  }

  function tryCameraSource(sources, index = 0, attemptToken = state.camera.attemptToken) {
    if (attemptToken !== state.camera.attemptToken) {
      return;
    }

    if (index >= sources.length) {
      cameraFallback.hidden = false;
      cameraBackground.hidden = true;
      updateCameraState('fond en attente', true);
      cameraNote.textContent = 'Le fond sowwwl-pi cherche encore un relais en meme origine. Nouvelle tentative automatique en cours.';
      footerText.textContent = composeFooter('Fond de page: sowwwl-pi encore en veille de raccord. Le moniteur reste sur /hub/.');
      scheduleCameraRetry();
      return;
    }

    const candidate = sources[index];
    const probe = new Image();
    const cacheBusted = `${candidate}${candidate.includes('?') ? '&' : '?'}v=${Date.now()}`;

    const timeout = window.setTimeout(() => {
      probe.src = '';
      tryCameraSource(sources, index + 1, attemptToken);
    }, 3200);

    probe.onload = () => {
      if (attemptToken !== state.camera.attemptToken) {
        return;
      }

      window.clearTimeout(timeout);
      state.camera.activeSource = candidate;
      cameraBackground.hidden = false;
      cameraFallback.hidden = true;
      cameraBackground.src = cacheBusted;
      cameraBackground.onerror = () => {
        if (state.camera.activeSource !== candidate) {
          return;
        }

        state.camera.activeSource = '';
        cameraFallback.hidden = false;
        cameraBackground.hidden = true;
        updateCameraState('fond en reconnexion', true);
        cameraNote.textContent = 'Le relais sowwwl-pi s est interrompu. Nouvelle tentative automatique.';
        footerText.textContent = composeFooter('Fond de page: reconnexion sowwwl-pi en cours.');
        scheduleCameraRetry(2500);
      };
      updateCameraState('fond vivant');
      cameraNote.textContent = `Fond direct branche sur ${candidate.includes('/camera/live') ? '/camera/live' : 'le flux local MJPEG'}.`;
      footerText.textContent = composeFooter('Fond de page: sowwwl-pi tient la piece en continu.');
    };

    probe.onerror = () => {
      if (attemptToken !== state.camera.attemptToken) {
        return;
      }

      window.clearTimeout(timeout);
      tryCameraSource(sources, index + 1, attemptToken);
    };

    probe.src = cacheBusted;
  }

  async function initCamera() {
    state.camera.attemptToken += 1;

    const sources = [];
    const relayUrl = `${window.location.origin}/camera/live`;
    let dashboardUrl = localDashboardUrl;

    try {
      const response = await fetch(`${window.location.origin}/api/camera`, {
        cache: 'no-store'
      });

      if (response.ok) {
        const camera = await response.json();

        if (camera.proxyPath) {
          sources.push(new URL(camera.proxyPath, window.location.origin).toString());
        }

        if (camera.dashboardUrl) {
          dashboardUrl = camera.dashboardUrl;
        }
      }
    } catch (error) {
      cameraNote.textContent = 'Le hub public tourne sans reponse API camera. On tente quand meme le relais /camera/live.';
    }

    sources.push(relayUrl);

    if (window.location.protocol !== 'https:') {
      sources.push(localStreamUrl);
    }

    state.camera.sources = uniqueSources(sources);
    cameraOpen.href = dashboardUrl;
    tryCameraSource(state.camera.sources, 0, state.camera.attemptToken);
  }

  function recalcWindowSizes() {
    state.items.forEach((item, index) => {
      const { width, height } = sizeForViewport(index);
      item.width = width;
      item.height = height;
      item.el.style.setProperty('--window-width', `${width}px`);
      item.el.style.setProperty('--window-height', `${height}px`);
      item.el.style.setProperty('--frame-scale', `${width / FRAME_WIDTH}`);
      item.x = clamp(item.x, EDGE_PADDING, Math.max(EDGE_PADDING, window.innerWidth - width - EDGE_PADDING));
      item.y = clamp(item.y, SAFE_TOP, Math.max(SAFE_TOP, window.innerHeight - height - SAFE_BOTTOM));
    });
  }

  function animate(now) {
    const dt = Math.min(0.032, (now - state.lastTime) / 1000 || 0.016);
    state.lastTime = now;

    const pointerDecay = Math.pow(0.84, dt * 60);
    state.pointer.vx *= pointerDecay;
    state.pointer.vy *= pointerDecay;

    state.items.forEach((item, index) => {
      const cx = item.x + item.width / 2;
      const cy = item.y + item.height / 2;
      const settleX = window.innerWidth * 0.5;
      const settleY = window.innerHeight * 0.56;

      item.vx += state.tilt.x * 11 * dt;
      item.vy += state.tilt.y * 13 * dt;

      if (state.pointer.active) {
        const dx = cx - state.pointer.x;
        const dy = cy - state.pointer.y;
        const distance = Math.hypot(dx, dy);

        if (distance < POINTER_RADIUS) {
          const strength = (1 - distance / POINTER_RADIUS) * 132;
          const nx = dx / (distance || 1);
          const ny = dy / (distance || 1);
          item.vx += (nx * strength + state.pointer.vx * 0.52) * dt;
          item.vy += (ny * strength + state.pointer.vy * 0.52) * dt;
          item.spin += (state.pointer.vx + state.pointer.vy) * 0.0022 * dt * 60;
        }
      }

      item.vx += Math.sin((now * 0.00085) + index) * 0.48 * dt;
      item.vy += Math.cos((now * 0.00115) + index * 0.7) * 0.44 * dt;
      item.vx += (settleX - cx) * 0.011 * dt;
      item.vy += (settleY - cy) * 0.008 * dt;

      const friction = item.hover ? 0.989 : 0.993;
      item.vx *= Math.pow(friction, dt * 60);
      item.vy *= Math.pow(friction, dt * 60);
      item.spin *= Math.pow(0.991, dt * 60);

      item.x += item.vx * dt;
      item.y += item.vy * dt;
      item.angle += item.spin * dt;

      updateBounds(item);

      item.el.style.transform = `translate3d(${item.x}px, ${item.y}px, 0) rotate(${item.angle}deg)`;
    });

    requestAnimationFrame(animate);
  }

  function initWindows() {
    playfield.innerHTML = '';
    state.items = domains.map((domain, index) => createWindow(domain, index));
    state.items.forEach((item, index) => {
      item.el.style.zIndex = String(index + 1);
    });
  }

  function bindBridges() {
    if (!bridgeGrid) {
      return;
    }

    bridgeGrid.querySelectorAll('.bridge-card').forEach((card) => {
      const { domain } = card.dataset;

      card.addEventListener('pointerenter', () => {
        activateBridge(domain);
        focusWindow(findItem(domain), false);
      });

      card.addEventListener('focusin', () => {
        activateBridge(domain);
      });
    });

    bridgeGrid.querySelectorAll('[data-bridge-action="summon"]').forEach((button) => {
      button.addEventListener('click', () => {
        const domainName = button.dataset.domain;
        activateBridge(domainName);
        focusWindow(findItem(domainName), true);
      });
    });
  }

  window.addEventListener('pointermove', pointerMove);
  window.addEventListener('pointerleave', pointerLeave);
  window.addEventListener('resize', recalcWindowSizes);
  motionToggle.addEventListener('click', requestMotion);

  initWindows();
  bindBridges();
  activateBridge('sowwwl.com');
  initCamera();
  requestAnimationFrame(animate);
})();
