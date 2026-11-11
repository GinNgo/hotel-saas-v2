const http = require('node:http');
const { handleChat } = require('./server/ai-chat-handler.js');

const AI_PROXY_PORT = 3099;

const aiServer = http.createServer((req, res) => {
  if (req.url && req.url.startsWith('/api/ai/chat')) {
    handleChat(req, res);
    return;
  }
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not Found' }));
});

aiServer.on('error', err => {
  // Ignore EADDRINUSE if another worker already bound port 3099
  if (err && err.code !== 'EADDRINUSE') {
    console.warn('AI local proxy server warning:', err.message);
  }
});

aiServer.listen(AI_PROXY_PORT, '127.0.0.1');
aiServer.unref();

module.exports = {
  '/api/ai': {
    target: `http://127.0.0.1:${AI_PROXY_PORT}`,
    secure: false,
    changeOrigin: true
  },
  '/api': {
    target: 'https://luxustay.duckdns.org',
    secure: true,
    changeOrigin: true,
    logLevel: 'debug'
  },
  '/hubs': {
    target: 'https://luxustay.duckdns.org',
    secure: true,
    ws: true,
    changeOrigin: true,
    logLevel: 'debug'
  }
};
