const http = require('http');

const PORT = 5283;

// --- Synthetic In-Memory Fixtures (Reproducible Evidence) ---
const mockProperty = {
  id: 'prop-001',
  name: 'Khách sạn Sài Gòn Central',
  code: 'SGC',
  slug: 'khach-san-sai-gon-central',
  address: '123 Lê Lợi, Phường Bến Thành, Quận 1, TP. Hồ Chí Minh',
  city: 'TP. Hồ Chí Minh',
  phone: '028 3822 9999',
  email: 'contact@saigoncentral.local',
  checkInTime: '14:00',
  checkOutTime: '12:00',
  bufferMinutes: 60,
  maxHourlyHours: 4,
  imageUrl: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80',
  isActive: true
};

const mockRoomTypes = [
  {
    id: 'rt-deluxe',
    propertyId: 'prop-001',
    name: 'Deluxe Double Room',
    code: 'DLX-DBL',
    description: 'Phòng đôi cao cấp hướng phố, trang bị giường King và bồn tắm sang trọng.',
    basePrice: 1200000,
    maxOccupancy: 3,
    bedType: '1 Giường King đôi',
    squareMeters: 35,
    imageUrl: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 'rt-suite',
    propertyId: 'prop-001',
    name: 'Executive Suite',
    code: 'EXEC-STE',
    description: 'Căn hộ cao cấp tầng thượng, view toàn cảnh thành phố, phòng khách riêng biệt.',
    basePrice: 2500000,
    maxOccupancy: 4,
    bedType: '1 Giường Super King + Sofa',
    squareMeters: 60,
    imageUrl: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80'
  }
];

const mockAvailability = [
  {
    roomTypeId: 'rt-deluxe',
    roomTypeName: 'Deluxe Double Room',
    description: 'Phòng đôi cao cấp hướng phố, trang bị giường King và bồn tắm sang trọng.',
    maxOccupancy: 3,
    bedType: '1 Giường King đôi',
    squareMeters: 35,
    imageUrl: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80',
    totalRooms: 10,
    availableRooms: 6,
    isAvailable: true,
    estimatedPrice: 1200000
  },
  {
    roomTypeId: 'rt-suite',
    roomTypeName: 'Executive Suite',
    description: 'Căn hộ cao cấp tầng thượng, view toàn cảnh thành phố, phòng khách riêng biệt.',
    maxOccupancy: 4,
    bedType: '1 Giường Super King + Sofa',
    squareMeters: 60,
    imageUrl: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80',
    totalRooms: 5,
    availableRooms: 3,
    isAvailable: true,
    estimatedPrice: 2500000
  }
];

// Note: Status aligns strictly with backend ReservationStatus enum (PendingPayment = 1)
const mockHoldBooking = {
  reservationId: 'res-hold-001',
  confirmationCode: 'BK-20261010-0088',
  lookupToken: 'tok-hold-8899aabbccddeeff',
  propertyId: 'prop-001',
  propertyName: 'Khách sạn Sài Gòn Central',
  propertyAddress: '123 Lê Lợi, Phường Bến Thành, Quận 1, TP. Hồ Chí Minh',
  roomTypeName: 'Deluxe Double Room (Phòng Đôi Cao Cấp)',
  rentalType: 'Thuê theo đêm (Overnight)',
  startAtUtc: '2026-10-15T07:00:00Z',
  endAtUtc: '2026-10-17T05:00:00Z',
  checkInDate: '2026-10-15',
  checkOutDate: '2026-10-17',
  numberOfGuests: 2,
  totalAmount: 2400000,
  depositRequired: 720000,
  paidAmount: 0,
  remainingBalance: 2400000,
  isFullyPaid: false,
  status: 'PendingPayment',
  maskedGuestName: 'Ng*** V** A**',
  maskedGuestEmail: 'ng***@gmail.com',
  maskedGuestPhone: '090***678',
  holdExpiresAtUtc: new Date(Date.now() + 13 * 60 * 1000).toISOString(),
  secondsRemaining: 780,
  createdAtUtc: new Date().toISOString(),
  breakdown: [
    {
      description: 'Tiền phòng Deluxe Double (2 đêm)',
      unitPrice: 1200000,
      quantity: 2,
      amount: 2400000
    }
  ]
};

const mockStatusBooking = {
  reservationId: 'res-status-002',
  confirmationCode: 'BK-20261010-0088',
  lookupToken: 'tok-status-1122334455667788',
  propertyId: 'prop-001',
  propertyName: 'Khách sạn Sài Gòn Central',
  propertyAddress: '123 Lê Lợi, Phường Bến Thành, Quận 1, TP. Hồ Chí Minh',
  roomTypeName: 'Deluxe Double Room (Phòng Đôi Cao Cấp)',
  rentalType: 'Thuê theo đêm (Overnight)',
  startAtUtc: '2026-10-15T07:00:00Z',
  endAtUtc: '2026-10-17T05:00:00Z',
  checkInDate: '2026-10-15',
  checkOutDate: '2026-10-17',
  numberOfGuests: 2,
  totalAmount: 2400000,
  depositRequired: 720000,
  paidAmount: 720000,
  remainingBalance: 1680000,
  isFullyPaid: false,
  status: 'Confirmed',
  maskedGuestName: 'Ng*** V** A**',
  maskedGuestEmail: 'ng***@gmail.com',
  maskedGuestPhone: '090***678',
  createdAtUtc: '2026-10-10T08:30:00Z',
  breakdown: [
    {
      description: 'Tiền phòng Deluxe Double (2 đêm)',
      unitPrice: 1200000,
      quantity: 2,
      amount: 2400000
    }
  ]
};

const mockReservationList = [
  {
    id: 'res-001',
    tenantId: 'tenant-001',
    propertyId: 'prop-001',
    roomId: 'room-102',
    roomNumber: '102',
    roomTypeId: 'rt-deluxe',
    roomTypeName: 'Deluxe Double Room',
    rentalType: 2,
    startAtUtc: '2026-10-10T07:00:00Z',
    endAtUtc: '2026-10-12T05:00:00Z',
    checkInDate: '2026-10-10',
    checkOutDate: '2026-10-12',
    guestName: 'Nguyễn Văn An',
    guestEmail: 'an.nguyen@example.com',
    guestPhone: '0901234567',
    numberOfGuests: 2,
    totalAmount: 2400000,
    currency: 'VND',
    status: 3, // CheckedIn
    confirmationCode: 'RES-20261010-0012',
    notes: 'Khách VIP yêu cầu phòng tầng cao yên tĩnh',
    createdAtUtc: '2026-10-10T08:00:00Z'
  }
];

const mockFolio = {
  reservationId: 'res-001',
  confirmationCode: 'RES-20261010-0012',
  guestName: 'Nguyễn Văn An',
  guestEmail: 'an.nguyen@example.com',
  guestPhone: '0901234567',
  roomId: 'room-102',
  roomNumber: '102',
  roomTypeId: 'rt-deluxe',
  roomTypeName: 'Deluxe Double Room',
  status: 3,
  statusName: 'Đang lưu trú',
  rentalType: 2,
  checkInDate: '2026-10-10',
  checkOutDate: '2026-10-12',
  startAtUtc: '2026-10-10T07:00:00Z',
  endAtUtc: '2026-10-12T05:00:00Z',
  totalAmount: 2400000,
  paidAmount: 720000,
  remainingBalance: 1680000,
  isFullyPaid: false,
  payments: [
    {
      id: 'pay-001',
      reservationId: 'res-001',
      amount: 720000,
      currency: 'VND',
      method: 3,
      methodName: 'Chuyển khoản',
      status: 3,
      statusName: 'Thành công',
      transactionRef: '[IK:hold-deposit-20261010][BY:staff-01] Cọc 30% qua Vietcombank',
      notes: 'Xác nhận cọc giữ phòng online',
      createdAtUtc: '2026-10-10T08:35:00Z'
    }
  ]
};

// --- HTTP Server Definition with Strict Route Matching ---
const server = http.createServer((req, res) => {
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
  console.log(`[MOCK API] ${req.method} ${pathname}`);

  res.setHeader('Content-Type', 'application/json');

  // 1. GET /api/public/properties
  if (pathname === '/api/public/properties') {
    res.writeHead(200);
    res.end(JSON.stringify({ success: true, data: [mockProperty] }));
    return;
  }

  // 2. GET /api/public/properties/:slug/room-types
  if (pathname.startsWith('/api/public/properties/') && pathname.endsWith('/room-types')) {
    res.writeHead(200);
    res.end(JSON.stringify({ success: true, data: mockRoomTypes }));
    return;
  }

  // 3. GET /api/public/properties/:slug/availability
  if (pathname.startsWith('/api/public/properties/') && pathname.endsWith('/availability')) {
    res.writeHead(200);
    res.end(JSON.stringify({ success: true, data: mockAvailability }));
    return;
  }

  // 4. GET /api/public/properties/:slug
  if (pathname.startsWith('/api/public/properties/')) {
    res.writeHead(200);
    res.end(JSON.stringify({ success: true, data: mockProperty }));
    return;
  }

  // 5. GET /api/public/bookings/:token
  if (pathname.startsWith('/api/public/bookings/')) {
    const token = pathname.replace('/api/public/bookings/', '').split('/')[0];
    if (token.includes('hold')) {
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, data: mockHoldBooking }));
    } else {
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, data: mockStatusBooking }));
    }
    return;
  }

  // 6. GET /api/properties (Internal staff context)
  if (pathname === '/api/properties') {
    res.writeHead(200);
    res.end(JSON.stringify({ success: true, data: [mockProperty] }));
    return;
  }

  // 7. GET /api/reservations/:id/folio
  if (pathname.match(/^\/api\/reservations\/[^\/]+\/folio$/)) {
    res.writeHead(200);
    res.end(JSON.stringify({ success: true, data: mockFolio }));
    return;
  }

  // 8. GET /api/reservations/:id
  if (pathname.match(/^\/api\/reservations\/[^\/]+$/)) {
    const detail = {
      ...mockReservationList[0],
      breakdown: mockHoldBooking.breakdown,
      appliedPolicies: {
        maxHourlyHours: 4,
        bufferMinutes: 60,
        checkInTime: '14:00',
        checkOutTime: '12:00'
      }
    };
    res.writeHead(200);
    res.end(JSON.stringify({ success: true, data: detail }));
    return;
  }

  // 9. GET /api/reservations (Paginated list)
  if (pathname === '/api/reservations') {
    res.writeHead(200);
    res.end(JSON.stringify({
      success: true,
      data: {
        items: mockReservationList,
        totalCount: 1,
        page: 1,
        pageSize: 20,
        totalPages: 1,
        hasPreviousPage: false,
        hasNextPage: false
      }
    }));
    return;
  }

  // 10. GET /api/auth/me/memberships
  if (pathname === '/api/auth/me/memberships') {
    res.writeHead(200);
    res.end(JSON.stringify({
      success: true,
      data: [{
        propertyId: 'prop-001',
        propertyName: 'Khách sạn Sài Gòn Central',
        propertyCode: 'SGC',
        roleName: 'Lễ tân trưởng',
        isTenantWide: false
      }]
    }));
    return;
  }

  // 11. GET /api/room-types
  if (pathname === '/api/room-types') {
    res.writeHead(200);
    res.end(JSON.stringify({ success: true, data: mockRoomTypes }));
    return;
  }

  // Fail-closed fallback: 404 Not Found for any unmatched route
  res.writeHead(404);
  res.end(JSON.stringify({ success: false, message: 'Unmatched route in fixture server' }));
});

if (require.main === module) {
  server.listen(PORT, '127.0.0.1', () => {
    console.log(`[MOCK API] In-memory fixture server listening on http://127.0.0.1:${PORT}`);
  });
}

module.exports = { server, mockHoldBooking, mockStatusBooking, mockReservationList, mockFolio };
