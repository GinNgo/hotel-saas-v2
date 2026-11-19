/**
 * Tiện ích chuẩn hóa và kiểm chứng URL hình ảnh thật cho cơ sở lưu trú và hạng phòng.
 * Tuyệt đối không tự bịa hoặc chèn ảnh mẫu (stock/placeholder) khi dữ liệu gốc chưa có ảnh.
 */

function isVerifiedImageUrl(url?: string | null): url is string {
  if (!url) return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();
  return !lower.includes('placeholder') && !lower.includes('images.unsplash.com');
}

export function resolvePropertyThumbnail(
  _name?: string,
  _address?: string,
  currentUrl?: string | null
): string {
  return isVerifiedImageUrl(currentUrl) ? currentUrl.trim() : '';
}

export function resolveRoomThumbnail(
  _roomName?: string,
  _index: number = 0,
  currentUrl?: string | null
): string {
  return isVerifiedImageUrl(currentUrl) ? currentUrl.trim() : '';
}

export function resolvePropertyGallery(
  _name?: string,
  currentUrl?: string | null,
  existingGallery?: string[] | null
): string[] {
  const result: string[] = [];

  if (isVerifiedImageUrl(currentUrl)) {
    result.push(currentUrl.trim());
  }

  if (existingGallery && existingGallery.length > 0) {
    for (const g of existingGallery) {
      if (isVerifiedImageUrl(g)) {
        const trimmed = g.trim();
        if (!result.includes(trimmed)) {
          result.push(trimmed);
        }
      }
    }
  }

  return result;
}
