import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  OnInit,
  computed,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { A11yModule } from '@angular/cdk/a11y';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { GuestService } from '../../core/services/guest.service';
import { AlertService } from '../../core/services/alert.service';
import {
  GuestDirectoryItemDto,
  GuestBookingHistoryItemDto
} from '../../core/models/guest.model';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { PaginationComponent } from '../../shared/components/pagination/pagination.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header';
import { BusinessDatePipe } from '../../shared/pipes/business-date.pipe';

type GuestSortField = 'fullName' | 'loyaltyTier' | 'completedStays' | 'totalSpent';

@Component({
  selector: 'app-guests',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    A11yModule,
    PageHeaderComponent,
    EmptyStateComponent,
    PaginationComponent,
    BusinessDatePipe
  ],
  template: `
    <div class="max-w-7xl mx-auto space-y-6 pb-12">
      <!-- Page Header -->
      <app-page-header
        [title]="'Quản lý Khách hàng & Hồ sơ Lưu trú (Guest CRM)'"
        subtitle="Tra cứu lịch sử đặt phòng của khách, quản lý sở thích, hạng thành viên tích điểm và ghi chú chăm sóc khách hàng."
        badgeLabel="Khách quen & Thẻ thành viên"
        badgeColor="emerald"
      >
        <button
          type="button"
          (click)="loadGuests()"
          [disabled]="loading()"
          class="min-h-11 inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
          title="Làm mới danh sách"
        >
          <i class="pi pi-refresh text-xs" [class.animate-spin]="loading()" aria-hidden="true"></i>
          <span>Làm mới dữ liệu</span>
        </button>
      </app-page-header>

      <!-- Stat Cards -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-700 p-4 shadow-2xs">
          <div class="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tổng khách hàng</div>
          <div class="text-2xl font-extrabold text-slate-900 dark:text-slate-100 mt-1 tabular-nums">{{ totalCount() }}</div>
          <div class="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Từng đặt phòng</div>
        </div>
        <div class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-700 p-4 shadow-2xs">
          <div class="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Khách VIP</div>
          <div class="text-2xl font-extrabold text-amber-600 dark:text-amber-400 mt-1 tabular-nums">{{ countVip() }}</div>
          <div class="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5 font-medium">Chi tiêu cao &amp; Đặt nhiều</div>
        </div>
        <div class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-700 p-4 shadow-2xs">
          <div class="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Khách quay lại</div>
          <div class="text-2xl font-extrabold text-emerald-900 dark:text-emerald-400 mt-1 tabular-nums">{{ countReturning() }}</div>
          <div class="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5 font-medium">&ge; 2 lượt lưu trú</div>
        </div>
        <div class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-700 p-4 shadow-2xs">
          <div class="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Doanh thu tích lũy</div>
          <div class="text-xl sm:text-2xl font-extrabold text-indigo-900 dark:text-indigo-400 mt-1 tabular-nums">
            {{ totalRevenueFromPage() | number:'1.0-0' }} <span class="text-xs font-medium text-slate-500 dark:text-slate-400">VNĐ</span>
          </div>
          <div class="text-[11px] text-indigo-600 dark:text-indigo-400 mt-0.5 font-medium">Trên trang hiển thị</div>
        </div>
      </div>

      <!-- Filter Bar -->
      <div class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-700 p-4 shadow-2xs flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div class="flex-1 flex flex-col sm:flex-row gap-2.5">
          <!-- Search -->
          <div class="relative flex-1">
            <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" aria-hidden="true"></i>
            <label for="guest-search-input" class="sr-only">Tìm kiếm khách hàng theo tên, số điện thoại hoặc CCCD</label>
            <input
              id="guest-search-input"
              type="text"
              [(ngModel)]="searchKeyword"
              (keyup.enter)="onSearch()"
              placeholder="Tìm theo tên khách, số điện thoại, CCCD..."
              class="w-full min-h-11 pl-9 pr-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          <!-- Tier Filter -->
          <select
            [(ngModel)]="selectedTierFilter"
            (change)="onFilterChange()"
            aria-label="Lọc theo hạng thành viên"
            class="min-h-11 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          >
            <option value="">Tất cả hạng thẻ</option>
            <option value="Silver">Hạng Bạc (Silver)</option>
            <option value="Gold">Hạng Vàng (Gold)</option>
            <option value="Diamond">Hạng Kim cương (Diamond)</option>
          </select>
        </div>

        <button
          type="button"
          (click)="onSearch()"
          class="min-h-11 px-4 rounded-lg bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-700 text-white text-xs font-semibold transition-colors cursor-pointer shrink-0"
        >
          Tìm kiếm
        </button>
      </div>

      <!-- Guests Directory -->
      <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-700 shadow-xs overflow-hidden">
        @if (loading()) {
          <div class="p-8 text-center text-slate-400 space-y-2">
            <i class="pi pi-spin pi-spinner text-2xl text-emerald-600" aria-hidden="true"></i>
            <div class="text-xs">Đang tải danh bạ khách hàng...</div>
          </div>
        } @else if (sortedGuests().length === 0) {
          <app-empty-state
            iconClass="pi pi-id-card"
            title="Chưa có dữ liệu khách hàng"
            description="Khi khách đặt phòng trực tuyến hoặc check-in tại quầy lễ tân, thông tin và lịch sử lưu trú sẽ tự động được ghi nhận tại đây."
          ></app-empty-state>
        } @else {
          <!-- Mobile Card Fallback (< md) -->
          <div class="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
            @for (guest of sortedGuests(); track guest.phoneNumber) {
              <div class="p-4 space-y-3">
                <div class="flex items-start justify-between gap-2">
                  <div class="flex items-center gap-2.5 min-w-0">
                    <div class="w-9 h-9 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 font-bold flex items-center justify-center text-xs shrink-0">
                      {{ guest.fullName.charAt(0).toUpperCase() }}
                    </div>
                    <div class="min-w-0">
                      <div class="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 flex-wrap">
                        <span class="truncate">{{ guest.fullName }}</span>
                        @if (guest.isVip) {
                          <span class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                            <i class="pi pi-star-fill text-[9px] text-amber-600" aria-hidden="true"></i> VIP
                          </span>
                        }
                      </div>
                      <div class="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                        {{ guest.phoneNumber }}
                      </div>
                    </div>
                  </div>
                  <span
                    class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border shrink-0"
                    [ngClass]="getTierBadgeClass(guest.loyaltyTier)"
                  >
                    {{ guest.loyaltyTier }}
                  </span>
                </div>

                <div class="grid grid-cols-2 gap-2 text-xs bg-slate-50 dark:bg-slate-800/70 rounded-xl p-2.5">
                  <div>
                    <div class="text-[11px] text-slate-500 dark:text-slate-400">Lượt lưu trú</div>
                    <div class="font-bold text-slate-800 dark:text-slate-100 tabular-nums">
                      {{ guest.completedStays }} / {{ guest.totalBookings }} đơn
                    </div>
                  </div>
                  <div class="text-right">
                    <div class="text-[11px] text-slate-500 dark:text-slate-400">Tổng chi tiêu</div>
                    <div class="font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                      {{ guest.totalSpent | number:'1.0-0' }} VNĐ
                    </div>
                  </div>
                </div>

                @if (sanitizeGuestNotes(guest.notes)) {
                  <p class="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                    {{ sanitizeGuestNotes(guest.notes) }}
                  </p>
                }

                <div class="flex justify-end">
                  <button
                    type="button"
                    (click)="viewGuestDetails(guest)"
                    [attr.aria-label]="'Xem lịch sử lưu trú và ghi chú của ' + guest.fullName"
                    class="min-h-11 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 text-slate-700 dark:text-slate-200 hover:text-emerald-700 dark:hover:text-emerald-300 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <i class="pi pi-history text-xs" aria-hidden="true"></i>
                    <span>Lịch sử</span>
                  </button>
                </div>
              </div>
            }
          </div>

          <!-- Desktop Table (>= md) -->
          <div class="hidden md:block overflow-x-auto">
            <table class="w-full text-left text-xs text-slate-600 dark:text-slate-300 tabular-nums">
              <thead class="bg-slate-50 dark:bg-slate-800/80 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th scope="col" class="px-5 py-3.5" [attr.aria-sort]="getAriaSort('fullName')">
                    <button
                      type="button"
                      (click)="toggleSort('fullName')"
                      class="min-h-11 inline-flex items-center gap-1.5 font-bold uppercase tracking-wider hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
                    >
                      <span>Khách hàng</span>
                      <i class="pi text-[10px]" [ngClass]="getSortIcon('fullName')" aria-hidden="true"></i>
                    </button>
                  </th>
                  <th scope="col" class="px-5 py-3.5">Số điện thoại</th>
                  <th scope="col" class="px-5 py-3.5" [attr.aria-sort]="getAriaSort('loyaltyTier')">
                    <button
                      type="button"
                      (click)="toggleSort('loyaltyTier')"
                      class="min-h-11 inline-flex items-center gap-1.5 font-bold uppercase tracking-wider hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
                    >
                      <span>Hạng thành viên</span>
                      <i class="pi text-[10px]" [ngClass]="getSortIcon('loyaltyTier')" aria-hidden="true"></i>
                    </button>
                  </th>
                  <th scope="col" class="px-5 py-3.5 text-center" [attr.aria-sort]="getAriaSort('completedStays')">
                    <button
                      type="button"
                      (click)="toggleSort('completedStays')"
                      class="min-h-11 inline-flex items-center justify-center gap-1.5 font-bold uppercase tracking-wider hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
                    >
                      <span>Lượt lưu trú</span>
                      <i class="pi text-[10px]" [ngClass]="getSortIcon('completedStays')" aria-hidden="true"></i>
                    </button>
                  </th>
                  <th scope="col" class="px-5 py-3.5 text-right" [attr.aria-sort]="getAriaSort('totalSpent')">
                    <button
                      type="button"
                      (click)="toggleSort('totalSpent')"
                      class="min-h-11 inline-flex items-center justify-end gap-1.5 font-bold uppercase tracking-wider hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
                    >
                      <span>Tổng chi tiêu</span>
                      <i class="pi text-[10px]" [ngClass]="getSortIcon('totalSpent')" aria-hidden="true"></i>
                    </button>
                  </th>
                  <th scope="col" class="px-5 py-3.5">Ghi chú phục vụ</th>
                  <th scope="col" class="px-5 py-3.5 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                @for (guest of sortedGuests(); track guest.phoneNumber) {
                  <tr class="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors">
                    <!-- Name & Badge -->
                    <td class="px-5 py-3.5">
                      <div class="flex items-center gap-2.5">
                        <div class="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 font-bold flex items-center justify-center text-xs shrink-0">
                          {{ guest.fullName.charAt(0).toUpperCase() }}
                        </div>
                        <div>
                          <div class="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                            <span>{{ guest.fullName }}</span>
                            @if (guest.isVip) {
                              <span class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                <i class="pi pi-star-fill text-[9px] text-amber-600" aria-hidden="true"></i> VIP
                              </span>
                            }
                          </div>
                          <div class="text-[11px] text-slate-400">
                            {{ guest.email || (guest.idCardNumber ? 'CCCD: ' + guest.idCardNumber : 'Chưa có email') }}
                          </div>
                        </div>
                      </div>
                    </td>

                    <!-- Phone -->
                    <td class="px-5 py-3.5 font-mono text-slate-800 dark:text-slate-200 tabular-nums">
                      {{ guest.phoneNumber }}
                    </td>

                    <!-- Tier -->
                    <td class="px-5 py-3.5">
                      <span
                        class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border"
                        [ngClass]="getTierBadgeClass(guest.loyaltyTier)"
                      >
                        {{ guest.loyaltyTier }}
                      </span>
                    </td>

                    <!-- Stays Count -->
                    <td class="px-5 py-3.5 text-center tabular-nums">
                      <span class="font-bold text-slate-800 dark:text-slate-100">{{ guest.completedStays }}</span>
                      <span class="text-slate-400 text-[11px]">/ {{ guest.totalBookings }} đơn</span>
                    </td>

                    <!-- Total Spent -->
                    <td class="px-5 py-3.5 text-right font-bold text-emerald-800 dark:text-emerald-400 tabular-nums">
                      {{ guest.totalSpent | number:'1.0-0' }} <span class="text-[10px] font-normal text-slate-500 dark:text-slate-400">VNĐ</span>
                    </td>

                    <!-- Notes preview -->
                    <td class="px-5 py-3.5 max-w-[200px] truncate text-slate-500 dark:text-slate-400 text-[11px]">
                      {{ sanitizeGuestNotes(guest.notes) || '—' }}
                    </td>

                    <!-- Action -->
                    <td class="px-5 py-3.5 text-right">
                      <button
                        type="button"
                        (click)="viewGuestDetails(guest)"
                        [attr.aria-label]="'Xem lịch sử lưu trú và ghi chú của ' + guest.fullName"
                        class="min-h-11 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 text-slate-700 dark:text-slate-200 hover:text-emerald-700 dark:hover:text-emerald-300 text-xs font-semibold transition-colors cursor-pointer"
                        title="Xem lịch sử đặt phòng & ghi chú"
                      >
                        <i class="pi pi-history text-xs" aria-hidden="true"></i>
                        <span>Lịch sử</span>
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <!-- Pagination -->
          <div class="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <app-pagination
              [totalCount]="totalCount()"
              [pageSize]="pageSize()"
              [page]="currentPage()"
              (pageChange)="onPageChange($event)"
            ></app-pagination>
          </div>
        }
      </div>

      <!-- Guest Details & Stay History Modal -->
      @if (showDetailModal() && selectedGuest()) {
        <div
          class="fixed inset-0 z-[65] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="guest-detail-modal-title"
          cdkTrapFocus
          [cdkTrapFocusAutoCapture]="true"
          (click)="closeDetailModal()"
        >
          <div
            class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto"
            (click)="$event.stopPropagation()"
          >
            <!-- Modal Header -->
            <div class="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div class="flex items-center gap-2.5">
                <div class="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold flex items-center justify-center text-sm border border-emerald-200 dark:border-emerald-800 shrink-0">
                  {{ selectedGuest()!.fullName.charAt(0).toUpperCase() }}
                </div>
                <div>
                  <h2 id="guest-detail-modal-title" class="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <span>{{ selectedGuest()!.fullName }}</span>
                    @if (selectedGuest()!.isVip) {
                      <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                        VIP
                      </span>
                    }
                  </h2>
                  <div class="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    SĐT: {{ selectedGuest()!.phoneNumber }} &bull; {{ selectedGuest()!.email || 'Chưa có email' }}
                  </div>
                </div>
              </div>
              <button
                type="button"
                (click)="closeDetailModal()"
                aria-label="Đóng chi tiết khách hàng"
                class="min-w-11 min-h-11 inline-flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
              >
                <i class="pi pi-times text-sm" aria-hidden="true"></i>
              </button>
            </div>

            <!-- Guest Overview Metrics -->
            <div class="grid grid-cols-3 gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-100 dark:border-slate-700 text-center">
              <div>
                <div class="text-[10px] uppercase font-bold text-slate-400">Đã hoàn tất</div>
                <div class="text-base font-bold text-slate-800 dark:text-slate-100 mt-0.5 tabular-nums">{{ selectedGuest()!.completedStays }} kỳ lưu trú</div>
              </div>
              <div>
                <div class="text-[10px] uppercase font-bold text-slate-400">Tổng chi tiêu</div>
                <div class="text-base font-bold text-emerald-700 dark:text-emerald-400 mt-0.5 tabular-nums">
                  {{ selectedGuest()!.totalSpent | number:'1.0-0' }} đ
                </div>
              </div>
              <div>
                <div class="text-[10px] uppercase font-bold text-slate-400">Hạng thẻ</div>
                <div class="text-base font-bold text-purple-700 dark:text-purple-400 mt-0.5">{{ selectedGuest()!.loyaltyTier }}</div>
              </div>
            </div>

            <!-- Notes & Preferences Section -->
            <div class="space-y-2">
              <label for="guest-internal-notes" class="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Ghi chú nội bộ chăm sóc khách (Sở thích, phòng ưa thích, lưu ý phục vụ):
              </label>
              <textarea
                id="guest-internal-notes"
                [(ngModel)]="noteContent"
                rows="3"
                placeholder="Ví dụ: Khách thích nhận phòng tầng cao, dị ứng hoa ly, chuẩn bị thêm nước suối..."
                class="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              ></textarea>
              <div class="flex justify-end">
                <button
                  type="button"
                  (click)="saveGuestNotes()"
                  [disabled]="savingNote()"
                  class="min-h-11 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                >
                  @if (savingNote()) {
                    <i class="pi pi-spin pi-spinner mr-1" aria-hidden="true"></i>
                  }
                  Lưu ghi chú
                </button>
              </div>
            </div>

            <!-- Booking History List -->
            <div class="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <h3 class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Lịch sử các lần đặt phòng tại chuỗi
              </h3>

              @if (loadingHistory()) {
                <div class="py-6 text-center text-slate-400 text-xs">
                  <i class="pi pi-spin pi-spinner mr-1 text-emerald-600" aria-hidden="true"></i> Đang tải lịch sử lưu trú...
                </div>
              } @else if (bookingHistory().length === 0) {
                <div class="py-4 text-center text-slate-400 text-xs">
                  Chưa có lịch sử đặt phòng chi tiết.
                </div>
              } @else {
                <div class="space-y-2 max-h-56 overflow-y-auto">
                  @for (b of bookingHistory(); track b.reservationId) {
                    <div class="p-3 rounded-xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800/60 hover:border-slate-300 dark:hover:border-slate-600 transition-colors flex items-center justify-between gap-3 text-xs">
                      <div class="space-y-0.5">
                        <div class="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 flex-wrap">
                          <span class="font-mono">{{ b.bookingCode }}</span>
                          <span class="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                            {{ b.propertyName }}
                          </span>
                        </div>
                        <div class="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums flex items-center flex-wrap gap-1">
                          <span>Phòng {{ b.roomNumber }} &bull; {{ b.roomTypeName }} &bull;</span>
                          <span>{{ b.checkInDate | businessDate }}</span>
                          <i class="pi pi-arrow-right text-[9px]" aria-hidden="true"></i>
                          <span>{{ b.checkOutDate | businessDate }}</span>
                        </div>
                      </div>

                      <div class="text-right shrink-0">
                        <div class="font-bold text-slate-900 dark:text-slate-100 tabular-nums">{{ b.totalAmount | number:'1.0-0' }} VNĐ</div>
                        <span class="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold" [ngClass]="getStatusBadge(b.status)">
                          {{ b.status }}
                        </span>
                      </div>
                    </div>
                  }
                </div>
              }
            </div>

            <div class="flex items-center justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                (click)="closeDetailModal()"
                class="min-h-11 px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `
})
export class GuestsPage implements OnInit {
  private readonly guestService = inject(GuestService);
  private readonly alertService = inject(AlertService);
  private readonly destroyRef = inject(DestroyRef);

  guestList = signal<GuestDirectoryItemDto[]>([]);
  loading = signal<boolean>(false);
  totalCount = signal<number>(0);
  currentPage = signal<number>(1);
  pageSize = signal<number>(20);

  sortField = signal<GuestSortField>('totalSpent');
  sortDirection = signal<'asc' | 'desc'>('desc');

  searchKeyword = '';
  selectedTierFilter = '';

  showDetailModal = signal<boolean>(false);
  selectedGuest = signal<GuestDirectoryItemDto | null>(null);
  bookingHistory = signal<GuestBookingHistoryItemDto[]>([]);
  loadingHistory = signal<boolean>(false);
  savingNote = signal<boolean>(false);
  noteContent = '';

  countVip = computed(() => this.guestList().filter(g => g.isVip).length);
  countReturning = computed(() => this.guestList().filter(g => g.completedStays >= 2).length);
  totalRevenueFromPage = computed(() =>
    this.guestList().reduce((sum, g) => sum + g.totalSpent, 0)
  );

  sortedGuests = computed(() => {
    const field = this.sortField();
    const dir = this.sortDirection() === 'asc' ? 1 : -1;
    const tierOrder: Record<string, number> = { diamond: 3, gold: 2, silver: 1 };

    return [...this.guestList()].sort((a, b) => {
      switch (field) {
        case 'fullName':
          return a.fullName.localeCompare(b.fullName, 'vi') * dir;
        case 'loyaltyTier': {
          const aRank = tierOrder[a.loyaltyTier?.toLowerCase()] ?? 0;
          const bRank = tierOrder[b.loyaltyTier?.toLowerCase()] ?? 0;
          return (aRank - bRank) * dir;
        }
        case 'completedStays':
          return (a.completedStays - b.completedStays) * dir;
        case 'totalSpent':
        default:
          return (a.totalSpent - b.totalSpent) * dir;
      }
    });
  });

  ngOnInit(): void {
    this.loadGuests();
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.showDetailModal()) {
      this.closeDetailModal();
    }
  }

  toggleSort(field: GuestSortField): void {
    if (this.sortField() === field) {
      this.sortDirection.update(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortField.set(field);
      this.sortDirection.set(field === 'fullName' ? 'asc' : 'desc');
    }
  }

  getAriaSort(field: GuestSortField): 'ascending' | 'descending' | 'none' {
    if (this.sortField() !== field) return 'none';
    return this.sortDirection() === 'asc' ? 'ascending' : 'descending';
  }

  getSortIcon(field: GuestSortField): string {
    if (this.sortField() !== field) return 'pi-sort-alt text-slate-400';
    return this.sortDirection() === 'asc' ? 'pi-sort-amount-up text-emerald-600' : 'pi-sort-amount-down text-emerald-600';
  }

  loadGuests(): void {
    this.loading.set(true);
    this.guestService
      .getGuestDirectory({
        search: this.searchKeyword,
        loyaltyTier: this.selectedTierFilter || undefined,
        page: this.currentPage(),
        pageSize: this.pageSize()
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          this.guestList.set(res.items);
          this.totalCount.set(res.totalCount);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.alertService.toastError('Không thể tải danh bạ khách hàng.');
        }
      });
  }

  onSearch(): void {
    this.currentPage.set(1);
    this.loadGuests();
  }

  onFilterChange(): void {
    this.currentPage.set(1);
    this.loadGuests();
  }

  onPageChange(page: number): void {
    this.currentPage.set(page);
    this.loadGuests();
  }

  getTierBadgeClass(tier: string): string {
    switch (tier?.toLowerCase()) {
      case 'diamond':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'gold':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'silver':
        return 'bg-slate-100 text-slate-800 border-slate-200';
      default:
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    }
  }

  getStatusBadge(status: string): string {
    switch (status?.toLowerCase()) {
      case 'checkedout':
        return 'bg-slate-100 text-slate-700';
      case 'checkedin':
        return 'bg-emerald-100 text-emerald-800';
      case 'confirmed':
        return 'bg-blue-100 text-blue-800';
      case 'cancelled':
        return 'bg-rose-100 text-rose-800';
      default:
        return 'bg-slate-100 text-slate-600';
    }
  }

  sanitizeGuestNotes(rawNotes?: string | null): string {
    const trimmed = rawNotes?.trim() || '';
    if (!trimmed) {
      return '';
    }

    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed) as { CustomerNotes?: unknown; customerNotes?: unknown; RentalType?: unknown };
        if (parsed && typeof parsed === 'object') {
          if (typeof parsed.CustomerNotes === 'string' && parsed.CustomerNotes.trim()) {
            return parsed.CustomerNotes.trim();
          }
          if (typeof parsed.customerNotes === 'string' && parsed.customerNotes.trim()) {
            return parsed.customerNotes.trim();
          }
          return '';
        }
      } catch {
        // Fallback check below if malformed snapshot JSON
      }
    }

    if (/"RentalType"\s*:|"LookupToken"\s*:|"AppliedPolicies"\s*:/i.test(trimmed)) {
      return '';
    }

    return trimmed;
  }

  viewGuestDetails(guest: GuestDirectoryItemDto): void {
    this.selectedGuest.set(guest);
    this.noteContent = this.sanitizeGuestNotes(guest.notes);
    this.showDetailModal.set(true);
    this.loadingHistory.set(true);

    this.guestService
      .getGuestHistory(guest.phoneNumber)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: detail => {
          this.bookingHistory.set(detail.bookings);
          this.loadingHistory.set(false);
        },
        error: () => {
          this.bookingHistory.set([]);
          this.loadingHistory.set(false);
        }
      });
  }

  closeDetailModal(): void {
    this.showDetailModal.set(false);
    this.selectedGuest.set(null);
  }

  saveGuestNotes(): void {
    const guest = this.selectedGuest();
    if (!guest) return;

    this.savingNote.set(true);
    this.guestService
      .updateGuestNotes({
        phoneNumber: guest.phoneNumber,
        notes: this.noteContent
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.savingNote.set(false);
          this.alertService.toastSuccess('Đã cập nhật ghi chú khách hàng.');
          this.loadGuests();
        },
        error: () => {
          this.savingNote.set(false);
          this.alertService.toastError('Không thể lưu ghi chú.');
        }
      });
  }
}
