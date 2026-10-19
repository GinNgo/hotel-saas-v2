import { Component, OnInit, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { PrintDocumentsService } from '../../core/services/print-documents.service';
import { PrintVoucherDto } from '../../core/models/print-document.model';

@Component({
  selector: 'app-print-voucher-page',
  standalone: true,
  imports: [CommonModule, RouterModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-slate-100 p-4 sm:p-8 print:p-0 print:bg-white text-slate-800 font-sans">
      <!-- Action Toolbar -->
      <div class="max-w-3xl mx-auto mb-6 flex items-center justify-between print:hidden">
        <a
          routerLink="/booking"
          class="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 bg-white px-3.5 py-2 rounded-xl border border-slate-200 shadow-2xs"
        >
          <i class="pi pi-arrow-left"></i> Về trang tìm phòng
        </a>

        <div class="flex items-center gap-3">
          <button
            type="button"
            (click)="windowPrint()"
            class="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors shadow-sm cursor-pointer"
          >
            <i class="pi pi-print"></i> In Phiếu Xác Nhận (Voucher)
          </button>
        </div>
      </div>

      <!-- Printable Voucher Sheet -->
      @if (voucher(); as v) {
        <div class="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200/80 p-8 sm:p-10 print:shadow-none print:border-none print:p-0 print:max-w-none">
          <!-- Top Badge & Hotel Header -->
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200">
            <div>
              <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 uppercase tracking-wider mb-2">
                <i class="pi pi-ticket"></i> PHIẾU XÁC NHẬN ĐẶT PHÒNG / HOTEL VOUCHER
              </span>
              <h1 class="text-2xl font-black text-slate-900">{{ v.propertyName }}</h1>
              <p class="text-xs text-slate-500 mt-0.5">{{ v.propertyAddress }}</p>
            </div>

            <!-- Confirmation Code Box -->
            <div class="sm:text-right p-3 rounded-xl bg-slate-50 border border-slate-200/80">
              <div class="text-[11px] text-slate-500 uppercase font-semibold">Mã Đặt Chỗ (Confirmation Code)</div>
              <div class="text-2xl font-black font-mono text-indigo-700 tracking-wider mt-0.5">
                {{ v.confirmationCode }}
              </div>
              <div class="text-xs text-emerald-600 font-medium flex sm:justify-end items-center gap-1 mt-1">
                <i class="pi pi-check text-[11px]"></i> Trạng thái: {{ v.holdStatus }}
              </div>
            </div>
          </div>

          <!-- Main Booking Details -->
          <div class="py-6 grid grid-cols-1 sm:grid-cols-2 gap-6 border-b border-slate-200">
            <div class="space-y-3">
              <div class="text-xs font-bold text-slate-900 uppercase tracking-wider">Thông Tin Khách Lưu Trú</div>
              <div class="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-2 text-xs">
                <div><span class="text-slate-500">Khách hàng:</span> <strong class="text-slate-900 ml-1 text-sm">{{ v.guestName }}</strong></div>
                <div><span class="text-slate-500">Số điện thoại:</span> <span class="font-semibold text-slate-800 ml-1">{{ v.guestPhone }}</span></div>
                @if (v.guestEmail) {
                  <div><span class="text-slate-500">Email:</span> <span class="text-slate-800 ml-1">{{ v.guestEmail }}</span></div>
                }
                <div><span class="text-slate-500">Số khách:</span> <span class="font-semibold text-slate-800 ml-1">{{ v.guestCount }} người</span></div>
              </div>
            </div>

            <div class="space-y-3">
              <div class="text-xs font-bold text-slate-900 uppercase tracking-wider">Lịch Trình Lưu Trú</div>
              <div class="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-2 text-xs">
                <div><span class="text-slate-500">Hạng phòng:</span> <strong class="text-indigo-700 ml-1 text-sm">{{ v.roomTypeName }}</strong> ({{ v.roomCount }} phòng)</div>
                <div><span class="text-slate-500">Chế độ thuê:</span> <span class="font-semibold text-slate-800 ml-1">{{ v.rentalType }}</span></div>
                <div><span class="text-slate-500">Nhận phòng:</span> <strong class="text-slate-900 ml-1">{{ v.checkInDate }}</strong></div>
                <div><span class="text-slate-500">Trả phòng:</span> <strong class="text-slate-900 ml-1">{{ v.checkOutDate }}</strong></div>
              </div>
            </div>
          </div>

          <!-- Check-in QR & Instructions -->
          <div class="py-6 grid grid-cols-1 sm:grid-cols-3 gap-6 items-center border-b border-slate-200">
            <div class="flex justify-center sm:justify-start">
              @if (v.qrCodeUrl) {
                <img [src]="v.qrCodeUrl" alt="Check-in QR" class="w-32 h-32 object-contain rounded-xl border border-slate-200 p-1 bg-white shadow-2xs" />
              }
            </div>

            <div class="sm:col-span-2 space-y-2 text-xs text-slate-600">
              <div class="font-bold text-slate-900 uppercase tracking-wider">Hướng Dẫn Check-in Tại Quầy Lễ Tân</div>
              <ul class="space-y-1 list-disc list-inside text-slate-600">
                <li>Xuất trình mã đặt chỗ <strong>{{ v.confirmationCode }}</strong> hoặc mã QR trên khi đến cơ sở.</li>
                <li>Vui lòng mang theo Căn cước công dân hoặc Hộ chiếu gốc của tất cả khách lưu trú.</li>
                <li>Giữ chỗ được đảm bảo trong vòng 30 phút kể từ giờ hẹn nhận phòng.</li>
                <li>Liên hệ hotline khách sạn: <strong class="text-slate-900">{{ v.propertyPhone || v.hotelInfo.hotline }}</strong> khi cần hỗ trợ.</li>
              </ul>
            </div>
          </div>

          <!-- Price & Policy -->
          <div class="pt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-xs">
            <div class="text-slate-500 italic max-w-md">
              {{ v.hotelInfo.footerNote }}
            </div>
            <div class="sm:text-right">
              <div class="text-slate-500">Tổng tiền tạm tính:</div>
              <div class="text-2xl font-black text-indigo-700">{{ v.totalAmount | number:'1.0-0' }} ₫</div>
            </div>
          </div>
        </div>
      } @else if (isLoading()) {
        <div class="max-w-3xl mx-auto bg-white rounded-2xl p-12 text-center text-slate-500">
          <i class="pi pi-spin pi-spinner text-3xl mb-3 text-emerald-600"></i>
          <div>Đang khởi tạo phiếu xác nhận voucher...</div>
        </div>
      } @else {
        <div class="max-w-3xl mx-auto bg-white rounded-2xl p-12 text-center text-rose-500">
          <i class="pi pi-exclamation-triangle text-3xl mb-3"></i>
          <div>Không tìm thấy phiếu đặt phòng tương ứng.</div>
        </div>
      }
    </div>
  `,
  styles: [`
    @media print {
      body {
        background: white !important;
      }
      .print\\:hidden {
        display: none !important;
      }
    }
  `]
})
export class PrintVoucherPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly printService = inject(PrintDocumentsService);

  readonly voucher = signal<PrintVoucherDto | null>(null);
  readonly isLoading = signal(true);

  ngOnInit(): void {
    const token = this.route.snapshot.paramMap.get('token');
    if (token) {
      this.printService.getVoucher(token).subscribe({
        next: data => {
          this.voucher.set(data);
          this.isLoading.set(false);
        },
        error: () => {
          this.isLoading.set(false);
        }
      });
    } else {
      this.isLoading.set(false);
    }
  }

  windowPrint(): void {
    window.print();
  }
}
