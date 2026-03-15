import express from 'express';
import http, { createServer } from 'http';
import https from 'https';
import { Server } from 'socket.io';
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, 'public');
const CLOUD_DIR = path.join(__dirname, 'cloud');
const ROOT_INDEX_PATH = path.join(__dirname, 'index.html');
const ROOT_STYLE_PATH = path.join(__dirname, 'style.css');
const ROOT_SCRIPT_PATH = path.join(__dirname, 'site.js');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' }
});

const PORT = envNumber('PORT', 3311);
const CAPTURE_INTERVAL_MS = envNumber('CAPTURE_INTERVAL_MS', 1000);
const DOMAIN_OFFSET_MS = envNumber('DOMAIN_OFFSET_MS', 11);
const PAGE_TIMEOUT_MS = envNumber('PAGE_TIMEOUT_MS', 8000);
const FOCUS_INTERVAL_MS = envNumber('FOCUS_INTERVAL_MS', 8000);
const CAPTURE_WIDTH = envNumber('CAPTURE_WIDTH', 1440);
const CAPTURE_HEIGHT = envNumber('CAPTURE_HEIGHT', 960);
const PLAYWRIGHT_EXECUTABLE_PATH = process.env.PLAYWRIGHT_EXECUTABLE_PATH;
const CAMERA_STREAM_URL = normalizeCameraUrl(process.env.CAMERA_STREAM_URL || 'http://192.168.1.22:8081/stream.mjpg');
const CAMERA_DASHBOARD_URL =
  normalizeCameraUrl(process.env.CAMERA_DASHBOARD_URL || deriveCameraDashboardUrl(CAMERA_STREAM_URL));

const DOMAINS = [
  {
    name: 'sowwwl.com',
    url: 'https://sowwwl.com',
    title: 'Le reseau minimal',
    cue: 'Le foyer central, le souffle de base.',
    story: 'Le coeur du lieu. On n y passe pas: on y prend place avant de sentir les autres seuils.',
    accent: '#f2b066'
  },
  {
    name: 'sowwwl.art',
    url: 'https://sowwwl.art',
    title: 'Plonger dans l O.',
    cue: 'Une chambre breve, presque performative.',
    story: 'La chambre la plus sensorielle. Elle interrompt le flux et impose une autre facon d habiter.',
    accent: '#9ed8c8'
  },
  {
    name: 'sowwwl.net',
    url: 'https://sowwwl.net',
    title: 'Marcher a pas de geant',
    cue: 'Un voisinage ou l on s installe en marchant.',
    story: 'Un territoire plus praticable, avec des prises concretes qui donnent du corps a la presence.',
    accent: '#f08b74'
  },
  {
    name: 'sowwwl.fr',
    url: 'https://sowwwl.fr',
    title: 'L atelier general de tout',
    cue: 'La fabrique, ses gestes, ses prises.',
    story: 'L atelier du lieu. On y sent comment le reseau se construit, s assemble et tient ensemble.',
    accent: '#c4bc8b'
  },
  {
    name: 'sowwwl.cloud',
    url: '/cloud/',
    captureUrl: `http://127.0.0.1:${PORT}/cloud/`,
    title: 'Le lieu tient dans la main',
    cue: 'Une couche mobile, legere, ouverte sans compte.',
    story: 'La chambre mobile du lieu. Apparition, instrument smartphone, mode invite: tout commence sans login.',
    accent: '#8ab7d8'
  }
];

const latestSnapshots = new Map();
const captureLocks = new Map(DOMAINS.map((domain) => [domain.name, false]));
const serverStartedAt = new Date().toISOString();

let browser = null;
let browserPromise = null;
let captureWave = 0;

app.get(['/', '/index.html'], (req, res) => {
  res.sendFile(ROOT_INDEX_PATH);
});

app.get('/style.css', (req, res) => {
  res.type('text/css').sendFile(ROOT_STYLE_PATH);
});

app.get('/site.js', (req, res) => {
  res.type('application/javascript').sendFile(ROOT_SCRIPT_PATH);
});

app.use('/cloud', express.static(CLOUD_DIR));
app.use('/hub', express.static(PUBLIC_DIR));

app.get('/healthz', (req, res) => {
  res.json({
    status: 'ok',
    browserReady: Boolean(browser),
    cameraConfigured: Boolean(CAMERA_STREAM_URL),
    captureWave,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/camera', (req, res) => {
  res.json(cameraConfig());
});

app.get('/api/domains', (req, res) => {
  res.json({
    domains: DOMAINS,
    config: publicConfig()
  });
});

app.get('/api/state', (req, res) => {
  res.json({
    startedAt: serverStartedAt,
    browserReady: Boolean(browser),
    captureWave,
    camera: cameraConfig(),
    domains: DOMAINS.map((domain) => {
      const snapshot = latestSnapshots.get(domain.name);

      return {
        name: domain.name,
        url: domain.url,
        status: snapshot?.status ?? 'idle',
        lastCaptureAt: snapshot?.timestamp ?? null,
        pageTitle: snapshot?.pageTitle ?? domain.title,
        error: snapshot?.error ?? null
      };
    })
  });
});

app.get('/camera/live', (req, res) => {
  proxyCameraStream(req, res);
});

app.head('/camera/live', (req, res) => {
  proxyCameraStream(req, res);
});

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  socket.emit('bootstrap', {
    domains: DOMAINS,
    config: publicConfig(),
    snapshots: Array.from(latestSnapshots.values()),
    system: {
      level: browser ? 'ok' : 'loading',
      message: browser ? 'Capture active.' : 'Chromium is starting.'
    }
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

async function captureDomain(domain, wave) {
  if (captureLocks.get(domain.name)) {
    return;
  }

  captureLocks.set(domain.name, true);

  let context = null;

  try {
    const activeBrowser = await ensureBrowser();

    context = await activeBrowser.newContext({
      viewport: {
        width: CAPTURE_WIDTH,
        height: CAPTURE_HEIGHT
      },
      deviceScaleFactor: 1,
      ignoreHTTPSErrors: true,
      locale: 'fr-FR'
    });

    const page = await context.newPage();
    page.setDefaultNavigationTimeout(PAGE_TIMEOUT_MS);
    page.setDefaultTimeout(PAGE_TIMEOUT_MS);

    let note = domain.cue;

    try {
      await page.goto(domain.captureUrl || domain.url, {
        waitUntil: 'domcontentloaded',
        timeout: PAGE_TIMEOUT_MS
      });
    } catch (error) {
      note = simplifyError(error);
    }

    const pageTitle = (await page.title().catch(() => '')) || domain.title;
    const screenshot = await page.screenshot({
      type: 'jpeg',
      quality: 70,
      animations: 'disabled'
    });

    const snapshot = {
      domain: domain.name,
      url: domain.url,
      title: domain.title,
      pageTitle,
      story: domain.story,
      cue: domain.cue,
      accent: domain.accent,
      timestamp: new Date().toISOString(),
      wave,
      status: 'ok',
      mimeType: 'image/jpeg',
      note,
      screenshot: screenshot.toString('base64')
    };

    latestSnapshots.set(domain.name, snapshot);
    io.emit('screenshot', snapshot);
    console.log(`Capture ok: ${domain.name}`);
  } catch (error) {
    const snapshot = {
      domain: domain.name,
      url: domain.url,
      title: domain.title,
      pageTitle: domain.title,
      story: domain.story,
      cue: domain.cue,
      accent: domain.accent,
      timestamp: new Date().toISOString(),
      wave,
      status: 'error',
      error: simplifyError(error),
      note: 'Capture indisponible, nouvelle tentative a la prochaine vague.'
    };

    latestSnapshots.set(domain.name, snapshot);
    io.emit('screenshot', snapshot);
    console.error(`Capture error for ${domain.name}: ${snapshot.error}`);
  } finally {
    captureLocks.set(domain.name, false);

    if (context) {
      await context.close().catch(() => {});
    }
  }
}

async function startCaptureLoop() {
  broadcastSystem(
    'ok',
    `Live wave ready: ${CAPTURE_INTERVAL_MS}ms cadence, ${DOMAIN_OFFSET_MS}ms offset.`
  );

  while (true) {
    captureWave += 1;
    const wave = captureWave;

    DOMAINS.forEach((domain, index) => {
      const delay = index * DOMAIN_OFFSET_MS;

      setTimeout(() => {
        void captureDomain(domain, wave);
      }, delay);
    });

    await sleep(CAPTURE_INTERVAL_MS);
  }
}

async function start() {
  httpServer.listen(PORT, () => {
    console.log(`SOWWWL hub listening on http://localhost:${PORT}`);
  });

  void ensureBrowser().catch((error) => {
    broadcastSystem('warn', `Chromium pending: ${simplifyError(error)}`);
  });

  startCaptureLoop().catch((error) => {
    console.error('Capture loop failed:', error);
    process.exit(1);
  });
}

function publicConfig() {
  return {
    captureIntervalMs: CAPTURE_INTERVAL_MS,
    domainOffsetMs: DOMAIN_OFFSET_MS,
    focusIntervalMs: FOCUS_INTERVAL_MS,
    camera: cameraConfig()
  };
}

function cameraConfig() {
  return {
    configured: Boolean(CAMERA_STREAM_URL),
    streamUrl: CAMERA_STREAM_URL || null,
    dashboardUrl: CAMERA_DASHBOARD_URL || null,
    proxyPath: CAMERA_STREAM_URL ? '/camera/live' : null,
    note: 'The proxy works only when this server can reach the camera over the same network.'
  };
}

function envNumber(name, fallback) {
  const value = Number(process.env[name]);

  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function normalizeCameraUrl(value) {
  if (!value) {
    return '';
  }

  const trimmed = String(value).trim();

  if (!trimmed) {
    return '';
  }

  return /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
}

function deriveCameraDashboardUrl(streamUrl) {
  if (!streamUrl) {
    return '';
  }

  try {
    const target = new URL(streamUrl);
    return `${target.origin}/`;
  } catch {
    return '';
  }
}

function simplifyError(error) {
  return String(error?.message || error)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function proxyCameraStream(req, res) {
  if (!CAMERA_STREAM_URL) {
    res.status(503).json({
      status: 'error',
      message: 'Camera stream is not configured.'
    });
    return;
  }

  const target = new URL(CAMERA_STREAM_URL);
  const transport = target.protocol === 'https:' ? https : http;

  const upstreamRequest = transport.request(
    target,
    {
      method: req.method === 'HEAD' ? 'HEAD' : 'GET',
      headers: {
        Accept: req.headers.accept || '*/*',
        'User-Agent': 'sowwwl-hub-camera-proxy'
      }
    },
    (upstreamResponse) => {
      const headers = { ...upstreamResponse.headers };
      delete headers['content-length'];
      delete headers['content-security-policy'];
      delete headers['x-frame-options'];

      res.status(upstreamResponse.statusCode || 200);
      res.set({
        ...headers,
        'cache-control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'x-sowwwl-camera-source': CAMERA_STREAM_URL
      });

      if (req.method === 'HEAD') {
        upstreamResponse.resume();
        res.end();
        return;
      }

      upstreamResponse.pipe(res);
    }
  );

  upstreamRequest.on('error', (error) => {
    if (!res.headersSent) {
      res.status(502).json({
        status: 'error',
        message: simplifyError(error),
        source: CAMERA_STREAM_URL
      });
      return;
    }

    res.end();
  });

  req.on('close', () => {
    upstreamRequest.destroy();
  });

  upstreamRequest.end();
}

function launchOptions() {
  const args = ['--disable-dev-shm-usage'];

  if (process.platform === 'linux') {
    args.push('--no-sandbox', '--disable-setuid-sandbox');
  }

  const options = {
    headless: true,
    args
  };

  if (PLAYWRIGHT_EXECUTABLE_PATH) {
    options.executablePath = PLAYWRIGHT_EXECUTABLE_PATH;
  }

  return options;
}

function broadcastSystem(level, message) {
  io.emit('system', {
    level,
    message,
    timestamp: new Date().toISOString()
  });
}

async function ensureBrowser() {
  if (browser) {
    return browser;
  }

  if (browserPromise) {
    return browserPromise;
  }

  browserPromise = chromium
    .launch(launchOptions())
    .then((instance) => {
      browser = instance;

      browser.on('disconnected', () => {
        browser = null;
        broadcastSystem('warn', 'Chromium disconnected. Next wave will relaunch it.');
      });

      broadcastSystem('ok', 'Chromium ready for live capture.');
      return instance;
    })
    .finally(() => {
      browserPromise = null;
    });

  return browserPromise;
}

async function shutdown(signal) {
  console.log(`${signal} received, shutting down.`);

  if (browser) {
    await browser.close().catch(() => {});
  }

  process.exit(0);
}

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});

start();
