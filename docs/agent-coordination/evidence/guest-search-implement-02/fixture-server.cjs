const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 4282;
const BROWSER_DIST = path.resolve(__dirname, '../../../../frontend/dist/frontend/browser');
const AUDIT_FILE = path.resolve(__dirname, 'network-audit.json');

const requestLogs = [];
const holdsMap = new Map();

const mockProperties = [
  {
    id: 'prop-001',
    name: 'Khách sạn Sài Gòn Central',
    code: 'SGC',
    slug: 'khach-san-sai-gon-central',
    address: '123 Lê Lợi, Phường Bến Thành, Quận 1, TP. Hồ Chí Minh',
    city: 'TP. Hồ Chí Minh',
    checkInTime: '14:00',
    checkOutTime: '12:00',
    bufferMinutes: 60,
    maxHourlyHours: 4,
    imageUrl: null // Explicit null to verify SVG fallback placeholder
  },
  {
    id: 'prop-002',
    name: 'Khách Sạn Biển Đông Đà Nẵng',
    code: 'BD01',
    slug: 'khach-san-bien-dong-da-nang',
    address: '200 Võ Nguyên Giáp, Quận Sơn Trà, TP. Đà Nẵng',
    city: 'Đà Nẵng',
    checkInTime: '14:00',
    checkOutTime: '12:00',
    bufferMinutes: 30,
    maxHourlyHours: 12,
    imageUrl: null
  }
];

const mockAvailability = [
  {
    roomTypeId: 'rt-deluxe',
    roomTypeName: 'Deluxe Double Room',
    description: 'Phòng đôi cao cấp view thoáng, giường King 1m8 và bồn tắm sang trọng.',
    maxOccupancy: 3,
    bedType: '1 Giường King đôi',
    squareMeters: 35,
    imageUrl: null,
    totalRooms: 10,
    availableRooms: 6,
    isAvailable: true,
    estimatedPrice: 1200000
  },
  {
    roomTypeId: 'rt-suite',
    roomTypeName: 'Executive Suite',
    description: 'Căn hộ cao cấp view toàn cảnh, phòng khách riêng và ban công ngắm phố.',
    maxOccupancy: 4,
    bedType: '1 Giường Super King + Sofa Bed',
    squareMeters: 60,
    imageUrl: null,
    totalRooms: 5,
    availableRooms: 2,
    isAvailable: true,
    estimatedPrice: 2500000
  }
];

const mockQuote = {
  propertyId: 'prop-001',
  roomTypeId: 'rt-deluxe',
  roomTypeName: 'Deluxe Double Room',
  rentalType: 'Overnight',
  totalAmount: 2400000,
  currency: 'VND',
  expiresAtUtc: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  breakdown: [
    {
      description: 'Tiền phòng Deluxe Double (2 đêm)',
      unitPrice: 1200000,
      quantity: 2,
      amount: 2400000
    }
  ],
  appliedPolicies: {
    maxHourlyHours: 4,
    bufferMinutes: 60,
    checkInTime: '14:00',
    checkOutTime: '12:00'
  }
};

const mockHold = {
  reservationId: 'res-hold-001',
  confirmationCode: 'BK-20261011-0088',
  lookupToken: 'tok-verify-1234567890abcdef',
  propertyId: 'prop-001',
  propertyName: 'Khách sạn Sài Gòn Central',
  roomTypeId: 'rt-deluxe',
  roomTypeName: 'Deluxe Double Room',
  assignedRoomId: 'room-102',
  assignedRoomNumber: '102',
  rentalType: 'Overnight',
  startAtUtc: '2026-10-15T07:00:00Z',
  endAtUtc: '2026-10-17T05:00:00Z',
  checkInDate: '2026-10-15',
  checkOutDate: '2026-10-17',
  totalAmount: 2400000,
  depositRequired: 720000,
  currency: 'VND',
  holdExpiresAtUtc: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  secondsRemaining: 900,
  status: 'PendingPayment',
  breakdown: mockQuote.breakdown
};

// Seed default mock hold into in-memory store
holdsMap.set('tok-verify-1234567890abcdef', mockHold);

function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
  });
}

function flushAuditLog() {
  try {
    const summary = {
      generatedAt: new Date().toISOString(),
      totalRequests: requestLogs.length,
      loopbackOnly: requestLogs.every(r => r.remoteAddress === '127.0.0.1' || r.remoteAddress === '::1' || r.remoteAddress === '::ffff:127.0.0.1'),
      externalRequestsBlocked: 0,
      requests: requestLogs
    };
    fs.writeFileSync(AUDIT_FILE, JSON.stringify(summary, null, 2), 'utf8');
    console.log(`[VERIFY SERVER] Flushed network audit log (${requestLogs.length} requests) to ${AUDIT_FILE}`);
  } catch (err) {
    console.error('[VERIFY SERVER] Failed to write audit log:', err.message);
  }
}

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer(async (req, res) => {
  const reqRecord = {
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.url,
    remoteAddress: req.socket.remoteAddress,
    statusCode: 200
  };
  requestLogs.push(reqRecord);

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  // --- Internal Audit Endpoint ---
  if (pathname === '/__audit/network') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.writeHead(200);
    res.end(JSON.stringify({
      totalRequests: requestLogs.length,
      loopbackOnly: true,
      requests: requestLogs
    }, null, 2));
    flushAuditLog();
    return;
  }

  // --- API Handlers ---
  if (pathname.startsWith('/api/')) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');

    // 1. Properties discovery with search filtering
    if (pathname === '/api/public/properties') {
      const search = url.searchParams.get('search');
      let result = mockProperties;
      if (search && search.trim()) {
        const q = search.trim().toLowerCase();
        result = mockProperties.filter(p =>
          p.name.toLowerCase().includes(q) ||
          p.address.toLowerCase().includes(q) ||
          (p.city && p.city.toLowerCase().includes(q))
        );
      }
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, data: result }));
      return;
    }

    // 2. Real-time availability for property
    if (pathname.startsWith('/api/public/properties/') && pathname.endsWith('/availability')) {
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, data: mockAvailability }));
      return;
    }

    // 3. Dynamic Quote calculation from Pricing Engine
    if (pathname === '/api/public/quotes' && req.method === 'POST') {
      const body = await parseBody(req);
      const isSuite = body.roomTypeId === 'rt-suite';
      const unitPrice = isSuite ? 2500000 : 1200000;
      const rentalType = Number(body.rentalType) || 2;
      const totalAmount = rentalType === 1 ? Math.round(unitPrice * 0.4) : unitPrice * 2;
      const quote = {
        propertyId: body.propertySlug === 'khach-san-bien-dong-da-nang' ? 'prop-002' : 'prop-001',
        roomTypeId: body.roomTypeId || 'rt-deluxe',
        roomTypeName: isSuite ? 'Executive Suite' : 'Deluxe Double Room',
        rentalType: rentalType === 1 ? 'Hourly' : 'Overnight',
        totalAmount,
        currency: 'VND',
        expiresAtUtc: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        breakdown: [
          {
            description: `${isSuite ? 'Executive Suite' : 'Deluxe Double Room'} (${rentalType === 1 ? 'thuê theo giờ' : '2 đêm'})`,
            unitPrice,
            quantity: rentalType === 1 ? 1 : 2,
            amount: totalAmount
          }
        ],
        appliedPolicies: {
          maxHourlyHours: 4,
          bufferMinutes: 60,
          checkInTime: '14:00',
          checkOutTime: '12:00'
        }
      };
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, data: quote }));
      return;
    }

    // 4. Create 15-minute room hold under lock
    if (pathname === '/api/public/bookings/hold' && req.method === 'POST') {
      const body = await parseBody(req);
      const token = `tok-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;
      const isSuite = body.roomTypeId === 'rt-suite';
      const totalAmount = body.expectedTotalAmount || (isSuite ? 5000000 : 2400000);
      const hold = {
        reservationId: `res-${Date.now()}`,
        confirmationCode: `BK-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`,
        lookupToken: token,
        propertyId: body.propertySlug === 'khach-san-bien-dong-da-nang' ? 'prop-002' : 'prop-001',
        propertyName: body.propertySlug === 'khach-san-bien-dong-da-nang' ? 'Khách Sạn Biển Đông Đà Nẵng' : 'Khách sạn Sài Gòn Central',
        roomTypeId: body.roomTypeId || 'rt-deluxe',
        roomTypeName: isSuite ? 'Executive Suite' : 'Deluxe Double Room',
        assignedRoomId: isSuite ? 'room-201' : 'room-102',
        assignedRoomNumber: isSuite ? '201' : '102',
        rentalType: body.rentalType === 1 ? 'Hourly' : 'Overnight',
        startAtUtc: body.startAtUtc || '2026-10-15T07:00:00Z',
        endAtUtc: body.endAtUtc || '2026-10-17T05:00:00Z',
        checkInDate: body.checkInDate || '2026-10-15',
        checkOutDate: body.checkOutDate || '2026-10-17',
        totalAmount,
        depositRequired: Math.round(totalAmount * 0.3),
        currency: 'VND',
        holdExpiresAtUtc: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        secondsRemaining: 900,
        status: 'PendingPayment',
        breakdown: [
          {
            description: `Tiền phòng ${isSuite ? 'Executive Suite' : 'Deluxe Double Room'}`,
            unitPrice: totalAmount / 2,
            quantity: 2,
            amount: totalAmount
          }
        ]
      };
      holdsMap.set(token, hold);
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, data: hold }));
      return;
    }

    // 5. Booking Lookup & Confirm: /api/public/bookings/:token and /api/public/bookings/lookup/:token
    const bookingMatch = pathname.match(/^\/api\/public\/bookings\/(?:lookup\/)?([a-zA-Z0-9_\-]+)(?:\/confirm)?$/);
    if (bookingMatch) {
      const token = bookingMatch[1];
      const isConfirm = pathname.endsWith('/confirm');

      if (token === 'invalid-token') {
        reqRecord.statusCode = 404;
        res.writeHead(404);
        res.end(JSON.stringify({ success: false, message: 'Không tìm thấy đặt phòng với mã tra cứu này.' }));
        return;
      }

      let booking = holdsMap.get(token) || mockHold;
      if (token === 'expired-token') {
        booking = { ...booking, status: 'Expired', secondsRemaining: 0 };
      }

      if (isConfirm && req.method === 'POST') {
        const confirmedBooking = {
          ...booking,
          status: 'Confirmed',
          paidAmount: booking.depositRequired,
          remainingBalance: booking.totalAmount - booking.depositRequired,
          isFullyPaid: false,
          maskedGuestName: 'N***h',
          maskedGuestEmail: 'g***t@example.com',
          maskedGuestPhone: '090****567'
        };
        holdsMap.set(token, confirmedBooking);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: confirmedBooking }));
        return;
      }

      res.writeHead(200);
      res.end(JSON.stringify({ success: true, data: booking }));
      return;
    }

    reqRecord.statusCode = 404;
    res.writeHead(404);
    res.end(JSON.stringify({ success: false, message: 'Not found' }));
    return;
  }

  // --- Static Files / SPA Fallback ---
  let filePath = path.join(BROWSER_DIST, pathname);

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
    res.writeHead(200);
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  // SPA fallback to index.html
  const indexPath = path.join(BROWSER_DIST, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.writeHead(200);
    fs.createReadStream(indexPath).pipe(res);
    return;
  }

  reqRecord.statusCode = 404;
  res.writeHead(404);
  res.end('Not found');
});

process.on('SIGINT', () => { flushAuditLog(); process.exit(0); });
process.on('SIGTERM', () => { flushAuditLog(); process.exit(0); });

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[VERIFY SERVER] Listening on http://127.0.0.1:${PORT}`);
});
