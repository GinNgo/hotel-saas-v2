const http = require('node:http');
const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');
const { handleChat } = require('./ai-chat-handler.js');

const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';
const BACKEND_TARGET = process.env.BACKEND_API_URL || 'https://luxustay.duckdns.org';

// Resolve Angular production build directory (supports both @angular/build:application browser/ and legacy flat dist)
const distCandidates = [
  path.resolve(__dirname, '../dist/frontend/browser'),
  path.resolve(__dirname, '../dist/frontend'),
  path.resolve(process.cwd(), 'frontend/dist/frontend/browser'),
  path.resolve(process.cwd(), 'frontend/dist/frontend'),
  path.resolve(process.cwd(), 'dist/frontend/browser'),
  path.resolve(process.cwd(), 'dist/frontend')
];

function resolveStaticRoot() {
  for (const candidate of distCandidates) {
    if (fs.existsSync(path.join(candidate, 'index.html'))) {
      return candidate;
    }
  }
  return distCandidates[0];
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json'
};

/**
 * Reverse proxy for /api/* and /hubs/* to the upstream backend API
 */
function proxyToBackend(req, res) {
  const targetUrl = new URL(req.url, BACKEND_TARGET);
  const isHttps = targetUrl.protocol === 'https:';
  const transport = isHttps ? https : http;

  const headers = { ...req.headers };
  headers.host = targetUrl.host;
  delete headers['connection'];

  const proxyReq = transport.request(
    {
      protocol: targetUrl.protocol,
      hostname: targetUrl.hostname,
      port: targetUrl.port || (isHttps ? 443 : 80),
      method: req.method,
      path: targetUrl.pathname + targetUrl.search,
      headers,
      timeout: 30000
    },
    proxyRes => {
      res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
      proxyRes.pipe(res, { end: true });
    }
  );

  proxyReq.on('error', err => {
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(
        JSON.stringify({
          succeeded: false,
          message: 'Upstream API temporarily unavailable',
          detail: err.message
        })
      );
    }
  });

  req.pipe(proxyReq, { end: true });
}

const server = http.createServer((req, res) => {
  const rawUrl = req.url || '/';
  const pathname = rawUrl.split('?')[0];

  // 1. Health check endpoint for Cloud Run startup/liveness probes
  if (pathname === '/healthz' || pathname === '/_ah/health') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
    return;
  }

  // 2. Built-in AI Concierge endpoint
  if (pathname.startsWith('/api/ai/chat')) {
    handleChat(req, res);
    return;
  }

  // 3. Proxy /api/* and /hubs/* to upstream Hotel SaaS backend
  if (pathname.startsWith('/api/') || pathname.startsWith('/hubs/')) {
    proxyToBackend(req, res);
    return;
  }

  // 4. Serve compiled Angular static files & SPA fallback
  const staticRoot = resolveStaticRoot();
  const safePath = path.normalize(decodeURIComponent(pathname)).replace(/^(\.\.(\/|\\|$))+/, '');
  let filePath = path.join(staticRoot, safePath);

  try {
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      const cacheControl =
        ext === '.html' ? 'no-cache, no-store, must-revalidate' : 'public, max-age=31536000, immutable';
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': cacheControl
      });
      fs.createReadStream(filePath).pipe(res);
      return;
    }
  } catch {
    // Fall through to SPA index.html
  }

  // SPA fallback to index.html
  const indexHtmlPath = path.join(staticRoot, 'index.html');
  if (fs.existsSync(indexHtmlPath)) {
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    });
    fs.createReadStream(indexHtmlPath).pipe(res);
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end('<!doctype html><html><body><h1>Hotel SaaS Platform v2 is starting...</h1></body></html>');
});

server.listen(PORT, HOST, () => {
  console.log(`Hotel SaaS production server listening on http://${HOST}:${PORT}`);
});
