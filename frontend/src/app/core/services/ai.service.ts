import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  AiConciergeRequest,
  AiConciergeResponse,
  AiUsageStatusDto
} from '../models/ai.model';
import { AiSmartSearchResponseDto } from '../models/public-booking.model';

@Injectable({ providedIn: 'root' })
export class AiService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/ai`;

  /**
   * Queries the AI Concierge for advice, natural language inquiries, and room recommendations.
   */
  askConcierge(message: string, propertySlug?: string): Observable<AiConciergeResponse> {
    const body: AiConciergeRequest = { message, propertySlug };
    return this.http.post<any>(`${this.apiUrl}/concierge`, body).pipe(
      map(res => (res.data ? res.data : res) as AiConciergeResponse)
    );
  }

  /**
   * Queries AI Smart Search: parses natural language, searches verified properties,
   * and returns suggested smart filter chips with zero hallucinations.
   */
  smartSearch(query: string, userLatitude?: number | null, userLongitude?: number | null): Observable<AiSmartSearchResponseDto> {
    const body = { query, userLatitude, userLongitude };
    return this.http.post<any>(`${this.apiUrl}/smart-search`, body).pipe(
      map(res => (res.data ? res.data : res) as AiSmartSearchResponseDto)
    );
  }

  /**
   * Checks current tenant AI consumption and remaining monthly quota.
   */
  getUsageStatus(): Observable<AiUsageStatusDto> {
    return this.http.get<any>(`${this.apiUrl}/usage-status`).pipe(
      map(res => (res.data ? res.data : res) as AiUsageStatusDto)
    );
  }
}
