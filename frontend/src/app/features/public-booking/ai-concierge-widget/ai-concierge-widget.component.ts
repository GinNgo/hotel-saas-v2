import { Component, Input, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AiService } from '../../../core/services/ai.service';
import { AiConciergeResponse, SuggestedRoomCardDto } from '../../../core/models/ai.model';

interface ChatMessage {
  sender: 'ai' | 'user';
  text: string;
  time: string;
  suggestedRooms?: SuggestedRoomCardDto[];
}

@Component({
  selector: 'app-ai-concierge-widget',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <!-- Floating Action Trigger Button -->
    <div class="fixed bottom-6 right-6 z-50">
      @if (!isOpen()) {
        <button
          type="button"
          (click)="toggleOpen()"
          class="group flex items-center gap-2.5 px-4 py-3 rounded-full bg-slate-900 text-white shadow-xl hover:shadow-2xl hover:bg-slate-800 transition-all duration-300 border border-slate-700/80 cursor-pointer active:scale-95"
          aria-label="Mở trợ lý ảo AI Concierge"
        >
          <div class="relative flex items-center justify-center w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-400">
            <i class="pi pi-sparkles text-sm"></i>
            <span class="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            <span class="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400"></span>
          </div>
          <div class="text-left">
            <span class="block text-xs font-bold tracking-tight">AI Concierge</span>
            <span class="block text-[10px] text-slate-400">Trợ lý tìm phòng 24/7</span>
          </div>
        </button>
      }

      <!-- Chat Modal Window -->
      @if (isOpen()) {
        <div class="flex flex-col w-[350px] sm:w-[420px] h-[540px] max-h-[85vh] bg-white rounded-2xl shadow-2xl border border-slate-200/90 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          <!-- Chat Header -->
          <div class="flex items-center justify-between px-4 py-3.5 bg-slate-900 text-white border-b border-slate-800 shrink-0">
            <div class="flex items-center gap-2.5">
              <div class="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center">
                <i class="pi pi-sparkles text-sm"></i>
              </div>
              <div>
                <div class="text-xs font-bold">Trợ Lý Ảo AI Concierge</div>
                <div class="text-[10px] text-emerald-400 flex items-center gap-1">
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Sẵn sàng tư vấn trực tiếp
                </div>
              </div>
            </div>

            <button
              type="button"
              (click)="toggleOpen()"
              class="w-7 h-7 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center transition-colors cursor-pointer"
              title="Thu nhỏ cửa sổ chat"
            >
              <i class="pi pi-times text-xs"></i>
            </button>
          </div>

          <!-- Chat Body Messages -->
          <div class="flex-1 p-4 overflow-y-auto space-y-3.5 bg-slate-50/50 text-xs">
            @for (msg of messages(); track $index) {
              <!-- AI Bubble -->
              @if (msg.sender === 'ai') {
                <div class="flex gap-2 max-w-[90%]">
                  <div class="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                    AI
                  </div>
                  <div class="space-y-2">
                    <div class="p-3 rounded-2xl rounded-tl-xs bg-white text-slate-800 border border-slate-200/80 shadow-2xs leading-relaxed">
                      {{ msg.text }}
                    </div>

                    <!-- Room Cards Carousel / List -->
                    @if (msg.suggestedRooms && msg.suggestedRooms.length > 0) {
                      <div class="space-y-2 pt-1">
                        @for (room of msg.suggestedRooms; track room.roomTypeId) {
                          <div class="p-2.5 rounded-xl bg-white border border-emerald-200 shadow-2xs flex flex-col gap-1.5">
                            <div class="flex items-start justify-between gap-1">
                              <div>
                                <span class="font-bold text-slate-900">{{ room.roomTypeName }}</span>
                                <div class="text-[10px] text-slate-500">{{ room.propertyName }} &bull; {{ room.city }}</div>
                              </div>
                              <span class="text-[11px] font-extrabold text-emerald-700 whitespace-nowrap">
                                {{ room.basePriceNight | number:'1.0-0' }} ₫
                              </span>
                            </div>
                            <p class="text-[10px] text-slate-600 line-clamp-2">{{ room.description }}</p>
                            <div class="flex items-center justify-between pt-1 border-t border-slate-100 text-[10px]">
                              <span class="text-slate-500">Sức chứa: {{ room.maxOccupancy }} khách</span>
                              <span class="text-emerald-700 font-semibold cursor-pointer hover:underline">
                                Đã sẵn sàng
                              </span>
                            </div>
                          </div>
                        }
                      </div>
                    }

                    <div class="text-[9px] text-slate-400 pl-1">{{ msg.time }}</div>
                  </div>
                </div>
              } @else {
                <!-- User Bubble -->
                <div class="flex justify-end">
                  <div class="max-w-[85%] space-y-1 text-right">
                    <div class="p-3 rounded-2xl rounded-tr-xs bg-slate-900 text-white shadow-2xs leading-relaxed text-left inline-block">
                      {{ msg.text }}
                    </div>
                    <div class="text-[9px] text-slate-400 pr-1">{{ msg.time }}</div>
                  </div>
                </div>
              }
            }

            <!-- Loading Indicator -->
            @if (isLoading()) {
              <div class="flex items-center gap-2 text-slate-500 text-xs pl-8">
                <i class="pi pi-spin pi-spinner text-emerald-600"></i>
                <span class="text-[11px]">Trợ lý AI đang tra cứu phòng...</span>
              </div>
            }
          </div>

          <!-- Quick Suggestion Chips (Landmarks & Rental Models) -->
          <div class="px-3 py-2 bg-white border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto shrink-0 scrollbar-none">
            <button
              type="button"
              (click)="sendQuickPrompt('Tìm nhà nghỉ thuê theo giờ gần Bãi Sau Vũng Tàu dưới 300k')"
              class="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] whitespace-nowrap cursor-pointer transition-colors"
            >
              Nhà nghỉ thuê giờ Bãi Sau Vũng Tàu
            </button>
            <button
              type="button"
              (click)="sendQuickPrompt('Khách sạn gần Chợ đêm Đà Lạt cho 2 người cuối tuần này')"
              class="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] whitespace-nowrap cursor-pointer transition-colors"
            >
              Khách sạn Chợ đêm Đà Lạt
            </button>
            <button
              type="button"
              (click)="sendQuickPrompt('Homestay có bồn tắm view đẹp tại Hồ Tuyền Lâm')"
              class="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] whitespace-nowrap cursor-pointer transition-colors"
            >
              Homestay Hồ Tuyền Lâm
            </button>
            <button
              type="button"
              (click)="sendQuickPrompt('Resort nghỉ dưỡng tại Phú Quốc cho gia đình')"
              class="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] whitespace-nowrap cursor-pointer transition-colors"
            >
              Resort Phú Quốc
            </button>
            <button
              type="button"
              (click)="sendQuickPrompt('Khách sạn gần Cầu Rồng Đà Nẵng')"
              class="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] whitespace-nowrap cursor-pointer transition-colors"
            >
              Khách sạn Cầu Rồng Đà Nẵng
            </button>
          </div>

          <!-- Input Footer -->
          <form (ngSubmit)="sendMessage()" class="p-3 bg-white border-t border-slate-200 flex items-center gap-2 shrink-0">
            <input
              type="text"
              [(ngModel)]="userInput"
              name="chatQuery"
              placeholder="Nhập yêu cầu (VD: tìm phòng ở Đà Nẵng...)"
              [disabled]="isLoading()"
              class="flex-1 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-emerald-500"
            />
            <button
              type="submit"
              [disabled]="isLoading() || !userInput.trim()"
              class="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center hover:bg-slate-800 disabled:opacity-40 transition-colors cursor-pointer shrink-0"
              aria-label="Gửi tin nhắn"
            >
              <i class="pi pi-send text-xs"></i>
            </button>
          </form>
        </div>
      }
    </div>
  `
})
export class AiConciergeWidgetComponent {
  @Input() propertySlug?: string;

  private readonly aiService = inject(AiService);

  isOpen = signal(false);
  isLoading = signal(false);
  userInput = '';

  messages = signal<ChatMessage[]>([
    {
      sender: 'ai',
      text: 'Dạ xin chào Quý khách! Em là Trợ lý ảo AI Concierge. Em có thể tư vấn chọn phòng phù hợp nhất, giải đáp giá phòng và chính sách check-in. Quý khách đang tìm phòng cho mấy người ạ?',
      time: 'Vừa xong'
    }
  ]);

  toggleOpen(): void {
    this.isOpen.update(v => !v);
  }

  sendQuickPrompt(text: string): void {
    this.userInput = text;
    this.sendMessage();
  }

  sendMessage(): void {
    const text = this.userInput.trim();
    if (!text || this.isLoading()) return;

    const time = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

    // Append user message
    this.messages.update(list => [...list, { sender: 'user', text, time }]);
    this.userInput = '';
    this.isLoading.set(true);

    this.aiService.askConcierge(text, this.propertySlug).subscribe({
      next: (res: AiConciergeResponse) => {
        this.isLoading.set(false);
        this.messages.update(list => [
          ...list,
          {
            sender: 'ai',
            text: res.reply,
            time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
            suggestedRooms: res.suggestedRooms
          }
        ]);
      },
      error: () => {
        this.isLoading.set(false);
        this.messages.update(list => [
          ...list,
          {
            sender: 'ai',
            text: 'Dạ em xin lỗi, kết nối tới hệ thống AI đang bị gián đoạn đôi chút. Quý khách vui lòng chọn các bộ lọc tìm kiếm trực tiếp trên trang hoặc thử lại sau giây lát nhé!',
            time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
          }
        ]);
      }
    });
  }
}
