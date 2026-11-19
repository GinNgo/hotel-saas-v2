import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, map, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Province, Ward, VIETNAM_34_ADMIN_PROVINCES, removeVietnameseAccents } from '../models/location.model';
import { ApiResponse } from '../models/api-response.model';
import { ReverseGeocodeInfo } from '../models/public-booking.model';

@Injectable({
  providedIn: 'root'
})
export class LocationService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/locations`;

  /**
   * Lấy danh sách toàn bộ 34 Tỉnh / Thành phố Việt Nam (mô hình hành chính 2 cấp).
   * Luôn đảm bảo đủ 34 đơn vị hành chính và sắp xếp theo bảng chữ cái tiếng Việt.
   */
  getProvinces(): Observable<Province[]> {
    return this.http.get<ApiResponse<Province[]>>(`${this.apiUrl}/provinces`).pipe(
      map(res => {
        const list = res.data && res.data.length > 0 ? res.data : [...VIETNAM_34_ADMIN_PROVINCES];
        return this.sortProvincesAlphabetical(list);
      }),
      catchError(() => {
        // Fallback tức thì nếu kết nối mạng chậm hoặc backend offline
        return of(this.sortProvincesAlphabetical([...VIETNAM_34_ADMIN_PROVINCES]));
      })
    );
  }

  /**
   * Lấy danh sách Phường/Xã trực thuộc Tỉnh/Thành phố theo mã.
   */
  getWards(provinceCode: string): Observable<Ward[]> {
    if (!provinceCode) {
      return of([]);
    }
    const cleanCode = provinceCode.trim();
    return this.http.get<ApiResponse<Ward[]>>(`${this.apiUrl}/provinces/${cleanCode}/wards`).pipe(
      map(res => {
        const list = res.data || [];
        return list.slice().sort((a, b) => a.name.localeCompare(b.name, 'vi'));
      }),
      catchError(() => of([]))
    );
  }

  /**
   * Giải mã tọa độ GPS (lat, lng) thành địa danh / khu du lịch / tỉnh thành gần nhất.
   */
  reverseGeocode(lat: number, lng: number): Observable<ReverseGeocodeInfo | null> {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return of(null);
    }
    const params = new HttpParams()
      .set('lat', lat.toString())
      .set('lng', lng.toString());
    return this.http.get<ApiResponse<ReverseGeocodeInfo>>(`${this.apiUrl}/reverse`, { params }).pipe(
      map(res => res?.data ?? null),
      catchError(() => of(null))
    );
  }

  /**
   * Tìm kiếm Tỉnh/Thành phố theo từ khóa (hỗ trợ cả có dấu và không dấu).
   */
  findProvinceByKeyword(keyword: string, provinces: readonly Province[]): Province | null {
    if (!keyword) return null;
    const norm = removeVietnameseAccents(keyword);
    return provinces.find(p => {
      const normName = removeVietnameseAccents(p.name);
      return normName.includes(norm) || norm.includes(normName) || p.code === keyword;
    }) || null;
  }

  private sortProvincesAlphabetical(list: Province[]): Province[] {
    return list.slice().sort((a, b) => {
      // Ưu tiên 2 đô thị đặc biệt TP.HCM & Hà Nội lên đầu để thuận tiện người dùng
      const aIsTop = a.code === '79' || a.code === '01' || a.code === '1';
      const bIsTop = b.code === '79' || b.code === '01' || b.code === '1';
      if (aIsTop) {
        if (bIsTop) {
          return a.name.localeCompare(b.name, 'vi');
        }
        return -1;
      }
      if (bIsTop) {
        return 1;
      }
      return a.name.localeCompare(b.name, 'vi');
    });
  }
}
