const http = require('node:http');
const https = require('node:https');
const net = require('node:net');
const tls = require('node:tls');
const fs = require('node:fs');
const path = require('node:path');
const { handleChat } = require('./ai-chat-handler.js');

// Nginx in the container listens on port 8080 and reverse-proxies to localhost:3000.
// When Cloud Run sets PORT=8080 for Nginx, the Node app must bind to port 3000.
const PORT = process.env.APP_PORT
  ? Number(process.env.APP_PORT)
  : (process.env.PORT && process.env.PORT !== '8080' ? Number(process.env.PORT) : 3000);
const HOST = '0.0.0.0';
const BACKEND_TARGET =
  process.env.BACKEND_API_URL ||
  (process.env.NODE_ENV === 'production' ? 'https://luxustay.duckdns.org' : 'http://localhost:5283');

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

function isProxyWebSocketPath(pathname) {
  return pathname.startsWith('/hubs/') || pathname === '/hubs' || pathname.startsWith('/api/');
}

function writeHttpSocketErrorAndClose(socket, statusLine) {
  if (!socket.destroyed && socket.writable) {
    try {
      socket.write(`${statusLine}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
    } catch {
      // Ignore write error on closing socket
    }
  }
  if (!socket.destroyed) {
    socket.destroy();
  }
}

/**
 * WebSocket upgrade proxy for /hubs/* (SignalR) and /api/* to BACKEND_TARGET
 */
server.on('upgrade', (req, socket, head) => {
  const rawUrl = req.url || '/';
  const pathname = rawUrl.split('?')[0];

  if (!isProxyWebSocketPath(pathname)) {
    writeHttpSocketErrorAndClose(socket, 'HTTP/1.1 404 Not Found');
    return;
  }

  let targetUrl;
  try {
    targetUrl = new URL(rawUrl, BACKEND_TARGET);
  } catch {
    writeHttpSocketErrorAndClose(socket, 'HTTP/1.1 400 Bad Request');
    return;
  }

  const isTls = targetUrl.protocol === 'https:';
  const port = Number(targetUrl.port) || (isTls ? 443 : 80);
  const hostname = targetUrl.hostname;
  const requestPath = targetUrl.pathname + targetUrl.search;

  const upstreamSocket = isTls
    ? tls.connect({ host: hostname, port, servername: hostname })
    : net.connect({ host: hostname, port });

  socket.setNoDelay(true);
  upstreamSocket.setNoDelay(true);

  let connected = false;
  let cleanedUp = false;

  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    if (!socket.destroyed) socket.destroy();
    if (!upstreamSocket.destroyed) upstreamSocket.destroy();
  };

  upstreamSocket.on(isTls ? 'secureConnect' : 'connect', () => {
    connected = true;
    const headerLines = [`GET ${requestPath} HTTP/1.1`, `Host: ${targetUrl.host}`];
    const raw = Array.isArray(req.rawHeaders) ? req.rawHeaders : [];
    let hasUpgrade = false;
    let hasConnection = false;

    for (let i = 0; i < raw.length; i += 2) {
      const name = String(raw[i] ?? '').replace(/[\r\n]+/g, '');
      if (!name) continue;
      const value = String(raw[i + 1] ?? '').replace(/[\r\n]+/g, ' ');
      const lower = name.toLowerCase();
      if (lower === 'host') continue;
      if (lower === 'upgrade') hasUpgrade = true;
      if (lower === 'connection') hasConnection = true;
      headerLines.push(`${name}: ${value}`);
    }

    if (!hasUpgrade && req.headers.upgrade) {
      headerLines.push(`Upgrade: ${String(req.headers.upgrade).replace(/[\r\n]+/g, ' ')}`);
    }
    if (!hasConnection && req.headers.connection) {
      headerLines.push(`Connection: ${String(req.headers.connection).replace(/[\r\n]+/g, ' ')}`);
    }

    upstreamSocket.write(`${headerLines.join('\r\n')}\r\n\r\n`);
    if (head && head.length > 0) {
      upstreamSocket.write(head);
    }

    upstreamSocket.pipe(socket);
    socket.pipe(upstreamSocket);
  });

  upstreamSocket.on('error', () => {
    if (!connected) {
      writeHttpSocketErrorAndClose(socket, 'HTTP/1.1 502 Bad Gateway');
    }
    cleanup();
  });

  socket.on('error', cleanup);
  upstreamSocket.on('end', () => {
    if (!socket.destroyed) socket.end();
  });
  socket.on('end', () => {
    if (!upstreamSocket.destroyed) upstreamSocket.end();
  });
  upstreamSocket.on('close', cleanup);
  socket.on('close', cleanup);
});

server.listen(PORT, HOST, () => {
  console.log(`Hotel SaaS production server listening on http://${HOST}:${PORT}`);
});
