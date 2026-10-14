import {

  ChangeDetectionStrategy,

  Component,

  computed,

  inject,

  OnInit,

  signal,

} from '@angular/core';

import { CommonModule } from '@angular/common';

import { FormsModule } from '@angular/forms';

import { RouterLink } from '@angular/router';



export type ProfileTab = 'overview' | 'bookings_invoices' | 'loyalty_wallet' | 'memberships' | 'settings';



export type PointTxType = 'Earned' | 'Redeemed' | 'Refunded' | 'Bonus';



export interface GuestLoyaltyMembershipCard {

  membershipId: string;

  tenantId: string;

  tenantBrandName: string;

  enrolledPropertyId: string;

  enrolledPropertyName: string;

  memberCode: string;

  tier: 'Silver' | 'Gold' | 'Diamond';

  pointsBalance: number;

  pendingPoints: number;

  totalStays: number;

  discountPercent: number;

  nextTierName: string;

  staysToNextTier: number;

  joinedAt: string;

}



export interface LoyaltyPointLedgerItem {

  id: string;

  createdAt: string;

  tenantBrandName: string;

  propertyName: string;

  reservationCode: string;

  type: PointTxType;

  pointsDelta: number; // Dương (+): Cộng/Hoàn điểm | Âm (-): Dùng điểm thanh toán

  balanceAfter: number;

  description: string;

}



export interface GuestFolioLineItem {

  id: string;

  itemType: 'RoomCharge' | 'Surcharge' | 'Service' | 'Discount' | 'PointsRedemption';

  description: string;

  quantity: number;

  unitPrice: number;

  amount: number; // Âm nếu là giảm giá / dùng điểm

}



export interface GuestInvoiceRecord {

  invoiceId: string;

  invoiceNumber: string;

  reservationId: string;

  reservationCode: string;

  tenantBrandName: string;

  propertyName: string;

  propertyType: 'Hotel' | 'Motel' | 'Guesthouse' | 'Homestay' | 'Resort';

  propertyAddress: string;

  propertyTaxCode: string;

  rentalType: 'Hourly' | 'Overnight' | 'Daily';

  checkInTime: string;

  checkOutTime: string;

  roomName: string;

  roomNumber: string;

  status: 'Paid' | 'PartiallyPaid' | 'Refunded' | 'Cancelled';

  subTotal: number;

  surchargeTotal: number;

  discountTotal: number;

  pointsUsed: number;

  pointsDiscountAmount: number;

  pointsEarned: number;

  PointsRefunded: number;

  taxAmount: number;

  grandTotal: number;

  paidAmount: number;

  paymentMethod: string;

  issuedAt: string;

  lineItems: GuestFolioLineItem[];

}



@Component({

  selector: 'app-guest-profile-page',

  standalone: true,

  imports: [CommonModule, FormsModule, RouterLink],

  changeDetection: ChangeDetectionStrategy.OnPush,

  template: `

    <div class="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8 print:bg-white print:p-0">

      <div class="max-w-7xl mx-auto">

        <!-- 1. HEADER HỒ SƠ KHÁCH HÀNG & TỔNG QUAN VÍ ĐIỂM (Ẩn khi in hóa đơn) -->

        <section

          class="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl mb-6 print:hidden"

        >

          <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-6">

            <div class="flex items-center gap-4">

              <div

                class="w-16 h-16 rounded-2xl bg-indigo-500/30 border-2 border-indigo-400/50 flex items-center justify-center text-2xl font-extrabold text-white shrink-0"

              >

                {{ guestProfile().fullName.charAt(0) }}

              </div>

              <div>

                <div class="flex flex-wrap items-center gap-2">

                  <h1 class="text-xl sm:text-2xl font-extrabold">

                    {{ guestProfile().fullName }}

                  </h1>

                  <span

                    class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-400 text-slate-950 flex items-center gap-1"

                  >

                    <i class="pi pi-crown text-[11px]"></i>

                    <span>Thành viên {{ primaryMembership()?.tier || 'Gold' }}</span>

                  </span>

                </div>

                <p class="text-xs sm:text-sm text-indigo-200 mt-1">

                  {{ guestProfile().phone }} • {{ guestProfile().email }}

                </p>

                <p class="text-xs text-emerald-300 mt-1 flex items-center gap-1.5">

                  <i class="pi pi-check-circle"></i>

                  <span>

                    Đã liên kết {{ memberships().length }} Chuỗi khách sạn / Cơ sở lưu trú

                  </span>

                </p>

              </div>

            </div>



            <!-- Cụm KPI Điểm thưởng & Chi tiêu -->

            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">

              <div class="bg-white/10 backdrop-blur-xs rounded-2xl p-3.5 border border-white/10">

                <span class="text-[11px] text-indigo-200 block">Tổng điểm khả dụng</span>

                <span class="text-xl font-extrabold text-amber-300">

                  {{ totalAvailablePoints() | number: '1.0-0' }} điểm

                </span>

                <span class="text-[11px] text-emerald-300 block mt-0.5">

                  ≈ {{ totalAvailablePoints() * 1000 | number: '1.0-0' }}đ thanh toán

                </span>

              </div>



              <div class="bg-white/10 backdrop-blur-xs rounded-2xl p-3.5 border border-white/10">

                <span class="text-[11px] text-indigo-200 block">Điểm đã hoàn trả</span>

                <span class="text-xl font-extrabold text-sky-300">

                  +{{ totalRefundedPoints() | number: '1.0-0' }} điểm

                </span>

                <span class="text-[11px] text-indigo-200 block mt-0.5">

                  Do hủy đặt phòng hợp lệ

                </span>

              </div>



              <div class="bg-white/10 backdrop-blur-xs rounded-2xl p-3.5 border border-white/10">

                <span class="text-[11px] text-indigo-200 block">Lượt lưu trú hoàn tất</span>

                <span class="text-xl font-extrabold text-white">

                  {{ invoices().length }} lần

                </span>

                <span class="text-[11px] text-indigo-200 block mt-0.5">

                  Theo giờ • Qua đêm • Ngày

                </span>

              </div>



              <div class="bg-white/10 backdrop-blur-xs rounded-2xl p-3.5 border border-white/10">

                <span class="text-[11px] text-indigo-200 block">Ưu đãi thành viên</span>

                <span class="text-xl font-extrabold text-emerald-300">

                  Giảm tới 12%

                </span>

                <span class="text-[11px] text-indigo-200 block mt-0.5">

                  Tự động áp dụng khi đặt

                </span>

              </div>

            </div>

          </div>



          <!-- Thanh Tabs Điều hướng trong Profile -->

          <div class="flex flex-wrap gap-2 mt-6 pt-5 border-t border-white/15">

            @for (tab of navTabs; track tab.id) {

              <button

                type="button"

                (click)="activeTab.set(tab.id)"

                class="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer"

                [class.bg-white]="activeTab() === tab.id"

                [class.text-slate-900]="activeTab() === tab.id"

                [class.shadow-md]="activeTab() === tab.id"

                [class.text-indigo-100]="activeTab() !== tab.id"

                [class.hover:bg-white/10]="activeTab() !== tab.id"

              >

                <i [class]="tab.icon"></i>

                <span>{{ tab.label }}</span>

              </button>

            }

          </div>

        </section>



        <!-- 2. NỘI DUNG TỪNG TAB (Ẩn khi đang mở chế độ In Hóa đơn) -->

        <div class="print:hidden">

          @switch (activeTab()) {

            <!-- TAB 1: DANH SÁCH ĐẶT PHÒNG, HÓA ĐƠN, IN & XUẤT FILE -->

            @case ('bookings_invoices') {

              <section class="bg-white rounded-2xl shadow-xs border border-slate-200 p-6">

                <div

                  class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 mb-5 border-b border-slate-100"

                >

                  <div>

                    <h2 class="text-lg font-extrabold text-slate-900">

                      Lịch sử Đặt phòng & Hóa đơn Điện tử (Folio)

                    </h2>

                    <p class="text-xs text-slate-500 mt-0.5">

                      Xem bảng kê chi tiết tiền phòng, phụ thu quá giờ, điểm đã trừ/hoàn trả, in

                      hóa đơn hoặc xuất file kế toán.

                    </p>

                  </div>



                  <!-- Cụm nút Xuất File Tổng hợp -->

                  <div class="flex flex-wrap items-center gap-2">

                    <button

                      type="button"

                      (click)="exportAllInvoicesCsv()"

                      class="px-3.5 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center gap-1.5 cursor-pointer"

                    >

                      <i class="pi pi-file-excel text-emerald-600"></i>

                      <span>Xuất bảng kê CSV / Excel</span>

                    </button>

                  </div>

                </div>



                <!-- Danh sách Hóa đơn -->

                <div class="space-y-4">

                  @for (inv of invoices(); track inv.invoiceId) {

                    <div

                      class="rounded-2xl border border-slate-200 p-4 sm:p-5 hover:border-indigo-300 transition-all bg-white"

                    >

                      <div class="flex flex-wrap items-start justify-between gap-4">

                        <div class="space-y-1">

                          <div class="flex flex-wrap items-center gap-2">

                            <span

                              class="text-xs font-extrabold px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700"

                            >

                              #{{ inv.invoiceNumber }}

                            </span>

                            <span class="text-xs font-semibold text-slate-500">

                              Mã đặt phòng: {{ inv.reservationCode }}

                            </span>

                            <span

                              class="text-xs font-bold px-2.5 py-0.5 rounded-full"

                              [class.bg-emerald-100]="inv.status === 'Paid'"

                              [class.text-emerald-700]="inv.status === 'Paid'"

                              [class.bg-amber-100]="inv.status === 'PartiallyPaid'"

                              [class.text-amber-800]="inv.status === 'PartiallyPaid'"

                              [class.bg-rose-100]="inv.status === 'Refunded' || inv.status === 'Cancelled'"

                              [class.text-rose-700]="inv.status === 'Refunded' || inv.status === 'Cancelled'"

                            >

                              {{ getInvoiceStatusLabel(inv.status) }}

                            </span>

                          </div>



                          <h3 class="text-base font-extrabold text-slate-900 mt-1">

                            {{ inv.propertyName }}

                            <span class="text-xs font-normal text-slate-500">

                              ({{ inv.tenantBrandName }})

                            </span>

                          </h3>



                          <p class="text-xs text-slate-500">

                            <i class="pi pi-clock mr-1 text-indigo-600"></i>

                            <span>

                              Hình thức:

                              <strong>{{ getRentalTypeLabel(inv.rentalType) }}</strong> • Phòng

                              {{ inv.roomNumber }} ({{ inv.roomName }}) • Nhận:

                              {{ inv.checkInTime }} → Trả: {{ inv.checkOutTime }}

                            </span>

                          </p>



                          <!-- Dòng thông tin Điểm thưởng của Hóa đơn này -->

                          <div class="flex flex-wrap items-center gap-2 pt-1.5">

                            @if (inv.pointsUsed > 0) {

                              <span

                                class="text-[11px] font-semibold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700"

                              >

                                Đã dùng {{ inv.pointsUsed }} điểm (-{{

                                  inv.pointsDiscountAmount | number: '1.0-0'

                                }}đ)

                              </span>

                            }

                            @if (inv.pointsEarned > 0) {

                              <span

                                class="text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700"

                              >

                                +{{ inv.pointsEarned }} điểm tích lũy

                              </span>

                            }

                            @if (inv.PointsRefunded > 0) {

                              <span

                                class="text-[11px] font-semibold px-2 py-0.5 rounded bg-sky-50 text-sky-700"

                              >

                                Đã hoàn lại +{{ inv.PointsRefunded }} điểm vào ví

                              </span>

                            }

                          </div>

                        </div>



                        <!-- Cột Tổng tiền & Các nút Xem / In / Tải Hóa đơn -->

                        <div class="text-right space-y-2">

                          <div>

                            <span class="text-xs text-slate-400 block">Tổng thanh toán</span>

                            <span class="text-xl font-extrabold text-slate-900">

                              {{ inv.grandTotal | number: '1.0-0' }}đ

                            </span>

                            <span class="text-[11px] text-slate-500 block">

                              {{ inv.paymentMethod }}

                            </span>

                          </div>



                          <div class="flex flex-wrap items-center justify-end gap-2 pt-1">

                            <button

                              type="button"

                              (click)="openInvoiceModal(inv)"

                              class="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer"

                            >

                              <i class="pi pi-eye"></i>

                              <span>Xem chi tiết</span>

                            </button>



                            <button

                              type="button"

                              (click)="printSingleInvoice(inv)"

                              class="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer"

                            >

                              <i class="pi pi-print"></i>

                              <span>In hóa đơn</span>

                            </button>



                            <button

                              type="button"

                              (click)="downloadInvoiceJsonOrText(inv)"

                              class="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer"

                            >

                              <i class="pi pi-download"></i>

                              <span>Xuất file</span>

                            </button>

                          </div>

                        </div>

                      </div>

                    </div>

                  }

                </div>

              </section>

            }



            <!-- TAB 2: VÍ ĐIỂM THƯỞNG, LỊCH SỬ CỘNG ĐIỂM & HOÀN TRẢ ĐIỂM -->

            @case ('loyalty_wallet') {

              <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">

                <!-- Cột trái: Quy tắc tích/tiêu/hoàn điểm -->

                <div class="lg:col-span-4 space-y-4">

                  <div class="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">

                    <h3 class="text-base font-extrabold text-slate-900 mb-3 flex items-center gap-2">

                      <i class="pi pi-wallet text-indigo-600"></i>

                      <span>Cơ chế Điểm thưởng & Hoàn điểm</span>

                    </h3>

                    <ul class="space-y-3 text-xs text-slate-600 leading-relaxed">

                      <li class="flex items-start gap-2">

                        <i class="pi pi-check-circle text-emerald-600 mt-0.5"></i>

                        <span>

                          <strong>Tỷ lệ quy đổi:</strong> 1 điểm = <strong>1.000 VNĐ</strong> trừ

                          trực tiếp vào hóa đơn đặt phòng (Theo giờ, Qua đêm, Theo ngày).

                        </span>

                      </li>

                      <li class="flex items-start gap-2">

                        <i class="pi pi-check-circle text-emerald-600 mt-0.5"></i>

                        <span>

                          <strong>Cộng điểm tự động:</strong> Ngay khi Lễ tân xác nhận Check-out và

                          tất toán hóa đơn, hệ thống cộng từ <strong>2% - 6%</strong> giá trị thực

                          trả thành điểm.

                        </span>

                      </li>

                      <li class="flex items-start gap-2">

                        <i class="pi pi-refresh text-sky-600 mt-0.5"></i>

                        <span>

                          <strong>Hoàn trả điểm 100% tức thì:</strong> Nếu bạn dùng điểm để đặt

                          phòng nhưng sau đó hủy đơn hợp lệ hoặc hết thời gian giữ chỗ, toàn bộ số

                          điểm đã trừ được tự động hoàn trả lại ví.

                        </span>

                      </li>

                    </ul>

                  </div>

                </div>



                <!-- Cột phải: Sổ cái biến động điểm (Point Ledger) -->

                <div class="lg:col-span-8 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">

                  <div class="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b border-slate-100">

                    <h3 class="text-base font-extrabold text-slate-900">

                      Sổ cái Giao dịch Điểm (Cộng điểm • Thanh toán • Hoàn trả)

                    </h3>

                    <div class="flex gap-1.5">

                      @for (filter of pointFilterOptions; track filter.value) {

                        <button

                          type="button"

                          (click)="selectedPointFilter.set(filter.value)"

                          class="px-3 py-1 rounded-lg text-xs font-bold cursor-pointer"

                          [class.bg-indigo-600]="selectedPointFilter() === filter.value"

                          [class.text-white]="selectedPointFilter() === filter.value"

                          [class.bg-slate-100]="selectedPointFilter() !== filter.value"

                          [class.text-slate-600]="selectedPointFilter() !== filter.value"

                        >

                          {{ filter.label }}

                        </button>

                      }

                    </div>

                  </div>



                  <div class="divide-y divide-slate-100">

                    @for (tx of filteredPointLedger(); track tx.id) {

                      <div class="py-3.5 flex items-center justify-between gap-4">

                        <div class="flex items-start gap-3">

                          <span

                            class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-sm font-bold"

                            [class.bg-emerald-100]="tx.type === 'Earned' || tx.type === 'Bonus'"

                            [class.text-emerald-700]="tx.type === 'Earned' || tx.type === 'Bonus'"

                            [class.bg-rose-100]="tx.type === 'Redeemed'"

                            [class.text-rose-700]="tx.type === 'Redeemed'"

                            [class.bg-sky-100]="tx.type === 'Refunded'"

                            [class.text-sky-700]="tx.type === 'Refunded'"

                          >

                            @if (tx.type === 'Refunded') {

                              <i class="pi pi-replay"></i>

                            } @else if (tx.pointsDelta > 0) {

                              <i class="pi pi-arrow-up-right"></i>

                            } @else {

                              <i class="pi pi-arrow-down-left"></i>

                            }

                          </span>



                          <div>

                            <p class="text-sm font-bold text-slate-900">

                              {{ tx.description }}

                            </p>

                            <p class="text-xs text-slate-500 mt-0.5">

                              {{ tx.propertyName }} ({{ tx.tenantBrandName }}) • Mã đơn:

                              <strong>{{ tx.reservationCode }}</strong> • {{ tx.createdAt }}

                            </p>

                          </div>

                        </div>



                        <div class="text-right shrink-0">

                          <span

                            class="text-sm font-extrabold block"

                            [class.text-emerald-600]="tx.pointsDelta > 0 && tx.type !== 'Refunded'"

                            [class.text-sky-600]="tx.type === 'Refunded'"

                            [class.text-rose-600]="tx.pointsDelta < 0"

                          >

                            {{ tx.pointsDelta > 0 ? '+' : '' }}{{ tx.pointsDelta }} điểm

                          </span>

                          <span class="text-[11px] text-slate-400">

                            Số dư sau GD: {{ tx.balanceAfter }} điểm

                          </span>

                        </div>

                      </div>

                    }

                  </div>

                </div>

              </div>

            }



            <!-- TAB 3: THẺ THÀNH VIÊN CƠ SỞ & ĐĂNG KÝ THÀNH VIÊN MỚI -->

            @case ('memberships') {

              <div class="space-y-6">

                <!-- Danh sách thẻ thành viên đã đăng ký -->

                <div class="bg-white rounded-2xl border border-slate-200 p-6">

                  <div class="flex flex-wrap items-center justify-between gap-4 mb-5">

                    <div>

                      <h2 class="text-lg font-extrabold text-slate-900">

                        Thẻ Thành viên Chuỗi & Cơ sở Đang Sở hữu

                      </h2>

                      <p class="text-xs text-slate-500">

                        Mỗi thẻ thành viên áp dụng xuyên suốt tất cả chi nhánh thuộc cùng một

                        Tenant Chính và tích điểm riêng minh bạch.

                      </p>

                    </div>

                  </div>



                  <div class="grid grid-cols-1 md:grid-cols-2 gap-5">

                    @for (card of memberships(); track card.membershipId) {

                      <div

                        class="rounded-2xl p-5 text-white shadow-lg relative overflow-hidden bg-gradient-to-br from-indigo-900 via-slate-900 to-indigo-950 border border-indigo-400/30"

                      >

                        <div class="flex items-start justify-between">

                          <div>

                            <span

                              class="text-[10px] uppercase tracking-widest text-indigo-300 font-bold"

                            >

                              Chuỗi thương hiệu (Tenant)

                            </span>

                            <h3 class="text-lg font-extrabold mt-0.5">

                              {{ card.tenantBrandName }}

                            </h3>

                            <p class="text-xs text-indigo-200 mt-0.5">

                              Cơ sở đăng ký gốc: {{ card.enrolledPropertyName }}

                            </p>

                          </div>



                          <span

                            class="px-3 py-1 rounded-full text-xs font-extrabold bg-amber-400 text-slate-950"

                          >

                            Hạng {{ card.tier }} (-{{ card.discountPercent }}%)

                          </span>

                        </div>



                        <div class="grid grid-cols-3 gap-3 my-5 pt-4 border-t border-white/15">

                          <div>

                            <span class="text-[11px] text-indigo-200 block">Mã thẻ</span>

                            <span class="text-sm font-mono font-bold">{{ card.memberCode }}</span>

                          </div>

                          <div>

                            <span class="text-[11px] text-indigo-200 block">Số dư điểm</span>

                            <span class="text-base font-extrabold text-amber-300">

                              {{ card.pointsBalance }} điểm

                            </span>

                          </div>

                          <div>

                            <span class="text-[11px] text-indigo-200 block">Số lần ở</span>

                            <span class="text-sm font-bold">{{ card.totalStays }} lượt</span>

                          </div>

                        </div>



                        <div class="flex items-center justify-between text-xs text-indigo-200">

                          <span>

                            Còn {{ card.staysToNextTier }} lượt ở để lên hạng

                            <strong class="text-white">{{ card.nextTierName }}</strong>

                          </span>

                          <a

                            routerLink="/booking"

                            class="px-3 py-1.5 rounded-lg bg-white text-slate-900 font-bold hover:bg-indigo-50"

                          >

                            Đặt phòng dùng điểm

                          </a>

                        </div>

                      </div>

                    }

                  </div>

                </div>



                <!-- Khu vực Đăng ký Thành viên Cơ sở mới (1 chạm) -->

                <div class="bg-white rounded-2xl border border-slate-200 p-6">

                  <h3 class="text-base font-extrabold text-slate-900 mb-1">

                    Đăng ký Thành viên Cơ sở / Chuỗi Lưu trú Mới (Miễn phí)

                  </h3>

                  <p class="text-xs text-slate-500 mb-4">

                    Nhận ngay <strong>+50 điểm thưởng chào mừng (50.000đ)</strong> và giảm giá

                    trực tiếp khi đặt phòng theo giờ, qua đêm hoặc theo ngày tại cơ sở.

                  </p>



                  <div class="grid grid-cols-1 md:grid-cols-3 gap-4">

                    @for (avail of availablePropertiesToJoin(); track avail.propertyId) {

                      <div

                        class="rounded-2xl border border-slate-200 p-4 flex flex-col justify-between gap-3 bg-slate-50/60"

                      >

                        <div>

                          <span

                            class="text-[11px] font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-700"

                          >

                            {{ avail.tenantBrandName }}

                          </span>

                          <h4 class="font-bold text-sm text-slate-900 mt-1.5">

                            {{ avail.propertyName }}

                          </h4>

                          <p class="text-xs text-slate-500 mt-0.5">

                            {{ avail.location }} • Ưu đãi thành viên mới: Giảm

                            {{ avail.welcomeDiscountPercent }}% + Tặng {{ avail.welcomePoints }}

                            điểm

                          </p>

                        </div>



                        <button

                          type="button"

                          (click)="enrollPropertyMembership(avail)"

                          class="w-full py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer transition-all"

                        >

                          + Đăng ký thành viên cơ sở này

                        </button>

                      </div>

                    }

                  </div>

                </div>

              </div>

            }



            <!-- TAB 4: CÀI ĐẶT HỒ SƠ & THÔNG TIN XUẤT HÓA ĐƠN VAT -->

            @default {

              <div class="bg-white rounded-2xl border border-slate-200 p-6 max-w-3xl">

                <h2 class="text-lg font-extrabold text-slate-900 mb-4">

                  Thông tin Cá nhân & Cấu hình Xuất Hóa đơn Công ty (VAT)

                </h2>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">

                  <div>

                    <label class="block text-xs font-bold text-slate-600 mb-1">Họ và tên</label>

                    <input

                      type="text"

                      [(ngModel)]="guestProfile().fullName"

                      class="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"

                    />

                  </div>

                  <div>

                    <label class="block text-xs font-bold text-slate-600 mb-1">Số điện thoại</label>

                    <input

                      type="text"

                      [(ngModel)]="guestProfile().phone"

                      class="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"

                    />

                  </div>

                  <div>

                    <label class="block text-xs font-bold text-slate-600 mb-1">

                      Tên Công ty (In lên hóa đơn)

                    </label>

                    <input

                      type="text"

                      [(ngModel)]="guestProfile().companyName"

                      class="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"

                    />

                  </div>

                  <div>

                    <label class="block text-xs font-bold text-slate-600 mb-1">

                      Mã số thuế (Tax ID)

                    </label>

                    <input

                      type="text"

                      [(ngModel)]="guestProfile().companyTaxCode"

                      class="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"

                    />

                  </div>

                  <div class="sm:col-span-2">

                    <label class="block text-xs font-bold text-slate-600 mb-1">

                      Địa chỉ pháp lý xuất hóa đơn

                    </label>

                    <input

                      type="text"

                      [(ngModel)]="guestProfile().companyAddress"

                      class="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"

                    />

                  </div>

                </div>

              </div>

            }

          }

        </div>



        <!-- 3. MODAL XEM CHI TIẾT HÓA ĐƠN & CHẾ ĐỘ IN CHUẨN A4 (HIỂN THỊ KHI CHỌN HÓA ĐƠN) -->

        @if (selectedInvoice(); as inv) {

          <div

            class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto print:static print:bg-white print:p-0"

          >

            <div

              class="bg-white rounded-3xl max-w-3xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 print:shadow-none print:border-none print:rounded-none"

            >

              <!-- Thanh công cụ Modal (Ẩn khi bấm Print) -->

              <div

                class="flex items-center justify-between pb-4 mb-6 border-b border-slate-200 print:hidden"

              >

                <span class="text-xs font-bold uppercase tracking-wider text-indigo-600">

                  Chứng từ Hóa đơn & Bảng kê Folio

                </span>

                <div class="flex items-center gap-2">

                  <button

                    type="button"

                    (click)="triggerBrowserPrint()"

                    class="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"

                  >

                    <i class="pi pi-print"></i>

                    <span>In Hóa đơn / Lưu PDF</span>

                  </button>

                  <button

                    type="button"

                    (click)="downloadInvoiceJsonOrText(inv)"

                    class="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"

                  >

                    <i class="pi pi-download"></i>

                    <span>Tải file CSV</span>

                  </button>

                  <button

                    type="button"

                    (click)="selectedInvoice.set(null)"

                    class="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer"

                  >

                    <i class="pi pi-times"></i>

                  </button>

                </div>

              </div>



              <!-- Nội dung Bản In Hóa đơn Chuẩn -->

              <div class="space-y-6 text-slate-800">

                <div class="flex flex-col sm:flex-row justify-between gap-4 border-b border-slate-200 pb-5">

                  <div>

                    <p class="text-xs font-bold uppercase text-indigo-600">

                      {{ inv.tenantBrandName }}

                    </p>

                    <h2 class="text-xl font-extrabold text-slate-900">

                      {{ inv.propertyName }}

                    </h2>

                    <p class="text-xs text-slate-500 mt-1">{{ inv.propertyAddress }}</p>

                    <p class="text-xs text-slate-500">MST Đơn vị: {{ inv.propertyTaxCode }}</p>

                  </div>



                  <div class="sm:text-right">

                    <h3 class="text-lg font-extrabold uppercase text-slate-900">

                      HÓA ĐƠN DỊCH VỤ LƯU TRÚ

                    </h3>

                    <p class="text-xs text-slate-600 font-semibold">

                      Số HĐ: {{ inv.invoiceNumber }}

                    </p>

                    <p class="text-xs text-slate-500">Mã đặt phòng: {{ inv.reservationCode }}</p>

                    <p class="text-xs text-slate-500">Ngày lập: {{ inv.issuedAt }}</p>

                  </div>

                </div>



                <!-- Thông tin Khách hàng & Phòng -->

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl text-xs">

                  <div class="space-y-1">

                    <p class="text-slate-400 uppercase font-bold">Thông tin Khách hàng</p>

                    <p class="font-bold text-slate-900">{{ guestProfile().fullName }}</p>

                    <p>SĐT: {{ guestProfile().phone }} • Email: {{ guestProfile().email }}</p>

                    @if (guestProfile().companyName) {

                      <p class="font-semibold text-slate-700">

                        Đơn vị: {{ guestProfile().companyName }} (MST:

                        {{ guestProfile().companyTaxCode }})

                      </p>

                    }

                  </div>

                  <div class="space-y-1">

                    <p class="text-slate-400 uppercase font-bold">Chi tiết Lưu trú</p>

                    <p class="font-bold text-slate-900">

                      Phòng {{ inv.roomNumber }} - {{ inv.roomName }} ({{

                        getRentalTypeLabel(inv.rentalType)

                      }})

                    </p>

                    <p>Nhận phòng: {{ inv.checkInTime }}</p>

                    <p>Trả phòng: {{ inv.checkOutTime }}</p>

                  </div>

                </div>



                <!-- Bảng Kê Chi tiết Các Khoản Mục (Folio Items) -->

                <table class="w-full text-xs border-collapse">

                  <thead>

                    <tr class="border-b-2 border-slate-200 text-slate-500 uppercase">

                      <th class="py-2.5 text-left">Hạng mục / Dịch vụ</th>

                      <th class="py-2.5 text-center">SL</th>

                      <th class="py-2.5 text-right">Đơn giá</th>

                      <th class="py-2.5 text-right">Thành tiền</th>

                    </tr>

                  </thead>

                  <tbody class="divide-y divide-slate-100">

                    @for (item of inv.lineItems; track item.id) {

                      <tr>

                        <td class="py-3 font-medium text-slate-800">{{ item.description }}</td>

                        <td class="py-3 text-center">{{ item.quantity }}</td>

                        <td class="py-3 text-right">{{ item.unitPrice | number: '1.0-0' }}đ</td>

                        <td

                          class="py-3 text-right font-bold"

                          [class.text-emerald-600]="item.amount < 0"

                        >

                          {{ item.amount | number: '1.0-0' }}đ

                        </td>

                      </tr>

                    }

                  </tbody>

                </table>



                <!-- Tổng kết Tiền & Điểm thưởng -->

                <div class="flex flex-col sm:flex-row justify-between gap-6 pt-4 border-t border-slate-200">

                  <div class="text-xs space-y-1 text-slate-600">

                    <p class="font-bold text-slate-800">Tổng kết Điểm thưởng Thành viên:</p>

                    <p>• Điểm đã dùng thanh toán đơn này: {{ inv.pointsUsed }} điểm</p>

                    <p>• Điểm tích lũy cộng thêm sau trả phòng: +{{ inv.pointsEarned }} điểm</p>

                    @if (inv.PointsRefunded > 0) {

                      <p class="text-sky-700 font-semibold">

                        • Điểm đã hoàn trả lại ví: +{{ inv.PointsRefunded }} điểm

                      </p>

                    }

                  </div>



                  <div class="w-full sm:w-64 space-y-1.5 text-xs">

                    <div class="flex justify-between">

                      <span class="text-slate-500">Tiền phòng & Phụ thu:</span>

                      <span class="font-semibold">

                        {{ inv.subTotal + inv.surchargeTotal | number: '1.0-0' }}đ

                      </span>

                    </div>

                    <div class="flex justify-between text-emerald-600">

                      <span>Giảm giá & Quy đổi điểm:</span>

                      <span>

                        -{{ inv.discountTotal + inv.pointsDiscountAmount | number: '1.0-0' }}đ

                      </span>

                    </div>

                    <div class="flex justify-between">

                      <span class="text-slate-500">Thuế GTGT (VAT):</span>

                      <span>{{ inv.taxAmount | number: '1.0-0' }}đ</span>

                    </div>

                    <div

                      class="flex justify-between text-base font-extrabold text-slate-900 pt-2 border-t border-slate-200"

                    >

                      <span>Tổng cộng:</span>

                      <span class="text-indigo-600">{{ inv.grandTotal | number: '1.0-0' }}đ</span>

                    </div>

                  </div>

                </div>

              </div>

            </div>

          </div>

        }

      </div>

    </div>

  `,

})

export class GuestProfilePageComponent implements OnInit {

  readonly activeTab = signal<ProfileTab>('bookings_invoices');

  readonly selectedPointFilter = signal<'ALL' | PointTxType>('ALL');

  readonly selectedInvoice = signal<GuestInvoiceRecord | null>(null);



  readonly navTabs: Array<{ id: ProfileTab; label: string; icon: string }> = [

    {

      id: 'bookings_invoices',

      label: 'Đặt phòng & Hóa đơn (In / Xuất file)',

      icon: 'pi pi-receipt',

    },

    {

      id: 'loyalty_wallet',

      label: 'Ví Điểm thưởng & Hoàn điểm',

      icon: 'pi pi-wallet',

    },

    {

      id: 'memberships',

      label: 'Thẻ Thành viên Cơ sở / Chuỗi',

      icon: 'pi pi-id-card',

    },

    {

      id: 'settings',

      label: 'Hồ sơ & Thông tin Xuất VAT',

      icon: 'pi pi-user-edit',

    },

  ];



  readonly pointFilterOptions: Array<{ label: string; value: 'ALL' | PointTxType }> = [

    { label: 'Tất cả giao dịch', value: 'ALL' },

    { label: '+ Điểm tích lũy', value: 'Earned' },

    { label: '- Dùng điểm thanh toán', value: 'Redeemed' },

    { label: '↺ Điểm hoàn trả', value: 'Refunded' },

  ];



  readonly guestProfile = signal({

    fullName: 'Nguyễn Minh Quân',

    phone: '0909 888 777',

    email: 'minhquan.guest@example.com',

    companyName: 'Công ty TNHH Công Nghệ Du Lịch Việt',

    companyTaxCode: '0316889900',

    companyAddress: '123 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',

  });



  readonly memberships = signal<GuestLoyaltyMembershipCard[]>([]);

  readonly pointLedger = signal<LoyaltyPointLedgerItem[]>([]);

  readonly invoices = signal<GuestInvoiceRecord[]>([]);

  readonly availablePropertiesToJoin = signal<

    Array<{

      propertyId: string;

      tenantId: string;

      tenantBrandName: string;

      propertyName: string;

      location: string;

      welcomeDiscountPercent: number;

      welcomePoints: number;

    }>

  >([]);



  readonly primaryMembership = computed(() => this.memberships()[0] ?? null);



  readonly totalAvailablePoints = computed(() =>

    this.memberships().reduce((sum, m) => sum + m.pointsBalance, 0)

  );



  readonly totalRefundedPoints = computed(() =>

    this.pointLedger()

      .filter((tx) => tx.type === 'Refunded')

      .reduce((sum, tx) => sum + tx.pointsDelta, 0)

  );



  readonly filteredPointLedger = computed(() => {

    const f = this.selectedPointFilter();

    if (f === 'ALL') return this.pointLedger();

    return this.pointLedger().filter((tx) => tx.type === f);

  });



  ngOnInit(): void {

    this.seedDemoGuestPortalData();

  }



  openInvoiceModal(inv: GuestInvoiceRecord): void {

    this.selectedInvoice.set(inv);

  }



  printSingleInvoice(inv: GuestInvoiceRecord): void {

    this.selectedInvoice.set(inv);

    setTimeout(() => window.print(), 150);

  }



  triggerBrowserPrint(): void {

    window.print();

  }



  /** Xuất 1 Hóa đơn ra file CSV để lưu trữ hoặc gửi kế toán */

  downloadInvoiceJsonOrText(inv: GuestInvoiceRecord): void {

    const header = 'HangMuc,SoLuong,DonGia,ThanhTien\n';

    const rows = inv.lineItems

      .map(

        (i) =>

          `"${i.description}",${i.quantity},${i.unitPrice},${i.amount}`

      )

      .join('\n');

    const summary = `\n"Tong cong thanh toan",1,${inv.grandTotal},${inv.grandTotal}`;

    const csvContent = '\uFEFF' + header + rows + summary;



    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');

    a.href = url;

    a.download = `HoaDon_${inv.invoiceNumber}_${inv.reservationCode}.csv`;

    a.click();

    URL.revokeObjectURL(url);

  }



  /** Xuất toàn bộ danh sách Hóa đơn của khách ra file CSV tổng hợp */

  exportAllInvoicesCsv(): void {

    const header =

      'SoHoaDon,MaDatPhong,ChuoiThuongHieu,CoSoLuuTru,HinhThucThue,NhanPhong,TraPhong,DiemDaDung,DiemTichLuy,DiemHoanTra,TongThanhToan,TrangThai\n';

    const rows = this.invoices()

      .map(

        (inv) =>

          `"${inv.invoiceNumber}","${inv.reservationCode}","${inv.tenantBrandName}","${inv.propertyName}","${inv.rentalType}","${inv.checkInTime}","${inv.checkOutTime}",${inv.pointsUsed},${inv.pointsEarned},${inv.PointsRefunded},${inv.grandTotal},"${inv.status}"`

      )

      .join('\n');



    const blob = new Blob(['\uFEFF' + header + rows], {

      type: 'text/csv;charset=utf-8;',

    });

    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');

    a.href = url;

    a.download = `BangKe_HoaDon_KhachHang_${new Date().toISOString().slice(0, 10)}.csv`;

    a.click();

    URL.revokeObjectURL(url);

  }



  /** Đăng ký thành viên cơ sở lưu trú mới trong 1 chạm và nhận điểm chào mừng */

  enrollPropertyMembership(avail: {

    propertyId: string;

    tenantId: string;

    tenantBrandName: string;

    propertyName: string;

    location: string;

    welcomeDiscountPercent: number;

    welcomePoints: number;

  }): void {

    const newCard: GuestLoyaltyMembershipCard = {

      membershipId: `mem-${Date.now()}`,

      tenantId: avail.tenantId,

      tenantBrandName: avail.tenantBrandName,

      enrolledPropertyId: avail.propertyId,

      enrolledPropertyName: avail.propertyName,

      memberCode: `VIP-${Math.floor(100000 + Math.random() * 900000)}`,

      tier: 'Silver',

      pointsBalance: avail.welcomePoints,

      pendingPoints: 0,

      totalStays: 0,

      discountPercent: avail.welcomeDiscountPercent,

      nextTierName: 'Gold',

      staysToNextTier: 5,

      joinedAt: new Date().toISOString().slice(0, 10),

    };



    this.memberships.update((list) => [newCard, ...list]);

    this.availablePropertiesToJoin.update((list) =>

      list.filter((item) => item.propertyId !== avail.propertyId)

    );

    this.pointLedger.update((ledger) => [

      {

        id: `tx-${Date.now()}`,

        createdAt: 'Vừa xong',

        tenantBrandName: avail.tenantBrandName,

        propertyName: avail.propertyName,

        reservationCode: 'WELCOME-MEMBER',

        type: 'Bonus',

        pointsDelta: avail.welcomePoints,

        balanceAfter: newCard.pointsBalance,

        description: `Tặng điểm đăng ký thành viên mới tại ${avail.propertyName}`,

      },

      ...ledger,

    ]);

  }



  getInvoiceStatusLabel(status: GuestInvoiceRecord['status']): string {

    switch (status) {

      case 'Paid':

        return 'Đã thanh toán';

      case 'PartiallyPaid':

        return 'Thanh toán một phần';

      case 'Refunded':

        return 'Đã hoàn tiền & hoàn điểm';

      case 'Cancelled':

        return 'Đã hủy';

    }

  }



  getRentalTypeLabel(type: GuestInvoiceRecord['rentalType']): string {

    switch (type) {

      case 'Hourly':

        return 'Thuê theo giờ';

      case 'Overnight':

        return 'Qua đêm';

      case 'Daily':

        return 'Theo ngày';

    }

  }



  private seedDemoGuestPortalData(): void {

    this.memberships.set([

      {

        membershipId: 'm-1',

        tenantId: 't-aurora',

        tenantBrandName: 'Aurora Hospitality Group',

        enrolledPropertyId: 'p-dalat-1',

        enrolledPropertyName: 'Aurora Boutique Hotel Chợ Đêm Đà Lạt',

        memberCode: 'AUR-882910',

        tier: 'Gold',

        pointsBalance: 320,

        pendingPoints: 45,

        totalStays: 7,

        discountPercent: 8,

        nextTierName: 'Diamond',

        staysToNextTier: 3,

        joinedAt: '2026-03-10',

      },

      {

        membershipId: 'm-2',

        tenantId: 't-joymotel',

        tenantBrandName: 'Chuỗi Nhà nghỉ & Motel JoyStay',

        enrolledPropertyId: 'p-vungtau-2',

        enrolledPropertyName: 'JoyStay Motel Bãi Sau Vũng Tàu',

        memberCode: 'JOY-551209',

        tier: 'Silver',

        pointsBalance: 140,

        pendingPoints: 0,

        totalStays: 3,

        discountPercent: 5,

        nextTierName: 'Gold',

        staysToNextTier: 2,

        joinedAt: '2026-06-20',

      },

    ]);



    this.pointLedger.set([

      {

        id: 'tx-104',

        createdAt: '14/10/2026 12:15',

        tenantBrandName: 'Aurora Hospitality Group',

        propertyName: 'Aurora Boutique Hotel Chợ Đêm Đà Lạt',

        reservationCode: 'RES-2026-9981',

        type: 'Earned',

        pointsDelta: 85,

        balanceAfter: 320,

        description: 'Cộng điểm tích lũy (4% hạng Gold) sau khi Check-out & tất toán hóa đơn',

      },

      {

        id: 'tx-103',

        createdAt: '10/10/2026 19:40',

        tenantBrandName: 'Chuỗi Nhà nghỉ & Motel JoyStay',

        propertyName: 'JoyStay Motel Bãi Sau Vũng Tàu',

        reservationCode: 'RES-2026-8842',

        type: 'Refunded',

        pointsDelta: 60,

        balanceAfter: 140,

        description: 'Hoàn trả 100% điểm đã dùng do hủy đặt phòng trước giờ nhận phòng',

      },

      {

        id: 'tx-102',

        createdAt: '10/10/2026 15:10',

        tenantBrandName: 'Chuỗi Nhà nghỉ & Motel JoyStay',

        propertyName: 'JoyStay Motel Bãi Sau Vũng Tàu',

        reservationCode: 'RES-2026-8842',

        type: 'Redeemed',

        pointsDelta: -60,

        balanceAfter: 80,

        description: 'Dùng 60 điểm (-60.000đ) thanh toán đặt phòng theo giờ (3 giờ)',

      },

    ]);



    this.invoices.set([

      {

        invoiceId: 'inv-01',

        invoiceNumber: 'HD-202610-00192',

        reservationId: 'res-01',

        reservationCode: 'RES-2026-9981',

        tenantBrandName: 'Aurora Hospitality Group',

        propertyName: 'Aurora Boutique Hotel Chợ Đêm Đà Lạt',

        propertyType: 'Hotel',

        propertyAddress: '12 Nguyễn Thị Minh Khai, Phường 1, TP. Đà Lạt, Lâm Đồng',

        propertyTaxCode: '5801122334',

        rentalType: 'Daily',

        checkInTime: '12/10/2026 14:00',

        checkOutTime: '14/10/2026 12:00',

        roomName: 'Deluxe Balcony View Chợ Đêm',

        roomNumber: '302',

        status: 'Paid',

        subTotal: 1800000,

        surchargeTotal: 150000,

        discountTotal: 144000,

        pointsUsed: 100,

        pointsDiscountAmount: 100000,

        pointsEarned: 85,

        PointsRefunded: 0,

        taxAmount: 136480,

        grandTotal: 1842480,

        paidAmount: 1842480,

        paymentMethod: 'Chuyển khoản QR + Điểm thành viên',

        issuedAt: '14/10/2026 12:10',

        lineItems: [

          {

            id: 'li-1',

            itemType: 'RoomCharge',

            description: 'Tiền phòng Deluxe Balcony (2 đêm x 900.000đ)',

            quantity: 2,

            unitPrice: 900000,

            amount: 1800000,

          },

          {

            id: 'li-2',

            itemType: 'Surcharge',

            description: 'Phụ thu trả phòng muộn 1 giờ (Theo chính sách cơ sở)',

            quantity: 1,

            unitPrice: 150000,

            amount: 150000,

          },

          {

            id: 'li-3',

            itemType: 'Discount',

            description: 'Chiết khấu Thẻ thành viên hạng Gold (-8%)',

            quantity: 1,

            unitPrice: -144000,

            amount: -144000,

          },

          {

            id: 'li-4',

            itemType: 'PointsRedemption',

            description: 'Thanh toán bằng 100 điểm thưởng thành viên',

            quantity: 100,

            unitPrice: -1000,

            amount: -100000,

          },

        ],

      },

      {

        invoiceId: 'inv-02',

        invoiceNumber: 'HD-202610-00145',

        reservationId: 'res-02',

        reservationCode: 'RES-2026-8842',

        tenantBrandName: 'Chuỗi Nhà nghỉ & Motel JoyStay',

        propertyName: 'JoyStay Motel Bãi Sau Vũng Tàu',

        propertyType: 'Motel',

        propertyAddress: '88 Thùy Vân, Phường Thắng Tam, TP. Vũng Tàu',

        propertyTaxCode: '3502233445',

        rentalType: 'Hourly',

        checkInTime: '10/10/2026 16:00',

        checkOutTime: '10/10/2026 19:00',

        roomName: 'Standard Queen (Thuê theo giờ)',

        roomNumber: '105',

        status: 'Refunded',

        subTotal: 210000,

        surchargeTotal: 0,

        discountTotal: 0,

        pointsUsed: 60,

        pointsDiscountAmount: 60000,

        pointsEarned: 0,

        PointsRefunded: 60,

        taxAmount: 0,

        grandTotal: 150000,

        paidAmount: 0,

        paymentMethod: 'Hoàn trả tự động về Ví điểm',

        issuedAt: '10/10/2026 19:40',

        lineItems: [

          {

            id: 'li-21',

            itemType: 'RoomCharge',

            description: 'Gói thuê theo giờ: 2 giờ đầu (150.000đ) + 1 giờ thêm (60.000đ)',

            quantity: 1,

            unitPrice: 210000,

            amount: 210000,

          },

          {

            id: 'li-22',

            itemType: 'PointsRedemption',

            description: 'Trừ 60 điểm thành viên (Đã hoàn lại +60 điểm khi hủy đơn)',

            quantity: 60,

            unitPrice: -1000,

            amount: -60000,

          },

        ],

      },

    ]);



    this.availablePropertiesToJoin.set([

      {

        propertyId: 'p-hoian-1',

        tenantId: 't-heritage',

        tenantBrandName: 'Heritage Homestay & Villa Chain',

        propertyName: 'Hội An Ancient Town Riverside Villa',

        location: 'Cách Phố cổ Hội An 300m',

        welcomeDiscountPercent: 7,

        welcomePoints: 50,

      },

      {

        propertyId: 'p-hcm-2',

        tenantId: 't-saigonexpress',

        tenantBrandName: 'Saigon Express Hotel & Motel',

        propertyName: 'Saigon Express Airport Motel Tân Sơn Nhất',

        location: 'Cách Sân bay Tân Sơn Nhất 500m',

        welcomeDiscountPercent: 5,

        welcomePoints: 50,

      },

      {

        propertyId: 'p-danang-3',

        tenantId: 't-mykhe',

        tenantBrandName: 'My Khe Beach Hospitality',

        propertyName: 'My Khe Ocean View Hotel & Apartment',

        location: 'Cách Biển Mỹ Khê 150m',

        welcomeDiscountPercent: 10,

        welcomePoints: 50,

      },

    ]);

  }

}

