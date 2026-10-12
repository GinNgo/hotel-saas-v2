const http = require('http');

const PORT = 5283;

function normalizeVn(str) {
  if (!str) return '';
  return str.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .trim();
}

// Multi-property synthetic dataset for search testing
const mockProperties = [
  {
    id: 'prop-001',
    name: 'Khách Sạn Sài Gòn Central',
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
  },
  {
    id: 'prop-002',
    name: 'Khách Sạn Biển Đông Đà Nẵng',
    code: 'BDD',
    slug: 'khach-san-bien-dong-da-nang',
    address: '200 Võ Nguyên Giáp, Phường Phước Mỹ, Quận Sơn Trà, Đà Nẵng',
    city: 'Đà Nẵng',
    phone: '0236 3999 888',
    email: 'contact@biendongdanang.local',
    checkInTime: '14:00',
    checkOutTime: '12:00',
    bufferMinutes: 30,
    maxHourlyHours: 6,
    imageUrl: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=800&q=80',
    isActive: true
  },
  {
    id: 'prop-003',
    name: 'Hà Nội Grand Boutique Hotel',
    code: 'HNG',
    slug: 'ha-noi-grand-boutique-hotel',
    address: '45 Hàng Trống, Phường Hàng Trống, Quận Hoàn Kiếm, Hà Nội',
    city: 'Hà Nội',
    phone: '024 3828 7777',
    email: 'contact@hanoigrand.local',
    checkInTime: '14:00',
    checkOutTime: '12:00',
    bufferMinutes: 45,
    maxHourlyHours: 4,
    imageUrl: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=800&q=80',
    isActive: true
  }
];

const mockAvailabilityBySlug = {
  'khach-san-sai-gon-central': [
    {
      roomTypeId: 'rt-sgc-deluxe',
      roomTypeName: 'Deluxe Double Room (Sài Gòn)',
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
      roomTypeId: 'rt-sgc-suite',
      roomTypeName: 'Executive Suite (Sài Gòn)',
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
  ],
  'khach-san-bien-dong-da-nang': [
    {
      roomTypeId: 'rt-bdd-ocean',
      roomTypeName: 'Ocean Front Suite (Đà Nẵng)',
      description: 'Phòng ban công hướng biển Mỹ Khê, ngắm bình minh tuyệt đẹp.',
      maxOccupancy: 2,
      bedType: '1 Giường Queen',
      squareMeters: 40,
      imageUrl: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80',
      totalRooms: 8,
      availableRooms: 4,
      isAvailable: true,
      estimatedPrice: 1500000
    }
  ],
  'ha-noi-grand-boutique-hotel': [
    {
      roomTypeId: 'rt-hng-classic',
      roomTypeName: 'Classic Heritage Room (Hà Nội)',
      description: 'Phong cách Indochine cổ điển, view phố cổ Hoàn Kiếm yên bình.',
      maxOccupancy: 2,
      bedType: '1 Giường King',
      squareMeters: 32,
      imageUrl: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80',
      totalRooms: 6,
      availableRooms: 2,
      isAvailable: true,
      estimatedPrice: 1100000
    }
  ]
};

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
  const searchParam = url.searchParams.get('search');
  console.log(`[FIXTURE-SEARCH-API] ${req.method} ${pathname} ${searchParam ? `(search="${searchParam}")` : ''}`);

  res.setHeader('Content-Type', 'application/json');

  // 1. GET /api/public/properties with search query support
  if (pathname === '/api/public/properties') {
    if (searchParam === 'trigger-error') {
      res.writeHead(500);
      res.end(JSON.stringify({ success: false, message: 'Lỗi máy chủ mô phỏng khi tìm kiếm cơ sở lưu trú.' }));
      return;
    }

    let result = mockProperties;
    if (searchParam && searchParam.trim().length > 0) {
      const qNorm = normalizeVn(searchParam);
      result = mockProperties.filter(p =>
        normalizeVn(p.name).includes(qNorm) ||
        normalizeVn(p.address).includes(qNorm) ||
        normalizeVn(p.city).includes(qNorm)
      );
    }

    res.writeHead(200);
    res.end(JSON.stringify({ success: true, data: result }));
    return;
  }

  // 2. GET /api/public/properties/:slug/availability
  if (pathname.startsWith('/api/public/properties/') && pathname.endsWith('/availability')) {
    const parts = pathname.split('/');
    const slug = parts[4];
    const avail = mockAvailabilityBySlug[slug] || [];
    res.writeHead(200);
    res.end(JSON.stringify({ success: true, data: avail }));
    return;
  }

  // 3. GET /api/public/properties/:slug
  if (pathname.startsWith('/api/public/properties/')) {
    const slug = pathname.replace('/api/public/properties/', '').split('/')[0];
    const prop = mockProperties.find(p => p.slug === slug) || mockProperties[0];
    res.writeHead(200);
    res.end(JSON.stringify({ success: true, data: prop }));
    return;
  }

  // 4. POST /api/public/quotes
  if (pathname === '/api/public/quotes') {
    res.writeHead(200);
    res.end(JSON.stringify({
      success: true,
      data: {
        totalAmount: 1200000,
        currency: 'VND',
        breakdown: [
          { description: 'Tiền phòng 1 đêm', unitPrice: 1200000, quantity: 1, amount: 1200000 }
        ],
        appliedPolicies: {
          maxHourlyHours: 4,
          bufferMinutes: 60,
          checkInTime: '14:00',
          checkOutTime: '12:00'
        }
      }
    }));
    return;
  }

  // Fail-closed fallback: 404 Not Found for any unmatched route
  res.writeHead(404);
  res.end(JSON.stringify({ success: false, message: 'Unmatched route in search fixture server' }));
});

if (require.main === module) {
  server.listen(PORT, '127.0.0.1', () => {
    console.log(`[FIXTURE-SEARCH-API] In-memory search fixture server listening on http://127.0.0.1:${PORT}`);
  });
}

module.exports = { server, mockProperties };
