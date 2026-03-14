import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' }
});

const PORT = process.env.PORT || 3311;

// Configuration des domaines à capturer
const DOMAINS = [
  { name: 'sowwwl.com', url: 'https://sowwwl.com' },
  { name: 'sowwwl.art', url: 'https://sowwwl.art' },
  { name: 'sowwwl.net', url: 'https://sowwwl.net' },
  { name: 'sowwwl.fr', url: 'https://sowwwl.fr' },
  { name: 'sowwwl.cloud', url: 'https://sowwwl.cloud' }
];

const CAPTURE_INTERVAL = 1000; // 1 fps en ms
const DOMAIN_OFFSET = 11; // 11ms entre chaque domaine

let currentDomainIndex = 0;
let browser = null;

// Servir les fichiers statiques
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint
app.get('/healthz', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API: état des domaines
app.get('/api/domains', (req, res) => {
  res.json(DOMAINS);
});

// Socket.IO: gestion des connexions et de la capture
io.on('connection', (socket) => {
  console.log('Client connecté:', socket.id);
  
  socket.emit('domains', DOMAINS);
  
  socket.on('disconnect', () => {
    console.log('Client déconnecté:', socket.id);
  });
});

// Fonction de capture Playwright
async function captureScreenshot(domain) {
  if (!browser) return null;
  
  try {
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    
    // Timeout court pour les domaines lents
    page.setDefaultTimeout(5000);
    
    try {
      await page.goto(domain.url, { waitUntil: 'domcontentloaded', timeout: 5000 });
    } catch (err) {
      console.log(`⚠️  ${domain.name}: timeout ou erreur réseau`);
      // Continuer même si la page charge lentement
    }
    
    const screenshot = await page.screenshot({ type: 'png' });
    await context.close();
    
    return {
      domain: domain.name,
      timestamp: new Date().toISOString(),
      screenshot: screenshot.toString('base64'),
      status: 'ok'
    };
  } catch (error) {
    console.error(`❌ Erreur capture ${domain.name}:`, error.message);
    return {
      domain: domain.name,
      timestamp: new Date().toISOString(),
      status: 'error',
      error: error.message
    };
  }
}

// Boucle de capture avec décalage
async function startCaptureLoop() {
  console.log('🎬 Démarrage boucle de capture...');
  
  while (true) {
    for (let i = 0; i < DOMAINS.length; i++) {
      const domain = DOMAINS[i];
      
      // Capture asynchrone
      captureScreenshot(domain).then(result => {
        if (result) {
          io.emit('screenshot', result);
          console.log(`📸 ${domain.name} - ${result.status}`);
        }
      });
      
      // Décalage de 11ms avant le domaine suivant
      await new Promise(resolve => setTimeout(resolve, DOMAIN_OFFSET));
    }
    
    // Attendre 1 seconde avant la prochaine vague
    await new Promise(resolve => setTimeout(resolve, CAPTURE_INTERVAL));
  }
}

// Initialisation Playwright et démarrage
async function start() {
  try {
    console.log('🚀 SOWWWL Mosaic Monitor');
    console.log(`📍 http://localhost:${PORT}`);
    
    // Lancer Chromium avec les drapeaux recommandés pour Docker
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    console.log('✅ Playwright ready');
    
    // Démarrer le serveur HTTP
    httpServer.listen(PORT, () => {
      console.log(`✅ Serveur en écoute sur le port ${PORT}`);
    });
    
    // Démarrer la boucle de capture
    startCaptureLoop().catch(err => {
      console.error('Erreur boucle capture:', err);
      process.exit(1);
    });
    
  } catch (error) {
    console.error('❌ Erreur démarrage:', error);
    process.exit(1);
  }
}

// Fermeture propre
process.on('SIGINT', async () => {
  console.log('\n🛑 Arrêt...');
  if (browser) await browser.close();
  process.exit(0);
});

start();
