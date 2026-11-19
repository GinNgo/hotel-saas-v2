import { Injectable } from '@angular/core';

export interface RoomPhoto {
  readonly url: string;
  readonly title: string;
  readonly category: 'Phòng ngủ' | 'Phòng tắm' | 'Ban công / View' | 'Tiện nghi' | 'Không gian';
}

export interface RoomAmenityItem {
  readonly name: string;
  readonly icon: string;
  readonly category: 'Phòng ngủ' | 'Phòng tắm' | 'Công nghệ' | 'Dịch vụ';
}

@Injectable({
  providedIn: 'root'
})
export class RoomGalleryService {
  /**
   * Trả về danh sách ảnh thực tế đã được cấu hình từ hệ thống (không chèn ảnh stock minh họa).
   */
  getRoomGallery(roomTypeName: string, existingImageUrl?: string | null): RoomPhoto[] {
    if (!existingImageUrl) return [];
    const trimmed = existingImageUrl.trim();
    if (!trimmed) return [];

    const lower = trimmed.toLowerCase();
    if (lower.includes('placeholder') || lower.includes('images.unsplash.com')) {
      return [];
    }

    if (!trimmed.startsWith('http') && !trimmed.startsWith('/')) {
      return [];
    }

    return [
      {
        url: trimmed,
        title: `${roomTypeName || 'Hạng phòng'} — Hình ảnh thực tế`,
        category: 'Phòng ngủ'
      }
    ];
  }

  /**
   * Chỉ trả về tiện nghi khi hệ thống có dữ liệu thực tế; không tự suy diễn tiện nghi mẫu.
   */
  getRoomAmenities(_roomTypeName: string): RoomAmenityItem[] {
    return [];
  }
}
