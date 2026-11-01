/**
 * Tiện ích chuẩn hóa và phân giải hình ảnh cơ sở khách sạn, phòng nghỉ và bộ sưu tập ảnh (Gallery).
 * Tự động gắn ảnh chất lượng cao dựa theo địa danh (Đà Lạt, Đà Nẵng, Hà Nội, Nha Trang, Sài Gòn)
 * và phân hạng phòng (Deluxe, Suite, Family, Penthouse, Standard) khi dữ liệu gốc chưa có ảnh.
 */

export function resolvePropertyThumbnail(name?: string, address?: string, currentUrl?: string | null): string {
  if (currentUrl && currentUrl.trim().length > 0 && !currentUrl.includes('placeholder')) {
    return currentUrl.trim();
  }

  const text = `${name || ''} ${address || ''}`.toLowerCase();

  if (text.includes('đà lạt') || text.includes('da lat') || text.includes('dalat') || text.includes('lâm đồng') || text.includes('pine')) {
    return '/images/dalat-pine-resort.png';
  }
  if (text.includes('đà nẵng') || text.includes('da nang') || text.includes('danang') || text.includes('ocean')) {
    return '/images/danang-ocean-suites.png';
  }
  if (text.includes('hà nội') || text.includes('ha noi') || text.includes('hanoi') || text.includes('hoàn kiếm') || text.includes('old quarter')) {
    return '/images/hanoi-old-quarter-hotel.png';
  }
  if (text.includes('nha trang') || text.includes('khánh hòa') || text.includes('khanh hoa')) {
    return '/images/nhatrang-grand-hotel.png';
  }
  if (text.includes('sài gòn') || text.includes('sai gon') || text.includes('saigon') || text.includes('hồ chí minh') || text.includes('riverside')) {
    return '/images/saigon-riverside-tower.png';
  }

  return '/images/danang-ocean-suites.png';
}

export function resolveRoomThumbnail(roomName?: string, index: number = 0, currentUrl?: string | null): string {
  if (currentUrl && currentUrl.trim().length > 0 && !currentUrl.includes('placeholder')) {
    return currentUrl.trim();
  }

  const name = (roomName || '').toLowerCase();

  if (name.includes('executive') || name.includes('river')) {
    return '/images/executive-suite-river.png';
  }
  if (name.includes('family') || name.includes('ocean') || name.includes('gia đình')) {
    return '/images/family-ocean-suite.png';
  }
  if (name.includes('president') || name.includes('penthouse') || name.includes('tổng thống') || name.includes('vip')) {
    return '/images/presidential-penthouse.png';
  }
  if (name.includes('standard') || name.includes('twin') || name.includes('đơn') || name.includes('heritage')) {
    return '/images/standard-twin-heritage.png';
  }
  if (name.includes('deluxe') || name.includes('double') || name.includes('đôi') || name.includes('pine')) {
    return '/images/deluxe-double-pine.png';
  }

  const fallbacks = [
    '/images/deluxe-double-pine.png',
    '/images/executive-suite-river.png',
    '/images/family-ocean-suite.png',
    '/images/standard-twin-heritage.png',
    '/images/presidential-penthouse.png'
  ];

  return fallbacks[Math.abs(index) % fallbacks.length];
}

export function resolvePropertyGallery(name?: string, currentUrl?: string | null, existingGallery?: string[] | null): string[] {
  const result: string[] = [];

  const mainThumb = resolvePropertyThumbnail(name, undefined, currentUrl);
  result.push(mainThumb);

  if (existingGallery && existingGallery.length > 0) {
    for (const g of existingGallery) {
      if (g && g.trim().length > 0 && !result.includes(g.trim())) {
        result.push(g.trim());
      }
    }
  }

  const roomVisuals = [
    '/images/deluxe-double-pine.png',
    '/images/executive-suite-river.png',
    '/images/family-ocean-suite.png',
    '/images/presidential-penthouse.png',
    '/images/standard-twin-heritage.png'
  ];

  for (const visual of roomVisuals) {
    if (result.length >= 5) break;
    if (!result.includes(visual)) {
      result.push(visual);
    }
  }

  return result;
}
