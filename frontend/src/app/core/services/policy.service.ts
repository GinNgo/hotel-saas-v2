import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api-response.model';
import {
  PropertyPoliciesDto,
  UpdatePropertyPoliciesRequest
} from '../models/policy.model';

@Injectable({ providedIn: 'root' })
export class PolicyService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/properties`;

  getPolicies(propertyId: string): Observable<PropertyPoliciesDto> {
    return this.http
      .get<ApiResponse<PropertyPoliciesDto>>(`${this.apiUrl}/${propertyId}/policies`)
      .pipe(map(res => res.data as PropertyPoliciesDto));
  }

  updatePolicies(
    propertyId: string,
    request: UpdatePropertyPoliciesRequest
  ): Observable<PropertyPoliciesDto> {
    return this.http
      .put<ApiResponse<PropertyPoliciesDto>>(`${this.apiUrl}/${propertyId}/policies`, request)
      .pipe(map(res => res.data as PropertyPoliciesDto));
  }
}
