import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  TenantContractDto,
  CreateTenantContractRequest,
  UpdateContractStatusRequest
} from '../models/admin-contract.model';

@Injectable({ providedIn: 'root' })
export class AdminContractsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/admin/contracts`;

  getAllContracts(): Observable<TenantContractDto[]> {
    return this.http.get<any>(this.apiUrl).pipe(
      map(res => (res.data ? res.data : res) as TenantContractDto[])
    );
  }

  getContractById(id: string): Observable<TenantContractDto> {
    return this.http.get<any>(`${this.apiUrl}/${id}`).pipe(
      map(res => (res.data ? res.data : res) as TenantContractDto)
    );
  }

  createContract(req: CreateTenantContractRequest): Observable<TenantContractDto> {
    return this.http.post<any>(this.apiUrl, req).pipe(
      map(res => (res.data ? res.data : res) as TenantContractDto)
    );
  }

  updateContractStatus(id: string, req: UpdateContractStatusRequest): Observable<TenantContractDto> {
    return this.http.patch<any>(`${this.apiUrl}/${id}/status`, req).pipe(
      map(res => (res.data ? res.data : res) as TenantContractDto)
    );
  }
}
