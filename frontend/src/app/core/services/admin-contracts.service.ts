import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  TenantContractDto,
  CreateTenantContractRequest,
  UpdateContractStatusRequest,
  ContractBillingCycle
} from '../models/admin-contract.model';

interface ApiEnvelope<T> {
  data?: T;
}

function unwrapResponse<T>(res: ApiEnvelope<T> | T): T {
  if (res && typeof res === 'object' && 'data' in res && res.data !== undefined) {
    return res.data;
  }
  return res as T;
}

@Injectable({ providedIn: 'root' })
export class AdminContractsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/admin/contracts`;

  getAllContracts(): Observable<TenantContractDto[]> {
    return this.http.get<ApiEnvelope<TenantContractDto[]> | TenantContractDto[]>(this.apiUrl).pipe(
      map(res => unwrapResponse(res))
    );
  }

  getContractById(id: string): Observable<TenantContractDto> {
    return this.http.get<ApiEnvelope<TenantContractDto> | TenantContractDto>(`${this.apiUrl}/${id}`).pipe(
      map(res => unwrapResponse(res))
    );
  }

  createContract(req: CreateTenantContractRequest): Observable<TenantContractDto> {
    const rawCycle = req.billingCycle as string;
    const normalizedBillingCycle: ContractBillingCycle = rawCycle === 'Yearly' ? 'Annual' : req.billingCycle;
    const payload: CreateTenantContractRequest = {
      ...req,
      billingCycle: normalizedBillingCycle
    };

    return this.http.post<ApiEnvelope<TenantContractDto> | TenantContractDto>(this.apiUrl, payload).pipe(
      map(res => unwrapResponse(res))
    );
  }

  updateContractStatus(id: string, req: UpdateContractStatusRequest): Observable<TenantContractDto> {
    return this.http.patch<ApiEnvelope<TenantContractDto> | TenantContractDto>(`${this.apiUrl}/${id}/status`, req).pipe(
      map(res => unwrapResponse(res))
    );
  }
}
