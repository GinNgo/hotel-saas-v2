const http = require('http');
const fs = require('fs');
const path = require('path');
const { server: apiServer } = require('./fixture-server.cjs');

const STATIC_DIR = path.resolve(__dirname, '../../../../frontend/dist/frontend/browser');
const FRONTEND_PORT = 4200;
const API_PORT = 5283;

// Start mock API fixture server on 5283
apiServer.listen(API_PORT, '127.0.0.1', () => {
  console.log(`[FIXTURE-API] In-memory fixture server listening on http://127.0.0.1:${API_PORT}`);
});

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

const frontendServer = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  // Proxy /api/* to mock fixture server on 5283
  if (pathname.startsWith('/api/')) {
    const proxyReq = http.request({
      hostname: '127.0.0.1',
      port: API_PORT,
      path: req.url,
      method: req.method,
      headers: {
        ...req.headers,
        host: `127.0.0.1:${API_PORT}`
      }
    }, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    });
    proxyReq.on('error', (err) => {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Proxy error', details: err.message }));
    });
    req.pipe(proxyReq);
    return;
  }

  // Serve static files from Angular build
  let filePath = path.join(STATIC_DIR, pathname);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  } else {
    // SPA fallback to index.html
    const indexPath = path.join(STATIC_DIR, 'index.html');
    res.writeHead(200, { 'Content-Type': 'text/html' });
    fs.createReadStream(indexPath).pipe(res);
  }
});

frontendServer.listen(FRONTEND_PORT, '127.0.0.1', () => {
  console.log(`[FRONTEND] Serving static Angular build on http://127.0.0.1:${FRONTEND_PORT}`);
});

process.on('SIGINT', () => {
  frontendServer.close();
  apiServer.close();
  process.exit(0);
});
