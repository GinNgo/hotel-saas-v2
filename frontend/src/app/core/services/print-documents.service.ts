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

@Injectable({ providedIn: 'root' })
export class PrintDocumentsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/print`;

  getInvoice(reservationId: string): Observable<PrintInvoiceDto> {
    return this.http.get<any>(`${this.apiUrl}/invoice/${reservationId}`).pipe(
      map(res => (res && res.data ? res.data : res) as PrintInvoiceDto)
    );
  }

  getVoucher(confirmationCode: string): Observable<PrintVoucherDto> {
    return this.http.get<any>(`${this.apiUrl}/voucher/${confirmationCode}`).pipe(
      map(res => (res && res.data ? res.data : res) as PrintVoucherDto)
    );
  }

  getContract(contractId: string): Observable<PrintContractDto> {
    return this.http.get<any>(`${this.apiUrl}/contract/${contractId}`).pipe(
      map(res => (res && res.data ? res.data : res) as PrintContractDto)
    );
  }

  getTemplateConfig(propertyId?: string): Observable<PrintTemplateConfigDto> {
    let params = new HttpParams();
    if (propertyId) {
      params = params.set('propertyId', propertyId);
    }
    return this.http.get<any>(`${this.apiUrl}/template-config`, { params }).pipe(
      map(res => (res && res.data ? res.data : res) as PrintTemplateConfigDto)
    );
  }

  updateTemplateConfig(req: PrintTemplateConfigDto, propertyId?: string): Observable<PrintTemplateConfigDto> {
    let params = new HttpParams();
    if (propertyId) {
      params = params.set('propertyId', propertyId);
    }
    return this.http.put<any>(`${this.apiUrl}/template-config`, req, { params }).pipe(
      map(res => (res && res.data ? res.data : res) as PrintTemplateConfigDto)
    );
  }
}
