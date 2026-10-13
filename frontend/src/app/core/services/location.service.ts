import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Province, Ward } from '../models/location.model';
import { ApiResponse } from '../models/api-response.model';

@Injectable({
  providedIn: 'root'
})
export class LocationService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/locations`;

  getProvinces(): Observable<Province[]> {
    return this.http.get<ApiResponse<Province[]>>(`${this.apiUrl}/provinces`).pipe(
      map(res => res.data || [])
    );
  }

  getWards(provinceCode: string): Observable<Ward[]> {
    return this.http.get<ApiResponse<Ward[]>>(`${this.apiUrl}/provinces/${provinceCode}/wards`).pipe(
      map(res => res.data || [])
    );
  }
}
