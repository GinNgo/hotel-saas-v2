import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { PrintDocumentsService } from '../../core/services/print-documents.service';
import { PrintInvoiceDto } from '../../core/models/print-document.model';
import { BusinessDatePipe } from '../../shared/pipes/business-date.pipe';
import { VndCurrencyPipe } from '../../shared/pipes/vnd-currency.pipe';

@Component({
  selector: 'app-print-invoice-page',
  standalone: true,
  imports: [CommonModule, RouterModule, BusinessDatePipe, VndCurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-slate-100 p-4 sm:p-8 print:p-0 print:bg-white text-slate-800 font-sans">
      <!-- Action Toolbar (Hidden during print) -->
      <div class="max-w-4xl mx-auto mb-6 flex items-center justify-between print:hidden">
        <a
          routerLink="/reservations"
          class="inline-flex items-center gap-2 min-h-11 text-sm font-medium text-slate-600 hover:text-slate-900 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-2xs"
        >
          <i class="pi pi-arrow-left" aria-hidden="true"></i> Quay lại
        </a>

        <div class="flex items-center gap-3">
          <button
            type="button"
            (click)="windowPrint()"
            class="inline-flex items-center gap-2 min-h-11 px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors shadow-sm cursor-pointer"
          >
            <i class="pi pi-print" aria-hidden="true"></i> In Hóa Đơn (Ctrl + P)
          </button>
        </div>
      </div>

      <!-- Printable Invoice Sheet -->
      @if (invoice(); as inv) {
        <div class="max-w-4xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200/80 p-8 sm:p-12 print:shadow-none print:border-none print:p-0 print:max-w-none">
          <!-- Header Hotel Info -->
          <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6 pb-6 border-b-2 border-slate-900">
            <div class="space-y-1">
              <div class="flex items-center gap-3">
                @if (inv.logoUrl) {
                  <img [src]="inv.logoUrl" alt="Hotel Logo" width="48" height="48" class="h-12 w-auto object-contain rounded-lg border border-slate-200" />
                }
                <div>
                  <h1 class="text-xl sm:text-2xl font-black text-slate-900 tracking-tight uppercase">
                    {{ inv.headerCompanyName }}
                  </h1>
                  <p class="text-xs text-slate-500 font-medium">Hệ thống khách sạn & nghỉ dưỡng cao cấp</p>
                </div>
              </div>
              <div class="text-xs text-slate-600 pt-2 space-y-0.5">
                @if (inv.headerAddress) {
                  <div><span class="font-semibold text-slate-700">Địa chỉ:</span> {{ inv.headerAddress }}</div>
                }
                <div class="flex flex-wrap gap-4">
                  @if (inv.taxNumber) {
                    <span><span class="font-semibold text-slate-700">Mã số thuế:</span> {{ inv.taxNumber }}</span>
                  }
                  @if (inv.hotline) {
                    <span><span class="font-semibold text-slate-700">Hotline:</span> {{ inv.hotline }}</span>
                  }
                </div>
              </div>
            </div>

            <!-- Invoice Code & Date -->
            <div class="sm:text-right space-y-1 border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
              <div class="inline-block px-3 py-1 rounded-lg bg-slate-900 text-white font-mono font-bold text-sm tracking-wider uppercase">
                HÓA ĐƠN DỊCH VỤ
              </div>
              <div class="text-xs text-slate-500 font-mono mt-1">Số: <span class="font-bold text-slate-900">{{ inv.invoiceNumber }}</span></div>
              <div class="text-xs text-slate-500 font-mono">Mã đặt phòng: <span class="font-semibold text-slate-800">{{ inv.confirmationCode }}</span></div>
              <div class="text-xs text-slate-500">Ngày in: <span class="font-semibold text-slate-700 tabular-nums">{{ inv.issuedDate | businessDate }}</span></div>
              @if (inv.remainingAmount <= 0) {
                <div class="text-xs text-emerald-700 font-semibold flex sm:justify-end items-center gap-1">
                  <i class="pi pi-check-circle text-[11px]" aria-hidden="true"></i> {{ getStatusLabel(inv.status) }} ({{ getPaymentMethodLabel(inv.paymentMethod) }})
                </div>
              } @else {
                <div class="text-xs text-amber-700 font-semibold flex sm:justify-end items-center gap-1">
                  <i class="pi pi-clock text-[11px]" aria-hidden="true"></i> {{ getStatusLabel(inv.status) }} — Còn lại: <span class="tabular-nums">{{ inv.remainingAmount | vndCurrency }}</span>
                </div>
              }
            </div>
          </div>

          <!-- Customer & Stay Info -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 py-6 border-b border-slate-200 text-xs">
            <div class="space-y-1.5 p-3 rounded-xl bg-slate-50/70 border border-slate-100">
              <div class="font-bold text-slate-900 uppercase tracking-wider text-[11px] mb-1">Thông tin Khách hàng</div>
              <div><span class="text-slate-500">Họ và tên:</span> <span class="font-bold text-slate-900 text-sm ml-1">{{ inv.guestName }}</span></div>
              <div><span class="text-slate-500">Số điện thoại:</span> <span class="font-semibold text-slate-800 ml-1">{{ inv.guestPhone || '—' }}</span></div>
              @if (inv.guestEmail) {
                <div><span class="text-slate-500">Email:</span> <span class="font-semibold text-slate-800 ml-1">{{ inv.guestEmail }}</span></div>
              }
              <div><span class="text-slate-500">Cơ sở chi nhánh:</span> <span class="font-semibold text-slate-800 ml-1">{{ inv.propertyName || inv.headerCompanyName }}</span></div>
            </div>

            <div class="space-y-1.5 p-3 rounded-xl bg-slate-50/70 border border-slate-100">
              <div class="font-bold text-slate-900 uppercase tracking-wider text-[11px] mb-1">Thông tin Phòng lưu trú</div>
              <div class="flex justify-between">
                <div><span class="text-slate-500">Số phòng:</span> <span class="font-extrabold text-indigo-700 text-sm ml-1">{{ inv.roomNumber || '—' }}</span></div>
                <div><span class="text-slate-500">Hạng:</span> <span class="font-semibold text-slate-800 ml-1">{{ inv.roomTypeName || '—' }}</span></div>
              </div>
              <div><span class="text-slate-500">Thời gian ở:</span> <span class="font-semibold text-slate-800 ml-1 tabular-nums">{{ inv.checkInDate | businessDate }} — {{ inv.checkOutDate | businessDate }}</span></div>
              <div><span class="text-slate-500">Chế độ thuê / Số khách:</span> <span class="font-semibold text-slate-800 ml-1">{{ getRentalTypeLabel(inv.rentalType) }} ({{ inv.numberOfGuests }} khách)</span></div>
            </div>
          </div>

          <!-- Charges Breakdown Table -->
          <div class="py-6">
            <div class="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">Chi tiết tiền phòng & dịch vụ</div>
            <table class="w-full text-xs text-left border border-slate-200 rounded-xl overflow-hidden">
              <thead class="bg-slate-100 text-slate-700 font-bold uppercase text-[11px]">
                <tr>
                  <th class="py-2.5 px-3">STT</th>
                  <th class="py-2.5 px-3">Nội dung thanh toán</th>
                  <th class="py-2.5 px-3 text-center">Số lượng</th>
                  <th class="py-2.5 px-3 text-right">Đơn giá</th>
                  <th class="py-2.5 px-3 text-right">Thành tiền (VNĐ)</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                @for (item of inv.items; track $index) {
                  <tr>
                    <td class="py-2.5 px-3 text-slate-500 text-center">{{ $index + 1 }}</td>
                    <td class="py-2.5 px-3">
                      <div class="font-semibold text-slate-900">{{ item.description }}</div>
                    </td>
                    <td class="py-2.5 px-3 text-center tabular-nums">{{ item.quantity }}</td>
                    <td class="py-2.5 px-3 text-right tabular-nums">{{ item.unitPrice | vndCurrency }}</td>
                    <td class="py-2.5 px-3 text-right font-bold text-slate-900 tabular-nums">{{ item.amount | vndCurrency }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <!-- Totals and VietQR Section -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2 pb-6 border-b border-slate-200">
            <!-- Left: VietQR Instant Transfer -->
            <div class="flex items-start gap-4 p-3.5 rounded-xl border border-slate-200 bg-slate-50/50">
              @if (inv.remainingAmount <= 0) {
                <div class="text-xs space-y-1 text-emerald-700">
                  <div class="font-bold flex items-center gap-1.5">
                    <i class="pi pi-check-circle"></i> Đã hoàn tất thanh toán
                  </div>
                  <div class="text-slate-600">Toàn bộ công nợ cho hóa đơn {{ inv.invoiceNumber }} đã được thanh toán đầy đủ.</div>
                </div>
              } @else if (inv.bankAccountNumber) {
                @if (inv.vietQrImageUrl && inv.showVietQrCode) {
                  <img [src]="inv.vietQrImageUrl" alt="VietQR" width="112" height="112" loading="lazy" class="w-28 h-28 object-contain rounded-lg border border-slate-200 bg-white p-1" />
                }
                <div class="text-xs space-y-1">
                  <div class="font-bold text-slate-900 flex items-center gap-1.5">
                    <i class="pi pi-qrcode text-indigo-600"></i> Thanh toán VietQR 24/7
                  </div>
                  <div class="text-slate-600">Ngân hàng: <strong class="text-slate-900">{{ inv.bankName }}</strong></div>
                  <div class="text-slate-600">STK: <strong class="text-indigo-700 font-mono">{{ inv.bankAccountNumber }}</strong></div>
                  @if (inv.bankAccountHolder) {
                    <div class="text-slate-600">Chủ TK: <strong class="text-slate-900">{{ inv.bankAccountHolder }}</strong></div>
                  }
                  <div class="text-[11px] text-slate-500 pt-1">Quét mã bằng app ngân hàng bất kỳ để thanh toán phần còn lại.</div>
                </div>
              } @else {
                <div class="text-xs space-y-1 text-slate-600">
                  <div class="font-bold text-slate-800 flex items-center gap-1.5">
                    <i class="pi pi-info-circle text-amber-600"></i> Chưa cấu hình tài khoản VietQR
                  </div>
                  <div>Cơ sở chưa cấu hình tài khoản ngân hàng nhận chuyển khoản. Vui lòng thanh toán tại quầy lễ tân.</div>
                </div>
              }
            </div>

            <!-- Right: Subtotal, VAT, Grand Total -->
            <div class="space-y-2 text-xs">
              <div class="flex justify-between py-1 text-slate-600">
                <span>Tiền phòng & Dịch vụ (trước thuế):</span>
                <span class="font-semibold text-slate-800 tabular-nums">{{ inv.subTotal | vndCurrency }}</span>
              </div>
              <div class="flex justify-between py-1 text-slate-600 border-t border-slate-100">
                <span>Thuế GTGT (VAT {{ inv.vatRate }}%):</span>
                <span class="font-semibold text-slate-800 tabular-nums">{{ inv.vatAmount | vndCurrency }}</span>
              </div>
              <div class="flex justify-between py-2 text-sm border-t-2 border-slate-900 font-black">
                <span class="text-slate-900 uppercase">TỔNG THANH TOÁN:</span>
                <span class="text-indigo-700 text-base tabular-nums">{{ inv.totalAmount | vndCurrency }}</span>
              </div>
              <div class="flex justify-between py-1 text-slate-600">
                <span>Đã thanh toán:</span>
                <span class="font-bold text-emerald-600 tabular-nums">{{ inv.paidAmount | vndCurrency }}</span>
              </div>
              @if (inv.remainingAmount > 0) {
                <div class="flex justify-between py-1 text-rose-600 font-bold">
                  <span>Còn lại cần thanh toán:</span>
                  <span class="tabular-nums">{{ inv.remainingAmount | vndCurrency }}</span>
                </div>
              }
            </div>
          </div>

          <!-- Policies and Footer Note -->
          <div class="pt-4 pb-8 border-b border-slate-200 text-[11px] text-slate-500 space-y-1">
            @if (inv.checkInPolicyText) {
              <div><strong class="text-slate-700">Quy định cơ sở:</strong> {{ inv.checkInPolicyText }}</div>
            }
            @if (inv.footerNote) {
              <div class="italic">{{ inv.footerNote }}</div>
            }
          </div>

          <!-- Signatures Section -->
          <div class="grid grid-cols-2 gap-8 pt-8 text-center text-xs">
            <div>
              <div class="font-bold text-slate-900 uppercase tracking-wider">Khách Hàng</div>
              <div class="text-[11px] text-slate-400 italic">(Ký và ghi rõ họ tên)</div>
              <div class="h-20"></div>
              <div class="font-semibold text-slate-800">{{ inv.guestName }}</div>
            </div>

            <div>
              <div class="font-bold text-slate-900 uppercase tracking-wider">Đại Diện Khách Sạn</div>
              <div class="text-[11px] text-slate-400 italic">(Ký xác nhận & đóng dấu)</div>
              <div class="h-20 flex items-center justify-center">
                @if (inv.remainingAmount <= 0) {
                  <div class="border-2 border-dashed border-emerald-500/60 rounded-full px-4 py-1 text-emerald-600 font-bold uppercase text-[10px] rotate-[-5deg]">
                    ĐÃ XÁC NHẬN THANH TOÁN
                  </div>
                } @else {
                  <div class="border border-dashed border-amber-400 rounded-full px-4 py-1 text-amber-700 font-semibold uppercase text-[10px]">
                    CHỜ THANH TOÁN ĐỦ
                  </div>
                }
              </div>
              <div class="font-semibold text-slate-800">Bộ phận Thu Ngân / Lễ Tân</div>
            </div>
          </div>
        </div>
      } @else if (isLoading()) {
        <div class="max-w-4xl mx-auto bg-white rounded-2xl p-12 text-center text-slate-500">
          <i class="pi pi-spin pi-spinner text-3xl mb-3 text-indigo-600"></i>
          <div>Đang khởi tạo phiếu in hóa đơn điện tử...</div>
        </div>
      } @else {
        <div class="max-w-4xl mx-auto bg-white rounded-2xl p-12 text-center text-rose-500">
          <i class="pi pi-exclamation-triangle text-3xl mb-3"></i>
          <div>Không tìm thấy hóa đơn hoặc mã đặt phòng không hợp lệ.</div>
        </div>
      }
    </div>
  `,
  styles: [`
    @media print {
      body {
        background: white !important;
        color: black !important;
      }
      .print\\:hidden {
        display: none !important;
      }
    }
  `]
})
export class PrintInvoicePage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly printService = inject(PrintDocumentsService);
  private readonly destroyRef = inject(DestroyRef);

  readonly invoice = signal<PrintInvoiceDto | null>(null);
  readonly isLoading = signal(true);

  ngOnInit(): void {
    const reservationId = this.route.snapshot.paramMap.get('id');
    const code = this.route.snapshot.queryParamMap?.get('code') ?? undefined;
    if (reservationId) {
      const request$ = code
        ? this.printService.getInvoice(reservationId, code)
        : this.printService.getInvoice(reservationId);
      request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: data => {
          this.invoice.set(data);
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

  isPaidInFull(inv: PrintInvoiceDto): boolean {
    return inv.remainingAmount <= 0;
  }

  getStatusLabel(status?: string | null): string {
    switch ((status || '').toLowerCase()) {
      case 'paid': return 'Đã thanh toán';
      case 'partiallypaid': return 'Thanh toán một phần';
      case 'pending':
      case 'pendingpayment':
      case 'unpaid': return 'Chờ thanh toán';
      case 'refunded': return 'Đã hoàn tiền';
      case 'cancelled': return 'Đã hủy';
      default: return status || 'Đang xử lý';
    }
  }

  getPaymentMethodLabel(method?: string | null): string {
    switch ((method || '').toLowerCase()) {
      case 'cash': return 'Tiền mặt';
      case 'banktransfer':
      case 'transfer': return 'Chuyển khoản / QR';
      case 'creditcard':
      case 'card': return 'Thẻ tín dụng';
      case 'vnpay': return 'VNPay';
      case 'pending': return 'Chưa thu';
      default: return method || 'Khác';
    }
  }

  getRentalTypeLabel(rentalType?: string | null): string {
    switch ((rentalType || '').toLowerCase()) {
      case 'overnight': return 'Qua đêm';
      case 'daily': return 'Theo ngày';
      case 'hourly': return 'Theo giờ';
      default: return rentalType || 'Lưu trú';
    }
  }

  windowPrint(): void {
    window.print();
  }
}
