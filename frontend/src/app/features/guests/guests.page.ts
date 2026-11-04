import {
  Component,
  OnInit,
  inject,
  signal,
  computed,
  ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GuestService } from '../../core/services/guest.service';
import { AlertService } from '../../core/services/alert.service';
import {
  GuestDirectoryItemDto,
  GuestDetailDto,
  GuestBookingHistoryItemDto
} from '../../core/models/guest.model';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { PaginationComponent } from '../../shared/components/pagination/pagination.component';

@Component({
  selector: 'app-guests',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, EmptyStateComponent, PaginationComponent],
  template: `
    <div class="max-w-7xl mx-auto space-y-6 pb-12">
      <!-- Page Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <div class="flex items-center gap-2.5">
            <h1 class="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">
              Quản lý Khách hàng & Hồ sơ Lưu trú (Guest CRM)
            </h1>
            <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
              Khách quen & Thẻ thành viên
            </span>
          </div>
          <p class="text-xs sm:text-sm text-slate-500 mt-1">
            Tra cứu lịch sử đặt phòng của khách, quản lý sở thích, hạng thành viên tích điểm và ghi chú chăm sóc khách hàng.
          </p>
        </div>

        <button
          type="button"
          (click)="loadGuests()"
          class="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200/90 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
          title="Làm mới danh sách"
        >
          <i class="pi pi-refresh text-xs" [class.animate-spin]="loading()"></i>
          <span>Làm mới dữ liệu</span>
        </button>
      </div>

      <!-- Stat Cards -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div class="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
          <div class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tổng khách hàng</div>
          <div class="text-2xl font-extrabold text-slate-900 mt-1">{{ totalCount() }}</div>
          <div class="text-[11px] text-slate-500 mt-0.5">Từng đặt phòng</div>
        </div>
        <div class="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
          <div class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Khách VIP</div>
          <div class="text-2xl font-extrabold text-amber-600 mt-1">{{ countVip() }}</div>
          <div class="text-[11px] text-amber-600 mt-0.5 font-medium">Chi tiêu cao & Đặt nhiều</div>
        </div>
        <div class="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
          <div class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Khách quay lại</div>
          <div class="text-2xl font-extrabold text-emerald-900 mt-1">{{ countReturning() }}</div>
          <div class="text-[11px] text-emerald-600 mt-0.5 font-medium">>= 2 lượt lưu trú</div>
        </div>
        <div class="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
          <div class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Doanh thu tích lũy</div>
          <div class="text-xl sm:text-2xl font-extrabold text-indigo-900 mt-1">
            {{ totalRevenueFromPage() | number:'1.0-0' }} <span class="text-xs font-medium text-slate-500">VNĐ</span>
          </div>
          <div class="text-[11px] text-indigo-600 mt-0.5 font-medium">Trên trang hiển thị</div>
        </div>
      </div>

      <!-- Filter Bar -->
      <div class="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div class="flex-1 flex flex-col sm:flex-row gap-2.5">
          <!-- Search -->
          <div class="relative flex-1">
            <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
            <input
              type="text"
              [(ngModel)]="searchKeyword"
              (keyup.enter)="onSearch()"
              placeholder="Tìm theo tên khách, số điện thoại, CCCD..."
              class="w-full h-10 pl-9 pr-3 rounded-lg border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          <!-- Tier Filter -->
          <select
            [(ngModel)]="selectedTierFilter"
            (change)="onFilterChange()"
            class="h-10 px-3 rounded-lg border border-slate-200 text-xs text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
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
          class="h-10 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors cursor-pointer shrink-0"
        >
          Tìm kiếm
        </button>
      </div>

      <!-- Guests Table -->
      <div class="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        @if (loading()) {
          <div class="p-8 text-center text-slate-400 space-y-2">
            <i class="pi pi-spin pi-spinner text-2xl text-emerald-600"></i>
            <div class="text-xs">Đang tải danh bạ khách hàng...</div>
          </div>
        } @else if (guestList().length === 0) {
          <app-empty-state
            iconClass="pi pi-id-card"
            title="Chưa có dữ liệu khách hàng"
            description="Khi khách đặt phòng trực tuyến hoặc check-in tại quầy lễ tân, thông tin và lịch sử lưu trú sẽ tự động được ghi nhận tại đây."
          ></app-empty-state>
        } @else {
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs text-slate-600">
              <thead class="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th class="px-5 py-3.5">Khách hàng</th>
                  <th class="px-5 py-3.5">Số điện thoại</th>
                  <th class="px-5 py-3.5">Hạng thành viên</th>
                  <th class="px-5 py-3.5 text-center">Lượt lưu trú</th>
                  <th class="px-5 py-3.5 text-right">Tổng chi tiêu</th>
                  <th class="px-5 py-3.5">Ghi chú phục vụ</th>
                  <th class="px-5 py-3.5 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 font-medium">
                @for (guest of guestList(); track guest.phoneNumber) {
                  <tr class="hover:bg-slate-50/70 transition-colors">
                    <!-- Name & Badge -->
                    <td class="px-5 py-3.5">
                      <div class="flex items-center gap-2.5">
                        <div class="w-8 h-8 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold flex items-center justify-center text-xs">
                          {{ guest.fullName.charAt(0).toUpperCase() }}
                        </div>
                        <div>
                          <div class="font-bold text-slate-900 flex items-center gap-1.5">
                            <span>{{ guest.fullName }}</span>
                            @if (guest.isVip) {
                              <span class="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                <i class="pi pi-star-fill text-[9px] text-amber-600"></i> VIP
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
                    <td class="px-5 py-3.5 font-mono text-slate-800">
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
                    <td class="px-5 py-3.5 text-center">
                      <span class="font-bold text-slate-800">{{ guest.completedStays }}</span>
                      <span class="text-slate-400 text-[11px]">/ {{ guest.totalBookings }} đơn</span>
                    </td>

                    <!-- Total Spent -->
                    <td class="px-5 py-3.5 text-right font-bold text-emerald-800">
                      {{ guest.totalSpent | number:'1.0-0' }} <span class="text-[10px] font-normal text-slate-500">VNĐ</span>
                    </td>

                    <!-- Notes preview -->
                    <td class="px-5 py-3.5 max-w-[200px] truncate text-slate-500 text-[11px]">
                      {{ guest.notes || '—' }}
                    </td>

                    <!-- Action -->
                    <td class="px-5 py-3.5 text-right">
                      <button
                        type="button"
                        (click)="viewGuestDetails(guest)"
                        class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 text-xs font-semibold transition-colors cursor-pointer"
                        title="Xem lịch sử đặt phòng & ghi chú"
                      >
                        <i class="pi pi-history text-xs"></i>
                        <span>Lịch sử</span>
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <!-- Pagination -->
          <div class="p-4 border-t border-slate-100 flex items-center justify-between">
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
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div class="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-150">
            <!-- Modal Header -->
            <div class="flex items-center justify-between pb-3 border-b border-slate-100">
              <div class="flex items-center gap-2.5">
                <div class="w-10 h-10 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-sm border border-emerald-200">
                  {{ selectedGuest()!.fullName.charAt(0).toUpperCase() }}
                </div>
                <div>
                  <h2 class="text-base font-bold text-slate-900 flex items-center gap-2">
                    <span>{{ selectedGuest()!.fullName }}</span>
                    @if (selectedGuest()!.isVip) {
                      <span class="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                        VIP
                      </span>
                    }
                  </h2>
                  <div class="text-xs text-slate-500">
                    SĐT: {{ selectedGuest()!.phoneNumber }} &bull; {{ selectedGuest()!.email || 'Chưa có email' }}
                  </div>
                </div>
              </div>
              <button
                type="button"
                (click)="closeDetailModal()"
                class="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <i class="pi pi-times text-xs"></i>
              </button>
            </div>

            <!-- Guest Overview Metrics -->
            <div class="grid grid-cols-3 gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 text-center">
              <div>
                <div class="text-[10px] uppercase font-bold text-slate-400">Đã hoàn tất</div>
                <div class="text-base font-bold text-slate-800 mt-0.5">{{ selectedGuest()!.completedStays }} kỳ lưu trú</div>
              </div>
              <div>
                <div class="text-[10px] uppercase font-bold text-slate-400">Tổng chi tiêu</div>
                <div class="text-base font-bold text-emerald-700 mt-0.5">
                  {{ selectedGuest()!.totalSpent | number:'1.0-0' }} đ
                </div>
              </div>
              <div>
                <div class="text-[10px] uppercase font-bold text-slate-400">Hạng thẻ</div>
                <div class="text-base font-bold text-purple-700 mt-0.5">{{ selectedGuest()!.loyaltyTier }}</div>
              </div>
            </div>

            <!-- Notes & Preferences Section -->
            <div class="space-y-2">
              <label class="block text-xs font-bold text-slate-700">
                Ghi chú nội bộ chăm sóc khách (Sở thích, phòng ưa thích, lưu ý phục vụ):
              </label>
              <textarea
                [(ngModel)]="noteContent"
                rows="3"
                placeholder="Ví dụ: Khách thích nhận phòng tầng cao, dị ứng hoa ly, chuẩn bị thêm nước suối..."
                class="w-full p-3 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              ></textarea>
              <div class="flex justify-end">
                <button
                  type="button"
                  (click)="saveGuestNotes()"
                  [disabled]="savingNote()"
                  class="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                >
                  @if (savingNote()) {
                    <i class="pi pi-spin pi-spinner mr-1"></i>
                  }
                  Lưu ghi chú
                </button>
              </div>
            </div>

            <!-- Booking History List -->
            <div class="space-y-2 pt-2 border-t border-slate-100">
              <h3 class="text-xs font-bold uppercase tracking-wider text-slate-500">
                Lịch sử các lần đặt phòng tại chuỗi
              </h3>

              @if (loadingHistory()) {
                <div class="py-6 text-center text-slate-400 text-xs">
                  <i class="pi pi-spin pi-spinner mr-1 text-emerald-600"></i> Đang tải lịch sử lưu trú...
                </div>
              } @else if (bookingHistory().length === 0) {
                <div class="py-4 text-center text-slate-400 text-xs">
                  Chưa có lịch sử đặt phòng chi tiết.
                </div>
              } @else {
                <div class="space-y-2 max-h-56 overflow-y-auto">
                  @for (b of bookingHistory(); track b.reservationId) {
                    <div class="p-3 rounded-xl border border-slate-100 bg-white hover:border-slate-300 transition-colors flex items-center justify-between text-xs">
                      <div class="space-y-0.5">
                        <div class="font-bold text-slate-900 flex items-center gap-2">
                          <span>Mã: {{ b.bookingCode }}</span>
                          <span class="text-[10px] font-semibold px-2 py-0.2 rounded bg-slate-100 text-slate-600">
                            {{ b.propertyName }}
                          </span>
                        </div>
                        <div class="text-[11px] text-slate-500">
                          Phòng {{ b.roomNumber }} &bull; {{ b.roomTypeName }} &bull; {{ b.checkInDate }} -> {{ b.checkOutDate }}
                        </div>
                      </div>

                      <div class="text-right">
                        <div class="font-bold text-slate-900">{{ b.totalAmount | number:'1.0-0' }} VNĐ</div>
                        <span class="inline-block px-2 py-0.2 rounded-full text-[10px] font-bold" [ngClass]="getStatusBadge(b.status)">
                          {{ b.status }}
                        </span>
                      </div>
                    </div>
                  }
                </div>
              }
            </div>

            <div class="flex items-center justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                (click)="closeDetailModal()"
                class="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
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

  guestList = signal<GuestDirectoryItemDto[]>([]);
  loading = signal<boolean>(false);
  totalCount = signal<number>(0);
  currentPage = signal<number>(1);
  pageSize = signal<number>(20);

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

  ngOnInit(): void {
    this.loadGuests();
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

  viewGuestDetails(guest: GuestDirectoryItemDto): void {
    this.selectedGuest.set(guest);
    this.noteContent = guest.notes || '';
    this.showDetailModal.set(true);
    this.loadingHistory.set(true);

    this.guestService.getGuestHistory(guest.phoneNumber).subscribe({
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
