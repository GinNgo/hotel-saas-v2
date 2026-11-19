import {
  Component,
  DestroyRef,
  inject,
  signal,
  ElementRef,
  ViewChild,
  ChangeDetectionStrategy,
  afterNextRender
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { A11yModule } from '@angular/cdk/a11y';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AiConciergeService, ChatMessage, ChatResponse } from '../../../core/services/ai-concierge.service';

@Component({
  selector: 'app-ai-concierge-chat',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, A11yModule],
  template: `
    <!-- Floating Trigger Button -->
    <div class="fixed bottom-4 right-3 sm:bottom-5 sm:right-6 z-50 flex flex-col items-end max-w-[calc(100vw-1.5rem)]">
      @if (!isOpen()) {
        <button
          type="button"
          (click)="toggleOpen()"
          class="group relative min-h-11 flex items-center gap-2.5 px-3.5 sm:px-4 py-3 max-w-full bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-700 hover:to-indigo-700 text-white rounded-full shadow-lg shadow-emerald-900/20 hover:shadow-xl hover:scale-105 transition-all duration-200 cursor-pointer"
          aria-label="Mở Trợ lý AI Hotel SaaS"
        >
          <div class="relative flex items-center justify-center w-7 h-7 rounded-full bg-white/20 backdrop-blur-xs shrink-0">
            <i class="pi pi-sparkles text-sm text-amber-300"></i>
          </div>
          <div class="text-left min-w-0">
            <div class="text-xs font-bold tracking-wide flex items-center gap-1.5">
              <span class="truncate">Trợ lý AI Hotel SaaS</span>
            </div>
            <div class="text-[10px] text-emerald-100 font-medium truncate">Hỏi phòng, địa điểm &amp; ăn uống</div>
          </div>
        </button>
      }

      <!-- Chat Drawer / Modal Box -->
      @if (isOpen()) {
        <div
          cdkTrapFocus
          [cdkTrapFocusAutoCapture]="true"
          class="w-[calc(100vw-1.5rem)] max-w-[380px] sm:w-[400px] sm:max-w-[400px] h-[520px] sm:h-[560px] max-h-[85vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
          role="dialog"
          aria-modal="true"
          aria-label="Khung trò chuyện với Trợ lý AI Hotel SaaS"
          (keydown.escape)="toggleOpen()"
        >
          <!-- Chat Header -->
          <div class="p-3.5 bg-gradient-to-r from-emerald-700 via-teal-700 to-slate-900 text-white flex items-center justify-between gap-2 shadow-xs">
            <div class="flex items-center gap-2.5 min-w-0">
              <div class="w-9 h-9 rounded-xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-inner shrink-0">
                <i class="pi pi-sparkles text-amber-300 text-base"></i>
              </div>
              <div class="min-w-0">
                <div class="flex items-center gap-1.5 font-bold text-sm">
                  <span class="truncate">Trợ lý AI Hotel SaaS</span>
                </div>
                <div class="text-[11px] text-emerald-100 flex items-center gap-1 truncate">
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-300 shrink-0"></span>
                  <span class="truncate">Tích hợp Google Maps Data &amp; Đặt phòng</span>
                </div>
              </div>
            </div>

            <div class="flex items-center gap-1">
              <button
                type="button"
                (click)="clearHistory()"
                class="min-h-11 min-w-11 flex items-center justify-center text-slate-300 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                title="Làm mới cuộc trò chuyện"
                aria-label="Làm mới cuộc trò chuyện"
              >
                <i class="pi pi-refresh text-xs"></i>
              </button>
              <button
                type="button"
                (click)="toggleOpen()"
                class="min-h-11 min-w-11 flex items-center justify-center text-slate-300 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                title="Đóng khung chat"
                aria-label="Đóng khung chat"
              >
                <i class="pi pi-times text-sm"></i>
              </button>
            </div>
          </div>

          <!-- Quick Suggestion Chips & GPS Toggle -->
          <div class="px-3 py-2 bg-slate-50 border-b border-slate-100 space-y-1.5 min-w-0">
            <div class="flex items-center gap-1.5 overflow-x-auto max-w-full text-[11px]">
              <button
                type="button"
                (click)="toggleUserLocation()"
                [disabled]="locatingGps()"
                [ngClass]="userLocation()
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white text-emerald-700 border-emerald-300 hover:bg-emerald-50'"
                class="min-h-11 px-3 py-1.5 rounded-full border shrink-0 transition-colors font-semibold inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                @if (locatingGps()) {
                  <i class="pi pi-spin pi-spinner text-[11px]"></i>
                  <span>Đang định vị...</span>
                } @else if (userLocation()) {
                  <i class="pi pi-map-marker text-[11px]"></i>
                  <span>Đã bật vị trí</span>
                } @else {
                  <i class="pi pi-map-marker text-[11px]"></i>
                  <span>Định vị gần tôi</span>
                }
              </button>
              <span class="text-slate-400 font-semibold shrink-0">Gợi ý:</span>
              @for (prompt of quickPrompts; track prompt) {
                <button
                  type="button"
                  (click)="sendQuickPrompt(prompt)"
                  [disabled]="loading()"
                  class="min-h-11 px-3 py-1.5 rounded-full bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border border-slate-200/90 hover:border-emerald-300 shrink-0 transition-colors font-medium cursor-pointer disabled:opacity-50"
                >
                  {{ prompt }}
                </button>
              }
            </div>
            @if (locationStatus()) {
              <div class="text-[10px] text-slate-500 px-1 flex items-center justify-between gap-2">
                <span>{{ locationStatus() }}</span>
                <button
                  type="button"
                  (click)="locationStatus.set(null)"
                  class="min-h-11 min-w-11 flex items-center justify-center text-slate-400 hover:text-slate-600 cursor-pointer rounded-lg"
                  aria-label="Đóng trạng thái định vị"
                >
                  <i class="pi pi-times text-[10px]"></i>
                </button>
              </div>
            }
          </div>

          <!-- Message Thread (Scrollable) -->
          <div
            #scrollContainer
            class="flex-1 p-3.5 space-y-3.5 overflow-y-auto bg-slate-50/50 text-xs"
          >
            @for (msg of messages(); track msg.id) {
              <div
                class="flex flex-col gap-1"
                [ngClass]="msg.role === 'user' ? 'items-end' : 'items-start'"
              >
                <div class="flex items-end gap-1.5 max-w-[88%]">
                  @if (msg.role === 'assistant') {
                    <div class="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-[10px] shrink-0 mb-0.5">
                      <i class="pi pi-sparkles"></i>
                    </div>
                  }

                  <div
                    class="p-3 rounded-2xl leading-relaxed whitespace-pre-wrap break-words shadow-2xs"
                    [ngClass]="msg.role === 'user'
                      ? 'bg-emerald-600 text-white rounded-br-2xs'
                      : 'bg-white text-slate-800 border border-slate-200/80 rounded-bl-2xs'"
                  >
                    {{ msg.content }}

                    <!-- Maps Grounding Source Links (Mandatory Display) -->
                    @if (msg.groundingLinks && msg.groundingLinks.length > 0) {
                      <div class="mt-2.5 pt-2 border-t border-slate-100 space-y-1">
                        <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                          <i class="pi pi-map-marker text-rose-500 text-[10px]"></i>
                          <span>Địa điểm trên Google Maps:</span>
                        </div>
                        <div class="flex flex-col gap-1">
                          @for (link of msg.groundingLinks; track link.uri) {
                            <a
                              [href]="link.uri"
                              target="_blank"
                              rel="noopener noreferrer"
                              class="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 hover:text-emerald-900 underline hover:no-underline break-all"
                            >
                              <i class="pi pi-external-link text-[9px] shrink-0"></i>
                              <span class="break-words">{{ link.title || link.uri }}</span>
                            </a>
                          }
                        </div>
                      </div>
                    }
                  </div>
                </div>

                <span class="text-[9px] text-slate-400 px-1 tabular-nums">
                  {{ msg.timestamp | date:'HH:mm' }}
                </span>
              </div>
            }

            @if (loading()) {
              <div class="flex items-end gap-1.5 max-w-[85%] items-start">
                <div class="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-[10px] shrink-0">
                  <i class="pi pi-sparkles"></i>
                </div>
                <div class="p-3 rounded-2xl rounded-bl-2xs bg-white text-slate-500 border border-slate-200/80 flex items-center gap-2">
                  <i class="pi pi-spin pi-spinner text-emerald-600 text-xs"></i>
                  <span>AI Concierge đang tra cứu Google Maps & soạn câu trả lời...</span>
                </div>
              </div>
            }
          </div>

          <!-- Input Footer -->
          <div class="p-3 bg-white border-t border-slate-200 flex items-center gap-2">
            <textarea
              [(ngModel)]="userInput"
              (keydown.enter)="onEnterPress($event)"
              placeholder="Nhập câu hỏi (VD: Gần khách sạn Q1 có quán ăn nào ngon?)..."
              aria-label="Nhập câu hỏi cho Trợ lý AI"
              rows="1"
              [disabled]="loading()"
              class="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-none max-h-24 transition-colors"
            ></textarea>

            <button
              type="button"
              (click)="sendUserMessage()"
              [disabled]="loading() || !userInput.trim()"
              class="min-w-11 min-h-11 w-11 h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shadow-xs transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
              aria-label="Gửi tin nhắn"
            >
              <i class="pi pi-send text-xs"></i>
            </button>
          </div>
        </div>
      }
    </div>
  `
})
export class AiConciergeChatComponent {
  private readonly aiService = inject(AiConciergeService);
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild('scrollContainer') private scrollContainer?: ElementRef<HTMLDivElement>;

  readonly isOpen = signal<boolean>(false);
  readonly loading = signal<boolean>(false);
  readonly userLocation = signal<{ latitude: number; longitude: number } | null>(null);
  readonly locatingGps = signal<boolean>(false);
  readonly locationStatus = signal<string | null>(null);
  userInput = '';

  readonly quickPrompts = [
    'Quán ăn ngon gần Grand Hotel Q1?',
    'Chính sách nhận / trả phòng?',
    'Tư vấn resort Đà Lạt ngắm cảnh?',
    'Cách đặt phòng theo giờ?'
  ];

  readonly messages = signal<ChatMessage[]>([
    {
      id: 'welcome-msg',
      role: 'assistant',
      content: 'Dạ chào Quý khách! Em là Trợ lý AI Hotel SaaS. Em có thể hỗ trợ tư vấn chọn phòng, chính sách khách sạn và gợi ý các địa điểm ăn uống, du lịch nổi bật quanh khách sạn qua dữ liệu Google Maps ạ.',
      timestamp: new Date()
    }
  ]);

  constructor() {
    afterNextRender(() => {
      this.scrollToBottom();
    });
  }

  toggleOpen(): void {
    this.isOpen.set(!this.isOpen());
    if (this.isOpen()) {
      setTimeout(() => this.scrollToBottom(), 100);
    }
  }

  clearHistory(): void {
    this.messages.set([
      {
        id: `welcome-${Date.now()}`,
        role: 'assistant',
        content: 'Cuộc trò chuyện đã được làm mới. Quý khách cần em hỗ trợ thông tin gì về khách sạn hoặc các điểm đến xung quanh không ạ?',
        timestamp: new Date()
      }
    ]);
  }

  toggleUserLocation(): void {
    if (this.userLocation()) {
      this.userLocation.set(null);
      this.locationStatus.set('Đã tắt định vị GPS.');
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      this.locationStatus.set('Trình duyệt không hỗ trợ định vị GPS.');
      return;
    }

    this.locatingGps.set(true);
    this.locationStatus.set('Đang lấy tọa độ hiện tại...');

    const onSuccess = (pos: GeolocationPosition): void => {
      this.locatingGps.set(false);
      const latitude = Number(pos.coords.latitude.toFixed(6));
      const longitude = Number(pos.coords.longitude.toFixed(6));
      this.userLocation.set({ latitude, longitude });
      this.locationStatus.set(`Đã gắn GPS (${latitude.toFixed(4)}, ${longitude.toFixed(4)}) cho AI.`);
    };

    const onError = (err: GeolocationPositionError): void => {
      this.locatingGps.set(false);
      this.locationStatus.set(
        err.code === 1
          ? 'Bạn đã từ chối quyền định vị GPS.'
          : 'Không thể lấy vị trí hiện tại. Bạn vẫn có thể hỏi theo tên khu vực.'
      );
    };

    navigator.geolocation.getCurrentPosition(
      onSuccess,
      (err: GeolocationPositionError) => {
        if (err.code === 2 || err.code === 3) {
          navigator.geolocation.getCurrentPosition(onSuccess, onError, {
            enableHighAccuracy: false,
            timeout: 8000,
            maximumAge: 300000
          });
        } else {
          onError(err);
        }
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 60000 }
    );
  }

  sendQuickPrompt(prompt: string): void {
    this.userInput = prompt;
    this.sendUserMessage();
  }

  onEnterPress(event: Event): void {
    const keyEvent = event as KeyboardEvent;
    if (!keyEvent.shiftKey) {
      keyEvent.preventDefault();
      this.sendUserMessage();
    }
  }

  sendUserMessage(): void {
    const text = this.userInput.trim();
    if (!text || this.loading()) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date()
    };

    const currentHistory = this.messages();
    this.messages.set([...currentHistory, userMsg]);
    this.userInput = '';
    this.loading.set(true);
    setTimeout(() => this.scrollToBottom(), 50);

    // Call server-side Gemini API
    this.aiService.sendMessage(text, currentHistory, this.userLocation() ?? undefined).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: res => {
        this.loading.set(false);
        const links: Array<{ title?: string; uri?: string }> = [];

        // Extract Google Maps and Web grounding chunks
        if (res.groundingChunks && Array.isArray(res.groundingChunks)) {
          for (const chunk of res.groundingChunks) {
            if (chunk.maps?.uri) {
              links.push({
                title: chunk.maps.title || 'Xem trên Google Maps',
                uri: chunk.maps.uri
              });
            } else if (chunk.web?.uri) {
              links.push({
                title: chunk.web.title || 'Nguồn tham khảo',
                uri: chunk.web.uri
              });
            }
          }
        }

        const aiMsg: ChatMessage = {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content: res.text,
          timestamp: new Date(),
          groundingLinks: links
        };

        this.messages.set([...this.messages(), aiMsg]);
        setTimeout(() => this.scrollToBottom(), 50);
      },
      error: () => {
        this.loading.set(false);
        const errorMsg: ChatMessage = {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: 'Dạ xin lỗi quý khách, hệ thống đang bận. Quý khách vui lòng thử lại sau ít phút ạ.',
          timestamp: new Date()
        };
        this.messages.set([...this.messages(), errorMsg]);
        setTimeout(() => this.scrollToBottom(), 50);
      }
    });
  }

  private scrollToBottom(): void {
    if (this.scrollContainer?.nativeElement) {
      this.scrollContainer.nativeElement.scrollTop = this.scrollContainer.nativeElement.scrollHeight;
    }
  }
}
