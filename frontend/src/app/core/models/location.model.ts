export interface Province {
  code: string;
  name: string;
  type: string;
}

export interface Ward {
  code: string;
  name: string;
  type: string;
  provinceCode: string;
  provinceName: string;
}

export interface LocationGeoCoordinates {
  latitude: number;
  longitude: number;
  formattedAddress?: string;
}

/**
 * Danh mục chuẩn 34 Tỉnh / Thành phố trực thuộc Trung ương của Việt Nam
 * Theo Nghị quyết / Quyết định số 19/2025/QĐ-TTg (mô hình chính quyền 2 cấp).
 */
export const VIETNAM_34_ADMIN_PROVINCES: readonly Province[] = [
  { code: '01', name: 'Thành phố Hà Nội', type: 'thành phố trung ương' },
  { code: '04', name: 'Tỉnh Cao Bằng', type: 'tỉnh' },
  { code: '08', name: 'Tỉnh Tuyên Quang', type: 'tỉnh' },
  { code: '11', name: 'Tỉnh Điện Biên', type: 'tỉnh' },
  { code: '12', name: 'Tỉnh Lai Châu', type: 'tỉnh' },
  { code: '14', name: 'Tỉnh Sơn La', type: 'tỉnh' },
  { code: '15', name: 'Tỉnh Lào Cai', type: 'tỉnh' },
  { code: '19', name: 'Tỉnh Thái Nguyên', type: 'tỉnh' },
  { code: '20', name: 'Tỉnh Lạng Sơn', type: 'tỉnh' },
  { code: '22', name: 'Tỉnh Quảng Ninh', type: 'tỉnh' },
  { code: '24', name: 'Tỉnh Bắc Ninh', type: 'tỉnh' },
  { code: '25', name: 'Tỉnh Phú Thọ', type: 'tỉnh' },
  { code: '31', name: 'Thành phố Hải Phòng', type: 'thành phố trung ương' },
  { code: '33', name: 'Tỉnh Hưng Yên', type: 'tỉnh' },
  { code: '37', name: 'Tỉnh Ninh Bình', type: 'tỉnh' },
  { code: '38', name: 'Tỉnh Thanh Hóa', type: 'tỉnh' },
  { code: '40', name: 'Tỉnh Nghệ An', type: 'tỉnh' },
  { code: '42', name: 'Tỉnh Hà Tĩnh', type: 'tỉnh' },
  { code: '44', name: 'Tỉnh Quảng Trị', type: 'tỉnh' },
  { code: '46', name: 'Thành phố Huế', type: 'thành phố trung ương' },
  { code: '48', name: 'Thành phố Đà Nẵng', type: 'thành phố trung ương' },
  { code: '51', name: 'Tỉnh Quảng Ngãi', type: 'tỉnh' },
  { code: '52', name: 'Tỉnh Gia Lai', type: 'tỉnh' },
  { code: '56', name: 'Tỉnh Khánh Hòa', type: 'tỉnh' },
  { code: '66', name: 'Tỉnh Đắk Lắk', type: 'tỉnh' },
  { code: '68', name: 'Tỉnh Lâm Đồng', type: 'tỉnh' },
  { code: '75', name: 'Tỉnh Đồng Nai', type: 'tỉnh' },
  { code: '79', name: 'Thành phố Hồ Chí Minh', type: 'thành phố trung ương' },
  { code: '80', name: 'Tỉnh Tây Ninh', type: 'tỉnh' },
  { code: '82', name: 'Tỉnh Đồng Tháp', type: 'tỉnh' },
  { code: '86', name: 'Tỉnh Vĩnh Long', type: 'tỉnh' },
  { code: '91', name: 'Tỉnh An Giang', type: 'tỉnh' },
  { code: '92', name: 'Thành phố Cần Thơ', type: 'thành phố trung ương' },
  { code: '96', name: 'Tỉnh Cà Mau', type: 'tỉnh' }
];

/** @deprecated Use VIETNAM_34_ADMIN_PROVINCES instead. */
export const VIETNAM_63_PROVINCES = VIETNAM_34_ADMIN_PROVINCES;

/**
 * Hàm chuẩn hóa chuỗi tiếng Việt: loại bỏ dấu thanh, chuyển về chữ thường
 * Hỗ trợ tìm kiếm mượt mà không phân biệt dấu tiếng Việt (vd: "da nang" -> "Đà Nẵng").
 */
export function removeVietnameseAccents(str: string): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}
