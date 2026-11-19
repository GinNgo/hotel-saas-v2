import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api-response.model';
import {
  GetPmsReviewsFilter,
  PmsGuestReviewItemDto,
  PmsReviewsPagedResultDto,
  PmsReviewsSummaryDto,
  ReplyGuestReviewRequest,
  ToggleReviewVisibilityRequest
} from '../models/review.model';

const EMPTY_SUMMARY: PmsReviewsSummaryDto = {
  averageRating: 0,
  totalCount: 0,
  publishedCount: 0,
  hiddenCount: 0,
  unansweredCount: 0,
  repliedCount: 0,
  cleanlinessAverage: 0,
  locationAverage: 0,
  serviceAverage: 0,
  valueAverage: 0,
  ratingDistribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
};

const EMPTY_RESULT: PmsReviewsPagedResultDto = {
  items: [],
  totalCount: 0,
  page: 1,
  pageSize: 20,
  totalPages: 0,
  hasPreviousPage: false,
  hasNextPage: false,
  summary: EMPTY_SUMMARY
};

@Injectable({ providedIn: 'root' })
export class ReviewService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/reviews`;

  getReviews(filter?: GetPmsReviewsFilter): Observable<PmsReviewsPagedResultDto> {
    let params = new HttpParams();

    if (filter?.propertyId) {
      params = params.set('propertyId', filter.propertyId);
    }
    if (filter?.rating !== undefined && filter?.rating !== null) {
      params = params.set('rating', filter.rating.toString());
    }
    if (filter?.hasReply !== undefined && filter?.hasReply !== null) {
      params = params.set('hasReply', String(filter.hasReply));
    }
    if (filter?.isPublished !== undefined && filter?.isPublished !== null) {
      params = params.set('isPublished', String(filter.isPublished));
    }
    if (filter?.search?.trim()) {
      params = params.set('search', filter.search.trim());
    }
    if (filter?.page !== undefined && filter?.page !== null) {
      params = params.set('page', filter.page.toString());
    }
    if (filter?.pageSize !== undefined && filter?.pageSize !== null) {
      params = params.set('pageSize', filter.pageSize.toString());
    }

    return this.http
      .get<ApiResponse<PmsReviewsPagedResultDto>>(this.apiUrl, { params })
      .pipe(map(res => res.data ?? EMPTY_RESULT));
  }

  replyReview(reviewId: string, reply: string): Observable<PmsGuestReviewItemDto> {
    const body: ReplyGuestReviewRequest = { reply };
    return this.http
      .post<ApiResponse<PmsGuestReviewItemDto>>(`${this.apiUrl}/${encodeURIComponent(reviewId)}/reply`, body)
      .pipe(map(res => res.data!));
  }

  toggleVisibility(reviewId: string, isPublished: boolean): Observable<PmsGuestReviewItemDto> {
    const body: ToggleReviewVisibilityRequest = { isPublished };
    return this.http
      .patch<ApiResponse<PmsGuestReviewItemDto>>(`${this.apiUrl}/${encodeURIComponent(reviewId)}/visibility`, body)
      .pipe(map(res => res.data!));
  }
}
