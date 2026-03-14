const socket = io();

let domains = [];
let screenshots = {};
let focusedDomain = 0;
let focusRotation = 0;

// Connexion et initialisation
socket.on('connect', () => {
  updateStatus('Connecté au serveur', true);
  console.log('✅ Connecté au serveur');
});

socket.on('disconnect', () => {
  updateStatus('Déconnecté', false);
  console.log('❌ Déconnecté');
});

socket.on('domains', (data) => {
  domains = data;
  initMosaic();
  console.log('📍 Domaines reçus:', domains.length);
});

// Réception des captures
socket.on('screenshot', (data) => {
  screenshots[data.domain] = data;
  updateTile(data.domain, data);
  
  // Rotation du focus tous les 5 captures
  focusRotation++;
  if (focusRotation % 5 === 0) {
    focusedDomain = (focusedDomain + 1) % domains.length;
    updateFocus();
  }
});

// Initialiser la grille mosaïque
function initMosaic() {
  const mosaic = document.getElementById('mosaic');
  mosaic.innerHTML = '';

  domains.forEach((domain, idx) => {
    const tile = document.createElement('div');
    tile.className = 'tile';
    tile.id = `tile-${domain.name}`;
    if (idx === 0) tile.classList.add('focused');

    tile.innerHTML = `
      <div class="tile-header">
        <span class="tile-name">${domain.name}</span>
        <span class="tile-status loading">INIT</span>
      </div>
      <div class="tile-content">
        <div class="tile-placeholder">En attente de capture...</div>
      </div>
      <div class="tile-timestamp">--:--:--</div>
    `;

    tile.addEventListener('click', () => {
      focusedDomain = idx;
      updateFocus();
    });

    mosaic.appendChild(tile);
  });
}

// Mettre à jour une tuile avec la capture
function updateTile(domainName, data) {
  const tile = document.getElementById(`tile-${domainName}`);
  if (!tile) return;

  const statusEl = tile.querySelector('.tile-status');
  const contentEl = tile.querySelector('.tile-content');
  const timestampEl = tile.querySelector('.tile-timestamp');

  if (data.status === 'ok') {
    statusEl.textContent = 'OK';
    statusEl.classList.remove('error', 'loading');

    // Créer ou remplacer l'image
    let img = contentEl.querySelector('img');
    if (!img) {
      img = document.createElement('img');
      img.className = 'tile-screenshot';
      contentEl.innerHTML = '';
      contentEl.appendChild(img);
    }
    img.src = `data:image/png;base64,${data.screenshot}`;

    timestampEl.textContent = new Date(data.timestamp).toLocaleTimeString('fr-FR');
  } else {
    statusEl.textContent = 'ERREUR';
    statusEl.classList.add('error');
    statusEl.classList.remove('loading');
    contentEl.innerHTML = `<div class="tile-placeholder">⚠️ ${data.error || 'Erreur réseau'}</div>`;
    timestampEl.textContent = new Date(data.timestamp).toLocaleTimeString('fr-FR');
  }
}

// Mettre à jour le focus
function updateFocus() {
  document.querySelectorAll('.tile').forEach((tile, idx) => {
    tile.classList.toggle('focused', idx === focusedDomain);
  });
}

// Mettre à jour le statut global
function updateStatus(message, online) {
  const status = document.getElementById('status');
  status.textContent = message;
  status.classList.toggle('online', online);
  status.classList.toggle('offline', !online);
}

// Auto-focus: tourner le domaine en focus tous les 10 secondes
setInterval(() => {
  focusedDomain = (focusedDomain + 1) % domains.length;
  updateFocus();
}, 10000);

console.log('🎬 SOWWWL Mosaic Monitor chargé');
