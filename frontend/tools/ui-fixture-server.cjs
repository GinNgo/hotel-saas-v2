const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../dist/frontend/browser');
const property = {
  propertyId: 'qa-property', name: 'Khách sạn kiểm thử giao diện — dữ liệu minh họa', slug: 'qa-property',
  propertyType: 'Hotel', addressLine: 'Địa chỉ fixture', provinceName: 'Khu vực kiểm thử',
  tenantId: '', tenantBrandName: '', allowedRentalTypes: ['Daily'], allowDailyBooking: true,
  checkInTime: '14:00', checkOutTime: '12:00', reviewCount: 0, ratingAverage: 0,
  thumbnailUrl: '/images/dalat-pine-resort.png',
  galleryUrls: ['/images/dalat-pine-resort.png', '/images/deluxe-double-pine.png', '/qa-missing-photo.png'],
  nearbyLandmarks: [], dailyPriceFrom: 300000,
  availableRoomTypes: [{ roomTypeId: 'qa-room', name: 'Hạng phòng kiểm thử', maxGuests: 2,
    dailyPrice: 300000, images: [], amenities: [] }],
};
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };

http.createServer((request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; frame-src 'none'");
  const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
  if (pathname.startsWith('/api/')) {
    response.setHeader('Content-Type', 'application/json');
    if (request.method !== 'GET') {
      response.writeHead(405).end(JSON.stringify({ message: 'QA fixture: mutations disabled' }));
    } else if (pathname === '/api/public/properties') {
      response.end(JSON.stringify({ data: [property] }));
    } else if (pathname === '/api/public/properties/qa-property') {
      response.end(JSON.stringify({ data: property }));
    } else {
      response.writeHead(503).end(JSON.stringify({ message: 'QA fixture: endpoint not provided; no upstream' }));
    }
    return;
  }
  let target;
  try { target = path.resolve(root, '.' + decodeURIComponent(pathname)); }
  catch { response.writeHead(400).end(); return; }
  if (!target.startsWith(root + path.sep)) { response.writeHead(403).end(); return; }
  if (!path.extname(pathname)) target = path.join(root, 'index.html');
  fs.readFile(target, (error, content) => {
    if (error) { response.writeHead(404).end(); return; }
    response.setHeader('Content-Type', mime[path.extname(target)] || 'application/octet-stream');
    response.end(content);
  });
}).listen(4319, '127.0.0.1', () => console.log('Isolated UI fixtures: http://127.0.0.1:4319/booking (no upstream API)'));
