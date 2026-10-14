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
   * Bộ sưu tập ảnh khách sạn & phòng nghỉ độ phân giải cao đã được tối ưu tốc độ tải.
   * Sử dụng ảnh chất lượng cao chuyên về kiến trúc & nội thất khách sạn sang trọng.
   */
  private readonly defaultGalleries: Record<string, RoomPhoto[]> = {
    DELUXE: [
      {
        url: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80',
        title: 'Phòng ngủ Deluxe King với nệm cao cấp & ánh sáng tự nhiên',
        category: 'Phòng ngủ'
      },
      {
        url: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=1200&q=80',
        title: 'Phòng tắm sang trọng lát đá hoa cương & bồn tắm nằm',
        category: 'Phòng tắm'
      },
      {
        url: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80',
        title: 'Góc nhìn thoáng đãng và ban công ngắm toàn cảnh',
        category: 'Ban công / View'
      },
      {
        url: 'https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?auto=format&fit=crop&w=1200&q=80',
        title: 'Bàn làm việc doanh nhân & minibar đồ uống chọn lọc',
        category: 'Tiện nghi'
      }
    ],
    SUITE: [
      {
        url: 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1200&q=80',
        title: 'Phòng khách Suite thượng lưu với sofa da và cửa sổ kính tràn',
        category: 'Không gian'
      },
      {
        url: 'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=1200&q=80',
        title: 'Phòng ngủ chính Master King giường cỡ lớn phong cách hoàng gia',
        category: 'Phòng ngủ'
      },
      {
        url: 'https://images.unsplash.com/photo-1507652313519-d4e9174996dd?auto=format&fit=crop&w=1200&q=80',
        title: 'Bồn tắm sục Jacuzzi đôi view biển lãng mạn',
        category: 'Phòng tắm'
      },
      {
        url: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80',
        title: 'Ban công riêng biệt ngắm hoàng hôn & bình minh',
        category: 'Ban công / View'
      }
    ],
    FAMILY: [
      {
        url: 'https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=1200&q=80',
        title: 'Phòng gia đình ấm cúng với 2 giường lớn thoải mái',
        category: 'Phòng ngủ'
      },
      {
        url: 'https://images.unsplash.com/photo-1591088398332-8a7791972843?auto=format&fit=crop&w=1200&q=80',
        title: 'Khu vực sinh hoạt chung rộng rãi dành cho gia đình',
        category: 'Không gian'
      },
      {
        url: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=1200&q=80',
        title: 'Phòng tắm tiện nghi với buồng tắm đứng vòi sen nhiệt đới',
        category: 'Phòng tắm'
      },
      {
        url: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=1200&q=80',
        title: 'Khuôn viên xanh mát và tiện ích giải trí liền kề',
        category: 'Ban công / View'
      }
    ],
    STANDARD: [
      {
        url: 'https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=1200&q=80',
        title: 'Phòng tiêu chuẩn tinh tế, sạch sẽ và tối ưu công năng',
        category: 'Phòng ngủ'
      },
      {
        url: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=1200&q=80',
        title: 'Phòng tắm khép kín hiện đại với trang bị đầy đủ',
        category: 'Phòng tắm'
      },
      {
        url: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80',
        title: 'Cửa sổ đón nắng mai và view thành phố sinh động',
        category: 'Ban công / View'
      }
    ]
  };

  /**
   * Lấy danh sách ảnh đầy đủ cho một loại phòng.
   * Nếu phòng đã có ảnh imageUrl từ backend, đặt ảnh đó lên đầu tiên.
   */
  getRoomGallery(roomTypeName: string, existingImageUrl?: string | null): RoomPhoto[] {
    const norm = (roomTypeName || '').toUpperCase();
    let templateKey = 'STANDARD';

    if (norm.includes('SUITE') || norm.includes('VIP') || norm.includes('PRESIDENTIAL')) {
      templateKey = 'SUITE';
    } else if (norm.includes('DELUXE') || norm.includes('PREMIER') || norm.includes('EXECUTIVE')) {
      templateKey = 'DELUXE';
    } else if (norm.includes('FAMILY') || norm.includes('GIA ĐÌNH') || norm.includes('TWIN')) {
      templateKey = 'FAMILY';
    }

    const templatePhotos = [...(this.defaultGalleries[templateKey] || this.defaultGalleries['STANDARD'])];

    // Nếu phòng có ảnh cụ thể từ hệ thống, đưa ảnh đó thành ảnh đại diện đầu tiên
    if (existingImageUrl && existingImageUrl.startsWith('http')) {
      return [
        {
          url: existingImageUrl,
          title: `${roomTypeName} — Không gian chính`,
          category: 'Phòng ngủ'
        },
        ...templatePhotos.slice(1)
      ];
    }

    return templatePhotos;
  }

  /**
   * Lấy danh sách tiện nghi chi tiết theo loại phòng.
   */
  getRoomAmenities(roomTypeName: string): RoomAmenityItem[] {
    const norm = (roomTypeName || '').toUpperCase();
    const isLuxury = norm.includes('SUITE') || norm.includes('VIP') || norm.includes('DELUXE');

    const baseAmenities: RoomAmenityItem[] = [
      { name: 'Wifi 6 tốc độ cao miễn phí', icon: 'pi pi-wifi', category: 'Công nghệ' },
      { name: 'Điều hòa 2 chiều êm ái', icon: 'pi pi-sun', category: 'Phòng ngủ' },
      { name: 'Smart TV 4K có Netflix & Youtube', icon: 'pi pi-desktop', category: 'Công nghệ' },
      { name: 'Bình đun siêu tốc & bộ ấm trà cao cấp', icon: 'pi pi-coffee', category: 'Dịch vụ' },
      { name: 'Nước suối khoáng & trà/cà phê đón tiếp', icon: 'pi pi-heart', category: 'Dịch vụ' },
      { name: 'Máy sấy tóc ion âm & gương trang điểm LED', icon: 'pi pi-sparkles', category: 'Phòng tắm' },
      { name: 'Bộ vệ sinh cá nhân thân thiện môi trường', icon: 'pi pi-check', category: 'Phòng tắm' },
      { name: 'Két sắt điện tử chống trộm', icon: 'pi pi-shield', category: 'Phòng ngủ' }
    ];

    if (isLuxury) {
      baseAmenities.unshift(
        { name: 'Bồn tắm nằm ngâm mình sang trọng', icon: 'pi pi-heart-fill', category: 'Phòng tắm' },
        { name: 'Ban công riêng ngắm cảnh view panorama', icon: 'pi pi-compass', category: 'Phòng ngủ' },
        { name: 'Tủ lạnh minibar đồ uống cao cấp', icon: 'pi pi-shopping-bag', category: 'Dịch vụ' },
        { name: 'Áo choàng tắm sợi tre êm ái & dép nhung', icon: 'pi pi-star', category: 'Phòng tắm' }
      );
    }

    return baseAmenities;
  }
}
