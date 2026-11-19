import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  PrintInvoiceDto,
  PrintVoucherDto,
  PrintContractDto,
  PrintTemplateConfigDto
} from '../models/print-document.model';

interface ApiEnvelope<T> {
  data?: T;
}

function unwrapDto<T>(res: T | ApiEnvelope<T>): T {
  if (res && typeof res === 'object' && 'data' in res && res.data !== undefined) {
    return res.data;
  }
  return res as T;
}

@Injectable({ providedIn: 'root' })
export class PrintDocumentsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/print`;

  getInvoice(reservationId: string, code?: string): Observable<PrintInvoiceDto> {
    let params = new HttpParams();
    if (code) {
      params = params.set('code', code);
    }
    return this.http
      .get<PrintInvoiceDto | ApiEnvelope<PrintInvoiceDto>>(`${this.apiUrl}/invoice/${encodeURIComponent(reservationId)}`, { params })
      .pipe(map(unwrapDto));
  }

  getVoucher(tokenOrCode: string): Observable<PrintVoucherDto> {
    return this.http
      .get<PrintVoucherDto | ApiEnvelope<PrintVoucherDto>>(`${this.apiUrl}/voucher/${encodeURIComponent(tokenOrCode)}`)
      .pipe(map(unwrapDto));
  }

  getContract(contractId: string): Observable<PrintContractDto> {
    return this.http
      .get<PrintContractDto | ApiEnvelope<PrintContractDto>>(`${this.apiUrl}/contract/${encodeURIComponent(contractId)}`)
      .pipe(map(unwrapDto));
  }

  getTemplateConfig(propertyId?: string): Observable<PrintTemplateConfigDto> {
    let params = new HttpParams();
    if (propertyId) {
      params = params.set('propertyId', propertyId);
    }
    return this.http
      .get<PrintTemplateConfigDto | ApiEnvelope<PrintTemplateConfigDto>>(`${this.apiUrl}/template-config`, { params })
      .pipe(map(unwrapDto));
  }

  updateTemplateConfig(req: PrintTemplateConfigDto, propertyId?: string): Observable<PrintTemplateConfigDto> {
    let params = new HttpParams();
    if (propertyId) {
      params = params.set('propertyId', propertyId);
    }
    return this.http
      .put<PrintTemplateConfigDto | ApiEnvelope<PrintTemplateConfigDto>>(`${this.apiUrl}/template-config`, req, { params })
      .pipe(map(unwrapDto));
  }
}
