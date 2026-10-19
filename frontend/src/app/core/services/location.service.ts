import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Province, Ward, VIETNAM_63_PROVINCES, removeVietnameseAccents } from '../models/location.model';
import { ApiResponse } from '../models/api-response.model';

@Injectable({
  providedIn: 'root'
})
export class LocationService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/locations`;

  /**
   * Lấy danh sách toàn bộ 63 Tỉnh / Thành phố Việt Nam.
   * Luôn đảm bảo đủ 63 đơn vị hành chính và sắp xếp theo bảng chữ cái tiếng Việt.
   */
  getProvinces(): Observable<Province[]> {
    return this.http.get<ApiResponse<Province[]>>(`${this.apiUrl}/provinces`).pipe(
      map(res => {
        const list = res.data && res.data.length > 0 ? res.data : [...VIETNAM_63_PROVINCES];
        return this.sortProvincesAlphabetical(list);
      }),
      catchError(() => {
        // Fallback tức thì nếu kết nối mạng chậm hoặc backend offline
        return of(this.sortProvincesAlphabetical([...VIETNAM_63_PROVINCES]));
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
      if (a.code === '79' || a.code === '1') {
        if (b.code === '79' || b.code === '1') {
          return a.name.localeCompare(b.name, 'vi');
        }
        return -1;
      }
      if (b.code === '79' || b.code === '1') {
        return 1;
      }
      return a.name.localeCompare(b.name, 'vi');
    });
  }
}
