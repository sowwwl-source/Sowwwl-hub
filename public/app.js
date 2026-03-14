const socket = io();

const state = {
  domains: [],
  config: {
    captureIntervalMs: 1000,
    domainOffsetMs: 11,
    focusIntervalMs: 8000
  },
  snapshots: new Map(),
  focusedIndex: 0,
  lastWaveSeen: 0,
  focusTimer: null
};

const elements = {
  status: document.getElementById('status'),
  captureMeta: document.getElementById('captureMeta'),
  guideText: document.getElementById('guideText'),
  focusName: document.getElementById('focusName'),
  focusUrl: document.getElementById('focusUrl'),
  focusStory: document.getElementById('focusStory'),
  focusNote: document.getElementById('focusNote'),
  focusImage: document.getElementById('focusImage'),
  focusPlaceholder: document.getElementById('focusPlaceholder'),
  journeyList: document.getElementById('journeyList'),
  mosaic: document.getElementById('mosaic'),
  lastWaveAt: document.getElementById('lastWaveAt'),
  activityCount: document.getElementById('activityCount')
};

socket.on('connect', () => {
  setStatus('Connecte au serveur.', 'ok');
});

socket.on('disconnect', () => {
  setStatus('Connexion perdue. Reconnexion en cours...', 'error');
});

socket.on('bootstrap', ({ domains, config, snapshots, system }) => {
  state.domains = domains;
  state.config = { ...state.config, ...config };

  renderJourney();
  renderMosaic();
  updateCaptureMeta();

  snapshots.forEach((snapshot) => {
    state.snapshots.set(snapshot.domain, snapshot);
    updateTile(snapshot.domain);
  });

  if (system?.message) {
    setStatus(system.message, system.level || 'loading');
  }

  setFocus(0);
  restartFocusTimer();
  updateActivity();
});

socket.on('domains', (domains) => {
  if (state.domains.length > 0) {
    return;
  }

  state.domains = domains;
  renderJourney();
  renderMosaic();
  updateCaptureMeta();
  setFocus(0);
  restartFocusTimer();
  updateActivity();
});

socket.on('system', ({ message, level }) => {
  setStatus(message, level || 'loading');
});

socket.on('screenshot', (snapshot) => {
  state.snapshots.set(snapshot.domain, snapshot);
  updateTile(snapshot.domain);
  updateActivity();

  if (snapshot.wave && snapshot.wave > state.lastWaveSeen) {
    state.lastWaveSeen = snapshot.wave;
    elements.lastWaveAt.textContent = `Vague ${snapshot.wave} · ${formatClock(snapshot.timestamp)}`;
  }

  const focusedDomain = state.domains[state.focusedIndex];
  if (focusedDomain && focusedDomain.name === snapshot.domain) {
    updateFocusPanel();
  }
});

function renderJourney() {
  elements.journeyList.innerHTML = '';

  state.domains.forEach((domain, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'journey-step';
    button.dataset.index = String(index);
    button.style.setProperty('--accent', domain.accent);
    button.innerHTML = `
      <span class="journey-order">${String(index + 1).padStart(2, '0')}</span>
      <span class="journey-name">${domain.name}</span>
      <span class="journey-cue">${domain.cue}</span>
    `;

    button.addEventListener('click', () => {
      setFocus(index);
      restartFocusTimer();
    });

    elements.journeyList.appendChild(button);
  });
}

function renderMosaic() {
  elements.mosaic.innerHTML = '';

  state.domains.forEach((domain, index) => {
    const tile = document.createElement('article');
    tile.className = 'tile';
    tile.id = tileId(domain.name);
    tile.style.setProperty('--accent', domain.accent);
    tile.style.setProperty('--drift-y', `${(index % 2) * 18 + Math.floor(index / 2) * 6}px`);
    tile.style.setProperty('--tilt', `${index % 2 === 0 ? '-0.6deg' : '0.8deg'}`);
    tile.innerHTML = `
      <div class="tile-top">
        <span class="tile-badge">capture ${String(index + 1).padStart(2, '0')}</span>
        <span class="tile-state is-loading">INIT</span>
      </div>
      <div class="tile-frame">
        <img class="tile-image" alt="${domain.name}" hidden>
        <div class="tile-placeholder">Premiere presence en approche.</div>
      </div>
      <div class="tile-bottom">
        <h3>${domain.name}</h3>
        <p>${domain.story}</p>
        <span class="tile-time">Aucune capture</span>
      </div>
    `;

    tile.addEventListener('click', () => {
      setFocus(index);
      restartFocusTimer();
    });

    elements.mosaic.appendChild(tile);
  });
}

function updateTile(domainName) {
  const snapshot = state.snapshots.get(domainName);
  const tile = document.getElementById(tileId(domainName));

  if (!snapshot || !tile) {
    return;
  }

  const stateEl = tile.querySelector('.tile-state');
  const imageEl = tile.querySelector('.tile-image');
  const placeholderEl = tile.querySelector('.tile-placeholder');
  const timeEl = tile.querySelector('.tile-time');
  const copyEl = tile.querySelector('.tile-bottom p');

  timeEl.textContent = `${formatClock(snapshot.timestamp)} · ${snapshot.pageTitle || snapshot.title}`;

  if (snapshot.status === 'ok' && snapshot.screenshot) {
    stateEl.textContent = 'LIVE';
    stateEl.className = 'tile-state is-live';
    imageEl.src = `data:${snapshot.mimeType || 'image/jpeg'};base64,${snapshot.screenshot}`;
    imageEl.hidden = false;
    placeholderEl.hidden = true;
    copyEl.textContent = snapshot.note || snapshot.story || snapshot.cue;
    tile.classList.remove('is-error');
    tile.classList.add('is-live');
  } else {
    stateEl.textContent = 'RETRY';
    stateEl.className = 'tile-state is-error';
    imageEl.hidden = true;
    placeholderEl.hidden = false;
    placeholderEl.textContent = snapshot.error || snapshot.note || 'Capture indisponible.';
    copyEl.textContent = snapshot.note || snapshot.story || snapshot.cue;
    tile.classList.remove('is-live');
    tile.classList.add('is-error');
  }
}

function setFocus(index) {
  if (!state.domains.length) {
    return;
  }

  state.focusedIndex = ((index % state.domains.length) + state.domains.length) % state.domains.length;

  document.querySelectorAll('.journey-step').forEach((button, currentIndex) => {
    button.classList.toggle('is-active', currentIndex === state.focusedIndex);
  });

  document.querySelectorAll('.tile').forEach((tile, currentIndex) => {
    tile.classList.toggle('is-focused', currentIndex === state.focusedIndex);
  });

  updateFocusPanel();
}

function updateFocusPanel() {
  const domain = state.domains[state.focusedIndex];

  if (!domain) {
    return;
  }

  const snapshot = state.snapshots.get(domain.name);

  elements.guideText.textContent = domain.story;
  elements.focusName.textContent = domain.name;
  elements.focusUrl.textContent = domain.url;
  elements.focusStory.textContent = domain.story;
  elements.focusNote.textContent =
    snapshot?.status === 'ok'
      ? snapshot.note || domain.cue
      : snapshot?.error || snapshot?.note || domain.cue;

  document.documentElement.style.setProperty('--focus-accent', domain.accent);

  if (snapshot?.status === 'ok' && snapshot.screenshot) {
    elements.focusImage.src = `data:${snapshot.mimeType || 'image/jpeg'};base64,${snapshot.screenshot}`;
    elements.focusImage.alt = `Capture ${domain.name}`;
    elements.focusImage.hidden = false;
    elements.focusPlaceholder.hidden = true;
  } else {
    elements.focusImage.hidden = true;
    elements.focusPlaceholder.hidden = false;
    elements.focusPlaceholder.textContent =
      snapshot?.error || snapshot?.note || 'Premiere presence en approche.';
  }
}

function updateActivity() {
  const liveCount = state.domains.filter((domain) => {
    return state.snapshots.get(domain.name)?.status === 'ok';
  }).length;

  elements.activityCount.textContent = `${liveCount}/${state.domains.length || 5} domaines a jour`;
}

function updateCaptureMeta() {
  elements.captureMeta.textContent = [
    `${state.domains.length || 5} domaines`,
    `${Math.round(1000 / state.config.captureIntervalMs)} fps`,
    `decalage ${state.config.domainOffsetMs} ms`,
    `focus auto ${Math.round(state.config.focusIntervalMs / 1000)} s`
  ].join(' · ');
}

function restartFocusTimer() {
  if (state.focusTimer) {
    window.clearInterval(state.focusTimer);
  }

  if (state.domains.length < 2) {
    return;
  }

  state.focusTimer = window.setInterval(() => {
    setFocus(state.focusedIndex + 1);
  }, state.config.focusIntervalMs);
}

function setStatus(message, level) {
  elements.status.textContent = message;
  elements.status.className = `status-pill is-${level}`;
}

function formatClock(timestamp) {
  return new Date(timestamp).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function tileId(domainName) {
  return `tile-${domainName.replace(/[^a-z0-9]+/gi, '-')}`;
}
