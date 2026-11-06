import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  groundingLinks?: Array<{ title?: string; uri?: string }>;
}

export interface ChatResponse {
  text: string;
  groundingChunks?: Array<{
    maps?: {
      title?: string;
      uri?: string;
      placeAnswerSources?: {
        reviewSnippets?: Array<{ reviewText?: string; author?: string }>;
      };
    };
    web?: {
      title?: string;
      uri?: string;
    };
  }>;
}

@Injectable({
  providedIn: 'root'
})
export class AiConciergeService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = '/api/ai/chat';

  sendMessage(
    message: string,
    history: ChatMessage[] = [],
    location?: { latitude: number; longitude: number }
  ): Observable<ChatResponse> {
    const formattedHistory = history.map(m => ({
      role: m.role,
      content: m.content
    }));

    return this.http
      .post<ChatResponse>(this.apiUrl, {
        message,
        messages: formattedHistory,
        location
      })
      .pipe(
        catchError(err => {
          console.error('Error contacting AI concierge:', err);
          return of({
            text: 'Dạ xin lỗi quý khách, hệ thống Trợ lý ảo AI đang bận kết nối. Quý khách vui lòng thử lại hoặc gọi tổng đài 1900 6868 để được hỗ trợ tức thì ạ.',
            groundingChunks: []
          });
        })
      );
  }
}
