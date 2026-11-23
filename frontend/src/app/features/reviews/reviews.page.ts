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
import { HttpErrorResponse } from '@angular/common/http';
import { A11yModule } from '@angular/cdk/a11y';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReviewService } from '../../core/services/review.service';
import { AuthService } from '../../core/services/auth.service';
import { AlertService } from '../../core/services/alert.service';
import { PropertyManagementService } from '../../core/services/property-management.service';
import {
  PmsGuestReviewItemDto,
  PmsReviewsSummaryDto
} from '../../core/models/review.model';
import { TenantPropertySummaryDto } from '../../core/models/public-booking.model';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header';
import { StatCardComponent } from '../../shared/components/stat-card/stat-card.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { PaginationComponent } from '../../shared/components/pagination/pagination.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { BusinessDatePipe, BusinessDateTimePipe } from '../../shared/pipes/business-date.pipe';

const INITIAL_SUMMARY: PmsReviewsSummaryDto = {
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

@Component({
  selector: 'app-reviews',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    A11yModule,
    PageHeaderComponent,
    StatCardComponent,
    StatusBadgeComponent,
    PaginationComponent,
    EmptyStateComponent,
    BusinessDatePipe,
    BusinessDateTimePipe
  ],
  template: `
    <div class="max-w-7xl mx-auto space-y-6 pb-12">
      <!-- 1. PAGE HEADER -->
      <app-page-header
        title="Quản lý Đánh giá Khách hàng"
        subtitle="Theo dõi mức độ hài lòng của khách lưu trú, phản hồi chính thức từ khách sạn và kiểm duyệt hiển thị công khai"
      >
        <button
          type="button"
          (click)="loadReviews()"
          [disabled]="loading()"
          aria-label="Làm mới danh sách đánh giá"
          class="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 text-xs sm:text-sm font-semibold shadow-2xs transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <i class="pi pi-refresh text-xs text-emerald-600" [class.pi-spin]="loading()"></i>
          <span>Làm mới</span>
        </button>
      </app-page-header>

      <!-- 2. SUMMARY KPI CARDS -->
      <section aria-label="Tổng quan chỉ số đánh giá" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <app-stat-card
          title="Điểm trung bình"
          [value]="summary().averageRating.toFixed(1)"
          unit="/ 5.0 sao"
          [subtitle]="summary().totalCount > 0 ? 'Trên ' + summary().totalCount + ' đánh giá' : 'Chưa có đánh giá'"
          variant="amber"
        >
          <i icon class="pi pi-star-fill text-lg"></i>
        </app-stat-card>

        <app-stat-card
          title="Tổng đánh giá"
          [value]="summary().totalCount"
          unit="lượt"
          [subtitle]="'Đang hiển thị công khai: ' + summary().publishedCount"
          variant="emerald"
        >
          <i icon class="pi pi-comments text-lg"></i>
        </app-stat-card>

        <app-stat-card
          title="Chưa phản hồi"
          [value]="summary().unansweredCount"
          unit="đánh giá"
          [subtitle]="'Đã phản hồi: ' + summary().repliedCount"
          variant="indigo"
        >
          <i icon class="pi pi-reply text-lg"></i>
        </app-stat-card>

        <app-stat-card
          title="Đang tạm ẩn"
          [value]="summary().hiddenCount"
          unit="đánh giá"
          subtitle="Ẩn khỏi trang công khai B2C"
          variant="rose"
        >
          <i icon class="pi pi-eye-slash text-lg"></i>
        </app-stat-card>
      </section>

      <!-- 3. RATING HISTOGRAM & SUB-CRITERIA -->
      <section
        aria-label="Phân bố điểm sao và tiêu chí phụ"
        class="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs grid grid-cols-1 lg:grid-cols-12 gap-6 items-center"
      >
        <div class="lg:col-span-7 space-y-2">
          <div class="flex items-center justify-between mb-2">
            <h2 class="text-xs font-bold uppercase tracking-wider text-slate-500">
              Phân bố số sao (Nhấn để lọc nhanh)
            </h2>
            @if (selectedRating(); as activeStar) {
              <button
                type="button"
                (click)="toggleRatingQuickFilter(activeStar)"
                aria-label="Bỏ lọc theo số sao"
                class="inline-flex items-center gap-1.5 min-h-11 px-3 py-2 rounded-lg text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 cursor-pointer transition-colors"
              >
                <i class="pi pi-times text-[10px]"></i>
                <span>Bỏ lọc {{ activeStar }} sao</span>
              </button>
            }
          </div>

          @for (star of [5, 4, 3, 2, 1]; track star) {
            <button
              type="button"
              (click)="toggleRatingQuickFilter(star)"
              [attr.aria-pressed]="selectedRating() === star"
              [attr.aria-label]="'Lọc đánh giá ' + star + ' sao (' + getStarCount(star) + ' đánh giá)'"
              class="w-full min-h-[44px] px-3 py-1.5 rounded-xl flex items-center gap-3 text-xs transition-colors cursor-pointer border"
              [ngClass]="selectedRating() === star
                ? 'bg-amber-50/90 border-amber-300 text-amber-950 font-semibold'
                : 'bg-slate-50/60 border-transparent hover:bg-slate-100/80 text-slate-700'"
            >
              <span class="w-14 flex items-center gap-1 font-bold shrink-0">
                <span>{{ star }}</span>
                <i class="pi pi-star-fill text-amber-500 text-xs"></i>
              </span>
              <div class="flex-1 h-2.5 bg-slate-200/80 rounded-full overflow-hidden">
                <div
                  class="h-full rounded-full transition-all duration-300"
                  [ngClass]="star >= 4 ? 'bg-emerald-500' : (star === 3 ? 'bg-amber-500' : 'bg-rose-500')"
                  [style.width.%]="getStarPercentage(star)"
                ></div>
              </div>
              <span class="w-20 text-right font-mono tabular-nums text-slate-600 shrink-0">
                {{ getStarCount(star) }} ({{ getStarPercentage(star) | number:'1.0-0' }}%)
              </span>
            </button>
          }
        </div>

        <div class="lg:col-span-5 grid grid-cols-2 gap-3">
          <div class="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
            <div class="text-xs font-medium text-slate-500">Vệ sinh &amp; Sạch sẽ</div>
            <div class="text-xl font-extrabold text-slate-900 font-mono tabular-nums">
              {{ summary().cleanlinessAverage.toFixed(1) }} <span class="text-xs font-medium text-slate-400">/ 5</span>
            </div>
          </div>
          <div class="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
            <div class="text-xs font-medium text-slate-500">Vị trí &amp; Di chuyển</div>
            <div class="text-xl font-extrabold text-slate-900 font-mono tabular-nums">
              {{ summary().locationAverage.toFixed(1) }} <span class="text-xs font-medium text-slate-400">/ 5</span>
            </div>
          </div>
          <div class="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
            <div class="text-xs font-medium text-slate-500">Thái độ dịch vụ</div>
            <div class="text-xl font-extrabold text-slate-900 font-mono tabular-nums">
              {{ summary().serviceAverage.toFixed(1) }} <span class="text-xs font-medium text-slate-400">/ 5</span>
            </div>
          </div>
          <div class="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
            <div class="text-xs font-medium text-slate-500">Đáng giá tiền</div>
            <div class="text-xl font-extrabold text-slate-900 font-mono tabular-nums">
              {{ summary().valueAverage.toFixed(1) }} <span class="text-xs font-medium text-slate-400">/ 5</span>
            </div>
          </div>
        </div>
      </section>

      <!-- 4. FILTER BAR -->
      <section aria-label="Bộ lọc danh sách đánh giá" class="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-2xs space-y-4">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
          <!-- Search -->
          <div [ngClass]="showBranchSelector() ? 'lg:col-span-4' : 'lg:col-span-6'">
            <label for="reviews-search-input" class="block text-xs font-bold text-slate-700 mb-1.5">
              Tìm kiếm đánh giá
            </label>
            <div class="relative">
              <i class="pi pi-search absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
              <input
                id="reviews-search-input"
                type="text"
                [ngModel]="searchKeyword()"
                (ngModelChange)="searchKeyword.set($event)"
                (keyup.enter)="applyFilters()"
                placeholder="Tên khách, mã đặt phòng, số phòng, nội dung..."
                class="w-full min-h-[44px] pl-9 pr-3.5 rounded-xl border border-slate-200 bg-slate-50/70 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>
          </div>

          <!-- Branch filter (HQ mode when tenant-wide & no activePropertyId) -->
          @if (showBranchSelector()) {
            <div class="lg:col-span-2">
              <label for="reviews-branch-select" class="block text-xs font-bold text-slate-700 mb-1.5">
                Chi nhánh
              </label>
              <select
                id="reviews-branch-select"
                [ngModel]="selectedPropertyId()"
                (ngModelChange)="onPropertyFilterChange($event)"
                aria-label="Lọc theo chi nhánh"
                class="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              >
                <option value="">Tất cả chi nhánh</option>
                @for (prop of branches(); track prop.id) {
                  <option [value]="prop.id">{{ prop.name }}</option>
                }
              </select>
            </div>
          }

          <!-- Rating select -->
          <div class="lg:col-span-2">
            <label for="reviews-rating-select" class="block text-xs font-bold text-slate-700 mb-1.5">
              Số sao
            </label>
            <select
              id="reviews-rating-select"
              [ngModel]="selectedRatingValue()"
              (ngModelChange)="onRatingSelectChange($event)"
              aria-label="Lọc theo số sao"
              class="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            >
              <option value="">Tất cả mức sao</option>
              <option value="5">5 sao</option>
              <option value="4">4 sao</option>
              <option value="3">3 sao</option>
              <option value="2">2 sao</option>
              <option value="1">1 sao</option>
            </select>
          </div>

          <!-- Reply status select -->
          <div class="lg:col-span-2">
            <label for="reviews-reply-select" class="block text-xs font-bold text-slate-700 mb-1.5">
              Phản hồi
            </label>
            <select
              id="reviews-reply-select"
              [ngModel]="selectedReplyFilter()"
              (ngModelChange)="onReplyFilterChange($event)"
              aria-label="Lọc theo trạng thái phản hồi"
              class="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            >
              <option value="">Tất cả</option>
              <option value="unanswered">Chưa phản hồi</option>
              <option value="replied">Đã phản hồi</option>
            </select>
          </div>

          <!-- Visibility select -->
          <div class="lg:col-span-2">
            <label for="reviews-visibility-select" class="block text-xs font-bold text-slate-700 mb-1.5">
              Hiển thị B2C
            </label>
            <select
              id="reviews-visibility-select"
              [ngModel]="selectedVisibilityFilter()"
              (ngModelChange)="onVisibilityFilterChange($event)"
              aria-label="Lọc theo trạng thái hiển thị"
              class="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            >
              <option value="">Tất cả</option>
              <option value="published">Đang hiển thị</option>
              <option value="hidden">Đang ẩn</option>
            </select>
          </div>
        </div>

        <div class="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
          <div class="text-xs text-slate-500">
            @if (activeBranchLabel()) {
              <span>Phạm vi hiện tại: <strong class="text-slate-800">{{ activeBranchLabel() }}</strong></span>
            } @else {
              <span>Phạm vi: <strong class="text-slate-800">Toàn chuỗi chi nhánh hoạt động</strong></span>
            }
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <button
              type="button"
              (click)="applyFilters()"
              class="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs sm:text-sm font-semibold shadow-2xs transition-colors cursor-pointer"
            >
              <i class="pi pi-filter text-xs"></i>
              <span>Áp dụng lọc</span>
            </button>
            <button
              type="button"
              (click)="resetFilters()"
              class="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
            >
              <i class="pi pi-times text-xs"></i>
              <span>Đặt lại</span>
            </button>
          </div>
        </div>
      </section>

      <!-- 5. ERROR BANNER -->
      @if (errorMessage()) {
        <div role="alert" class="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div class="flex items-start gap-2.5 text-xs sm:text-sm">
            <i class="pi pi-exclamation-triangle text-rose-600 mt-0.5 shrink-0"></i>
            <span>{{ errorMessage() }}</span>
          </div>
          <button
            type="button"
            (click)="loadReviews()"
            class="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold cursor-pointer shrink-0"
          >
            <i class="pi pi-refresh text-xs"></i>
            <span>Thử lại</span>
          </button>
        </div>
      }

      <!-- 6. REVIEWS LIST -->
      <section aria-label="Danh sách đánh giá khách hàng" class="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        @if (loading()) {
          <div role="status" class="p-12 text-center space-y-3 text-slate-500">
            <i class="pi pi-spin pi-spinner text-2xl text-emerald-600"></i>
            <p class="text-xs sm:text-sm font-medium">Đang tải danh sách đánh giá khách hàng...</p>
          </div>
        } @else if (reviews().length === 0) {
          <app-empty-state
            iconClass="pi pi-star"
            title="Chưa có đánh giá phù hợp"
            description="Chưa có đánh giá nào từ khách lưu trú hoặc không có đánh giá khớp với điều kiện lọc hiện tại."
            [actionLabel]="hasActiveFilters() ? 'Xóa bộ lọc' : undefined"
            actionIcon="pi pi-filter-slash"
            (actionClick)="resetFilters()"
          />
        } @else {
          <div class="divide-y divide-slate-200/80">
            @for (review of reviews(); track review.id) {
              <article class="p-5 sm:p-6 space-y-4 hover:bg-slate-50/40 transition-colors">
                <!-- Top metadata row -->
                <div class="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  <div class="flex items-start gap-3.5 min-w-0">
                    <div class="w-11 h-11 rounded-2xl bg-emerald-100 border border-emerald-200 text-emerald-800 font-bold text-sm flex items-center justify-center shrink-0">
                      {{ getGuestInitial(review.guestName) }}
                    </div>
                    <div class="min-w-0 space-y-1">
                      <div class="flex flex-wrap items-center gap-2">
                        <h3 class="text-sm sm:text-base font-bold text-slate-900">{{ review.guestName }}</h3>
                        @if (review.guestPhone) {
                          <span class="text-xs font-mono text-slate-500">{{ review.guestPhone }}</span>
                        }
                        <span class="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 font-mono text-xs font-semibold border border-slate-200">
                          {{ review.confirmationCode }}
                        </span>
                        <app-status-badge
                          [status]="review.isPublished ? 'Hiển thị công khai' : 'Đang ẩn'"
                          [customLabel]="review.isPublished ? 'Hiển thị công khai' : 'Đang ẩn'"
                          [color]="review.isPublished ? 'emerald' : 'rose'"
                        />
                        <app-status-badge
                          [status]="review.ownerReply ? 'Đã phản hồi' : 'Chưa phản hồi'"
                          [customLabel]="review.ownerReply ? 'Đã phản hồi' : 'Chưa phản hồi'"
                          [color]="review.ownerReply ? 'blue' : 'amber'"
                        />
                      </div>

                      <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                        <span class="inline-flex items-center gap-1 font-medium text-slate-700">
                          <i class="pi pi-building text-emerald-600 text-[11px]"></i>
                          <span>{{ review.propertyName }}</span>
                        </span>
                        <span>&bull;</span>
                        <span>
                          Phòng <strong class="text-slate-700">{{ review.roomNumber || '—' }}</strong>
                          @if (review.roomTypeName) {
                            <span>({{ review.roomTypeName }})</span>
                          }
                        </span>
                        <span>&bull;</span>
                        <span>{{ getRentalTypeLabel(review.rentalType) }}</span>
                        @if (review.checkInDate && review.checkOutDate) {
                          <span>&bull;</span>
                          <span class="font-mono">
                            {{ review.checkInDate | businessDate }} → {{ review.checkOutDate | businessDate }}
                          </span>
                        }
                        <span>&bull;</span>
                        <span>Gửi lúc: <strong class="text-slate-700">{{ review.createdAtUtc | businessDateTime }}</strong></span>
                      </div>
                    </div>
                  </div>

                  <!-- Star rating & actions -->
                  <div class="flex flex-wrap items-center gap-3 shrink-0">
                    <div
                      class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200"
                      [attr.aria-label]="'Đánh giá ' + review.rating + ' trên 5 sao'"
                    >
                      <div class="flex items-center gap-0.5 text-amber-500">
                        @for (s of [1, 2, 3, 4, 5]; track s) {
                          <i class="pi text-xs" [ngClass]="s <= review.rating ? 'pi-star-fill' : 'pi-star text-slate-300'"></i>
                        }
                      </div>
                      <span class="text-xs font-extrabold text-amber-900 font-mono">{{ review.rating }}/5</span>
                    </div>
                  </div>
                </div>

                <!-- Sub-criteria chips -->
                @if (hasSubRatings(review)) {
                  <div class="flex flex-wrap items-center gap-2 text-xs">
                    @if (review.cleanlinessRating) {
                      <span class="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-medium">
                        Vệ sinh: <strong>{{ review.cleanlinessRating }}/5</strong>
                      </span>
                    }
                    @if (review.locationRating) {
                      <span class="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-medium">
                        Vị trí: <strong>{{ review.locationRating }}/5</strong>
                      </span>
                    }
                    @if (review.serviceRating) {
                      <span class="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-medium">
                        Dịch vụ: <strong>{{ review.serviceRating }}/5</strong>
                      </span>
                    }
                    @if (review.valueRating) {
                      <span class="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-medium">
                        Đáng giá: <strong>{{ review.valueRating }}/5</strong>
                      </span>
                    }
                  </div>
                }

                <!-- Guest comment -->
                <div class="p-4 rounded-xl bg-slate-50 border border-slate-200/70 text-xs sm:text-sm text-slate-800 leading-relaxed">
                  @if (review.comment) {
                    <p class="whitespace-pre-line">{{ review.comment }}</p>
                  } @else {
                    <p class="italic text-slate-400">Khách lưu trú chỉ chấm điểm sao và không để lại nhận xét chi tiết.</p>
                  }
                </div>

                <!-- Owner Reply -->
                @if (review.ownerReply) {
                  <div class="ml-0 sm:ml-6 p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-1.5">
                    <div class="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span class="font-bold text-emerald-900 flex items-center gap-1.5">
                        <i class="pi pi-verified text-emerald-600"></i>
                        <span>Phản hồi chính thức từ khách sạn</span>
                      </span>
                      @if (review.repliedAtUtc) {
                        <span class="text-emerald-700 font-mono">{{ review.repliedAtUtc | businessDateTime }}</span>
                      }
                    </div>
                    <p class="text-xs sm:text-sm text-emerald-950 whitespace-pre-line leading-relaxed">{{ review.ownerReply }}</p>
                  </div>
                }

                <!-- Action Buttons -->
                @if (canUpdateReviews()) {
                  <div class="flex flex-wrap items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      (click)="openReplyModal(review)"
                      [attr.aria-label]="(review.ownerReply ? 'Chỉnh sửa phản hồi đánh giá của ' : 'Phản hồi đánh giá của ') + review.guestName"
                      class="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs sm:text-sm font-semibold shadow-2xs transition-colors cursor-pointer"
                    >
                      <i class="pi pi-reply text-xs"></i>
                      <span>{{ review.ownerReply ? 'Chỉnh sửa phản hồi' : 'Phản hồi khách' }}</span>
                    </button>

                    <button
                      type="button"
                      (click)="toggleVisibility(review)"
                      [disabled]="togglingReviewId() === review.id"
                      [attr.aria-label]="(review.isPublished ? 'Ẩn đánh giá của ' : 'Hiển thị công khai đánh giá của ') + review.guestName"
                      class="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-xl border text-xs sm:text-sm font-semibold transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                      [ngClass]="review.isPublished
                        ? 'border-rose-200 bg-white hover:bg-rose-50 text-rose-700'
                        : 'border-emerald-200 bg-white hover:bg-emerald-50 text-emerald-700'"
                    >
                      @if (togglingReviewId() === review.id) {
                        <i class="pi pi-spin pi-spinner text-xs"></i>
                        <span>Đang cập nhật...</span>
                      } @else {
                        <i class="pi text-xs" [ngClass]="review.isPublished ? 'pi-eye-slash' : 'pi-eye'"></i>
                        <span>{{ review.isPublished ? 'Ẩn đánh giá' : 'Hiển thị lại' }}</span>
                      }
                    </button>
                  </div>
                }
              </article>
            }
          </div>

          <app-pagination
            [page]="page()"
            [pageSize]="pageSize()"
            [totalCount]="totalCount()"
            [pageSizeOptions]="[10, 20, 50]"
            (pageChange)="onPageChange($event)"
            (pageSizeChange)="onPageSizeChange($event)"
          />
        }
      </section>
    </div>

    <!-- REPLY MODAL DIALOG -->
    @if (replyModalReview(); as target) {
      <div
        class="fixed inset-0 z-[65] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reply-modal-title"
        cdkTrapFocus
        [cdkTrapFocusAutoCapture]="true"
        (click)="closeReplyModal()"
      >
        <div
          (click)="$event.stopPropagation()"
          class="bg-white rounded-2xl border border-slate-200 max-w-lg w-full shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
        >
          <div class="p-5 border-b border-slate-100 flex items-start justify-between gap-3 bg-slate-50/70">
            <div>
              <h2 id="reply-modal-title" class="text-base font-bold text-slate-900">
                {{ target.ownerReply ? 'Chỉnh sửa phản hồi đánh giá' : 'Phản hồi đánh giá khách hàng' }}
              </h2>
              <p class="text-xs text-slate-500 mt-0.5">
                Khách: <strong class="text-slate-700">{{ target.guestName }}</strong> &bull;
                Mã đơn: <strong class="font-mono text-slate-700">{{ target.confirmationCode }}</strong>
              </p>
            </div>
            <button
              type="button"
              (click)="closeReplyModal()"
              [disabled]="replySubmitting()"
              aria-label="Đóng hộp thoại phản hồi"
              class="inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <i class="pi pi-times text-sm"></i>
            </button>
          </div>

          <div class="p-5 space-y-4">
            <div class="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-700 space-y-1">
              <div class="flex items-center gap-2 font-bold text-amber-700">
                <span>Đánh giá {{ target.rating }}/5 sao</span>
              </div>
              <p class="leading-relaxed">{{ target.comment || 'Khách không để lại nhận xét văn bản.' }}</p>
            </div>

            <div class="space-y-1.5">
              <div class="flex items-center justify-between text-xs">
                <label for="owner-reply-textarea" class="font-bold text-slate-700">
                  Nội dung phản hồi chính thức <span class="text-rose-500">*</span>
                </label>
                <span class="font-mono text-slate-400">{{ replyDraft().length }}/2000</span>
              </div>
              <textarea
                id="owner-reply-textarea"
                rows="4"
                maxlength="2000"
                [ngModel]="replyDraft()"
                (ngModelChange)="replyDraft.set($event); replyError.set('')"
                placeholder="Cảm ơn Quý khách đã lưu trú và chia sẻ góp ý..."
                class="w-full p-3.5 rounded-xl border border-slate-300 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              ></textarea>
              @if (replyError()) {
                <p role="alert" class="text-xs text-rose-600 font-medium flex items-center gap-1.5">
                  <i class="pi pi-exclamation-circle text-xs"></i>
                  <span>{{ replyError() }}</span>
                </p>
              }
            </div>
          </div>

          <div class="p-4 sm:p-5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              (click)="closeReplyModal()"
              [disabled]="replySubmitting()"
              class="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold cursor-pointer disabled:opacity-50"
            >
              <span>Hủy bỏ</span>
            </button>
            <button
              type="button"
              (click)="submitReply()"
              [disabled]="replySubmitting()"
              class="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-semibold shadow-2xs cursor-pointer disabled:opacity-50"
            >
              @if (replySubmitting()) {
                <i class="pi pi-spin pi-spinner text-xs"></i>
                <span>Đang lưu phản hồi...</span>
              } @else {
                <i class="pi pi-send text-xs"></i>
                <span>Lưu phản hồi</span>
              }
            </button>
          </div>
        </div>
      </div>
    }
  `
})
export class ReviewsPage implements OnInit {
  private readonly reviewService = inject(ReviewService);
  private readonly authService = inject(AuthService);
  private readonly alertService = inject(AlertService);
  private readonly propertyService = inject(PropertyManagementService);
  private readonly destroyRef = inject(DestroyRef);

  readonly reviews = signal<PmsGuestReviewItemDto[]>([]);
  readonly summary = signal<PmsReviewsSummaryDto>(INITIAL_SUMMARY);
  readonly branches = signal<TenantPropertySummaryDto[]>([]);
  readonly totalCount = signal<number>(0);
  readonly page = signal<number>(1);
  readonly pageSize = signal<number>(20);
  readonly loading = signal<boolean>(false);
  readonly errorMessage = signal<string>('');
  readonly togglingReviewId = signal<string | null>(null);

  // Filters
  readonly searchKeyword = signal<string>('');
  readonly selectedPropertyId = signal<string>('');
  readonly selectedRating = signal<number | null>(null);
  readonly selectedReplyFilter = signal<'' | 'unanswered' | 'replied'>('');
  readonly selectedVisibilityFilter = signal<'' | 'published' | 'hidden'>('');

  // Reply Modal State
  readonly replyModalReview = signal<PmsGuestReviewItemDto | null>(null);
  readonly replyDraft = signal<string>('');
  readonly replySubmitting = signal<boolean>(false);
  readonly replyError = signal<string>('');

  readonly selectedRatingValue = computed(() =>
    this.selectedRating() !== null ? String(this.selectedRating()) : ''
  );

  readonly showBranchSelector = computed(() =>
    this.authService.isTenantWide && !this.authService.activePropertyId()
  );

  readonly activeBranchLabel = computed(() => {
    const activeName = this.authService.activePropertyName();
    if (activeName) return activeName;

    const selectedId = this.selectedPropertyId();
    if (selectedId) {
      return this.branches().find(b => b.id === selectedId)?.name ?? '';
    }
    return '';
  });

  readonly canUpdateReviews = computed(() =>
    this.authService.hasPermission('REVIEWS', 4)
  );

  readonly hasActiveFilters = computed(() =>
    Boolean(
      this.searchKeyword().trim() ||
      this.selectedPropertyId() ||
      this.selectedRating() !== null ||
      this.selectedReplyFilter() ||
      this.selectedVisibilityFilter()
    )
  );

  ngOnInit(): void {
    if (this.showBranchSelector()) {
      this.loadBranches();
    }
    this.loadReviews();
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.replyModalReview() && !this.replySubmitting()) {
      this.closeReplyModal();
    }
  }

  private loadBranches(): void {
    if (!this.authService.hasPermission('PROPERTIES', 1)) {
      this.branches.set([]);
      return;
    }
    this.propertyService
      .getTenantProperties()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: props => this.branches.set(props.filter(p => p.isActive)),
        error: () => {
          // Non-blocking: branch dropdown remains empty if user lacks PROPERTIES:Read
        }
      });
  }

  loadReviews(): void {
    this.loading.set(true);
    this.errorMessage.set('');

    const replyFilter = this.selectedReplyFilter();
    const visibilityFilter = this.selectedVisibilityFilter();

    this.reviewService
      .getReviews({
        propertyId: this.selectedPropertyId() || null,
        rating: this.selectedRating(),
        hasReply: replyFilter === '' ? null : replyFilter === 'replied',
        isPublished: visibilityFilter === '' ? null : visibilityFilter === 'published',
        search: this.searchKeyword().trim() || undefined,
        page: this.page(),
        pageSize: this.pageSize()
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: result => {
          this.loading.set(false);
          this.reviews.set(result.items);
          this.totalCount.set(result.totalCount);
          this.page.set(result.page);
          this.pageSize.set(result.pageSize);
          this.summary.set(result.summary ?? INITIAL_SUMMARY);
        },
        error: (err: unknown) => {
          this.loading.set(false);
          this.errorMessage.set(
            this.extractErrorMessage(err, 'Không thể tải danh sách đánh giá. Vui lòng thử lại.')
          );
        }
      });
  }

  applyFilters(): void {
    this.page.set(1);
    this.loadReviews();
  }

  resetFilters(): void {
    this.searchKeyword.set('');
    this.selectedPropertyId.set('');
    this.selectedRating.set(null);
    this.selectedReplyFilter.set('');
    this.selectedVisibilityFilter.set('');
    this.page.set(1);
    this.loadReviews();
  }

  onPropertyFilterChange(propertyId: string): void {
    this.selectedPropertyId.set(propertyId);
    this.page.set(1);
    this.loadReviews();
  }

  onRatingSelectChange(value: string): void {
    const parsed = Number(value);
    this.selectedRating.set(value && Number.isInteger(parsed) ? parsed : null);
    this.page.set(1);
    this.loadReviews();
  }

  toggleRatingQuickFilter(star: number): void {
    this.selectedRating.set(this.selectedRating() === star ? null : star);
    this.page.set(1);
    this.loadReviews();
  }

  onReplyFilterChange(value: string): void {
    if (value === 'unanswered' || value === 'replied' || value === '') {
      this.selectedReplyFilter.set(value);
      this.page.set(1);
      this.loadReviews();
    }
  }

  onVisibilityFilterChange(value: string): void {
    if (value === 'published' || value === 'hidden' || value === '') {
      this.selectedVisibilityFilter.set(value);
      this.page.set(1);
      this.loadReviews();
    }
  }

  onPageChange(nextPage: number): void {
    this.page.set(nextPage);
    this.loadReviews();
  }

  onPageSizeChange(nextSize: number): void {
    this.pageSize.set(nextSize);
    this.page.set(1);
    this.loadReviews();
  }

  openReplyModal(review: PmsGuestReviewItemDto): void {
    this.replyModalReview.set(review);
    this.replyDraft.set(review.ownerReply ?? '');
    this.replyError.set('');
  }

  closeReplyModal(): void {
    if (this.replySubmitting()) return;
    this.replyModalReview.set(null);
    this.replyDraft.set('');
    this.replyError.set('');
  }

  submitReply(): void {
    const target = this.replyModalReview();
    if (!target || this.replySubmitting()) return;

    const trimmed = this.replyDraft().trim();
    if (!trimmed) {
      this.replyError.set('Vui lòng nhập nội dung phản hồi trước khi lưu.');
      return;
    }
    if (trimmed.length > 2000) {
      this.replyError.set('Nội dung phản hồi không được vượt quá 2000 ký tự.');
      return;
    }

    this.replySubmitting.set(true);
    this.replyError.set('');

    this.reviewService
      .replyReview(target.id, trimmed)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: updated => {
          this.replySubmitting.set(false);
          this.replyModalReview.set(null);
          this.replyDraft.set('');
          this.alertService.toastSuccess('Đã lưu phản hồi đánh giá thành công.');
          this.applyUpdatedItem(updated);
        },
        error: (err: unknown) => {
          this.replySubmitting.set(false);
          const msg = this.extractErrorMessage(err, 'Không thể gửi phản hồi đánh giá.');
          this.replyError.set(msg);
        }
      });
  }

  toggleVisibility(review: PmsGuestReviewItemDto): void {
    if (this.togglingReviewId()) return;

    const nextPublished = !review.isPublished;
    this.togglingReviewId.set(review.id);

    this.reviewService
      .toggleVisibility(review.id, nextPublished)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: updated => {
          this.togglingReviewId.set(null);
          this.alertService.toastSuccess(
            updated.isPublished
              ? 'Đánh giá đã được hiển thị công khai.'
              : 'Đánh giá đã được ẩn khỏi trang công khai.'
          );
          this.applyUpdatedItem(updated);
        },
        error: (err: unknown) => {
          this.togglingReviewId.set(null);
          this.alertService.toastError(
            this.extractErrorMessage(err, 'Không thể cập nhật trạng thái hiển thị.')
          );
        }
      });
  }

  getStarCount(star: number): number {
    return this.summary().ratingDistribution?.[star] ?? 0;
  }

  getStarPercentage(star: number): number {
    const total = this.summary().totalCount;
    if (!total || total <= 0) return 0;
    return Math.round((this.getStarCount(star) / total) * 100);
  }

  getGuestInitial(name: string): string {
    const trimmed = name?.trim();
    return trimmed ? trimmed.charAt(0).toUpperCase() : 'K';
  }

  getRentalTypeLabel(rentalType: string): string {
    switch (rentalType) {
      case 'Hourly':
        return 'Theo giờ';
      case 'Overnight':
        return 'Qua đêm';
      case 'Daily':
        return 'Theo ngày';
      default:
        return rentalType || 'Theo ngày';
    }
  }

  hasSubRatings(review: PmsGuestReviewItemDto): boolean {
    return Boolean(
      review.cleanlinessRating ||
      review.locationRating ||
      review.serviceRating ||
      review.valueRating
    );
  }

  private applyUpdatedItem(updated: PmsGuestReviewItemDto): void {
    const previous = this.reviews().find(r => r.id === updated.id);
    this.reviews.update(list => list.map(item => (item.id === updated.id ? updated : item)));

    if (previous) {
      this.summary.update(curr => {
        const wasReplied = Boolean(previous.ownerReply?.trim());
        const isReplied = Boolean(updated.ownerReply?.trim());
        const repliedDelta = (isReplied ? 1 : 0) - (wasReplied ? 1 : 0);

        const publishedDelta = (updated.isPublished ? 1 : 0) - (previous.isPublished ? 1 : 0);

        return {
          ...curr,
          repliedCount: Math.max(0, curr.repliedCount + repliedDelta),
          unansweredCount: Math.max(0, curr.unansweredCount - repliedDelta),
          publishedCount: Math.max(0, curr.publishedCount + publishedDelta),
          hiddenCount: Math.max(0, curr.hiddenCount - publishedDelta)
        };
      });
    }

    // Re-sync with server if an active filter may exclude the updated row
    if (this.selectedReplyFilter() || this.selectedVisibilityFilter()) {
      this.loadReviews();
    }
  }

  private extractErrorMessage(err: unknown, fallback: string): string {
    if (err instanceof HttpErrorResponse) {
      const payload = err.error as { message?: unknown } | null;
      if (payload && typeof payload.message === 'string' && payload.message.trim().length > 0) {
        return payload.message;
      }
      if (err.status === 403) {
        return 'Bạn không có quyền thực hiện thao tác này trên chi nhánh hiện tại.';
      }
    } else if (err && typeof err === 'object') {
      const maybeObj = err as { error?: { message?: unknown }; message?: unknown };
      if (typeof maybeObj.error?.message === 'string' && maybeObj.error.message.trim().length > 0) {
        return maybeObj.error.message;
      }
      if (typeof maybeObj.message === 'string' && maybeObj.message.trim().length > 0) {
        return maybeObj.message;
      }
    }
    return fallback;
  }
}

export { ReviewsPage as ReviewsPageComponent };
