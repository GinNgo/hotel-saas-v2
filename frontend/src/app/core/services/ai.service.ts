import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  AiConciergeRequest,
  AiConciergeResponse,
  AiUsageStatusDto
} from '../models/ai.model';
import { AiSmartSearchResponseDto } from '../models/public-booking.model';
import { RoomTypeRateDto } from '../models/rate.model';

export interface RoomTypePricingRecommendationDto {
  roomTypeId: string;
  roomTypeName: string;
  totalRooms: number;
  bookedRooms: number;
  occupancyRate: number;
  basePrice: number;
  recommendedPrice: number;
  surgeMultiplier: number;
  strategy: string;
  rationale: string;
}

export interface DynamicPricingSummaryDto {
  propertyId: string;
  propertyName: string;
  targetDate: string;
  overallOccupancyRate: number;
  marketDemandLevel: string;
  recommendations: RoomTypePricingRecommendationDto[];
  message?: string;
}

export interface ApplyDynamicPricingRequest {
  roomTypeId: string;
  nightlyPrice: number;
  propertyId?: string | null;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  firstHours?: number | null;
  firstHoursPrice?: number | null;
  additionalHourPrice?: number | null;
  currency?: string | null;
  changeReason?: string | null;
}

@Injectable({ providedIn: 'root' })
export class AiService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/ai`;

  /**
   * Queries the AI Concierge for advice, natural language inquiries, and room recommendations.
   */
  askConcierge(message: string, propertySlug?: string): Observable<AiConciergeResponse> {
    const body: AiConciergeRequest = { message, propertySlug };
    return this.http.post<AiConciergeResponse | { data: AiConciergeResponse }>(`${this.apiUrl}/concierge`, body).pipe(
      map(res => ('data' in res ? res.data : res))
    );
  }

  /**
   * Queries AI Smart Search: parses natural language, searches verified properties,
   * and returns suggested smart filter chips with zero hallucinations.
   */
  smartSearch(query: string, userLatitude?: number | null, userLongitude?: number | null): Observable<AiSmartSearchResponseDto> {
    const body = { query, userLatitude, userLongitude };
    return this.http.post<AiSmartSearchResponseDto | { data: AiSmartSearchResponseDto }>(`${this.apiUrl}/smart-search`, body).pipe(
      map(res => ('data' in res ? res.data : res))
    );
  }

  /**
   * Checks current tenant AI consumption and remaining monthly quota.
   */
  getUsageStatus(): Observable<AiUsageStatusDto> {
    return this.http.get<AiUsageStatusDto | { data: AiUsageStatusDto }>(`${this.apiUrl}/usage-status`).pipe(
      map(res => ('data' in res ? res.data : res))
    );
  }

  /**
   * Fetches AI Dynamic Pricing recommendations for a property and target date.
   */
  getDynamicPricingRecommendations(
    propertyId?: string | null,
    date?: string | null
  ): Observable<DynamicPricingSummaryDto> {
    let params = new HttpParams();
    if (propertyId && propertyId.trim().length > 0) {
      params = params.set('propertyId', propertyId.trim());
    }
    if (date && date.trim().length > 0) {
      params = params.set('date', date.trim());
    }

    return this.http.get<DynamicPricingSummaryDto | { data: DynamicPricingSummaryDto }>(
      `${this.apiUrl}/dynamic-pricing/recommendations`,
      { params }
    ).pipe(
      map(res => ('data' in res ? res.data : res))
    );
  }

  /**
   * Applies an AI Dynamic Pricing recommendation to create or interval-split a rate schedule.
   */
  applyDynamicPricing(request: ApplyDynamicPricingRequest): Observable<RoomTypeRateDto> {
    return this.http.post<RoomTypeRateDto | { data: RoomTypeRateDto }>(
      `${this.apiUrl}/dynamic-pricing/apply`,
      request
    ).pipe(
      map(res => ('data' in res ? res.data : res))
    );
  }
}
