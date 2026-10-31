import { ChangeDetectionStrategy, Component, HostListener, OnInit, computed, effect, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuditLogService } from '../../core/services/audit-log.service';
import { AuthService } from '../../core/services/auth.service';
import { AlertService } from '../../core/services/alert.service';
import { AuditFieldChange, AuditLogDetail, AuditLogFilterParams, AuditLogListItem } from '../../core/models/audit-log.model';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header';
import { PaginationComponent } from '../../shared/components/pagination/pagination.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-audit-logs-page',
  standalone: true,
  imports: [CommonModule, FormsModule, PageHeaderComponent, PaginationComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      <!-- 1. PAGE HEADER -->
      <app-page-header
        [title]="'Nhật ký kiểm toán (Audit Logs)'"
        subtitle="Theo dõi và tra cứu toàn bộ lịch sử chỉnh sửa giá phòng, phụ thu và các thao tác quan trọng trong hệ thống"
      >
        <button
          type="button"
          (click)="loadAuditLogs()"
          [disabled]="loading()"
          class="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 active:bg-slate-100 shadow-2xs transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          title="Tải lại danh sách"
        >
          <i class="pi pi-refresh text-xs text-indigo-600" [class.pi-spin]="loading()"></i>
          <span>Làm mới</span>
        </button>
      </app-page-header>

      <!-- 2. PHÂN QUYỀN: BẢO VỆ CHỈ OWNER / MANAGER -->
      @if (!isAuthorized()) {
        <div role="alert" class="p-6 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 shadow-2xs space-y-2">
          <div class="flex items-center gap-3">
            <i class="pi pi-lock text-xl text-amber-600"></i>
            <h2 class="text-sm font-bold uppercase tracking-wider">Hạn chế quyền truy cập</h2>
          </div>
          <p class="text-xs sm:text-sm text-amber-800 leading-relaxed">
            Chức năng Nhật ký kiểm toán chỉ dành riêng cho Chủ khách sạn (Owner) và Quản lý (Manager). Tài khoản của bạn không có quyền xem lịch sử kiểm toán.
          </p>
        </div>
      } @else {

        <!-- 3. BỘ LỌC TÌM KIẾM (FILTER BAR) -->
        <section aria-label="Bộ lọc nhật ký kiểm toán" class="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <!-- Lọc Hành động -->
            <div>
              <label for="filter-action" class="block text-xs font-bold text-slate-700 mb-1.5">
                Hành động
              </label>
              <select
                id="filter-action"
                [(ngModel)]="selectedAction"
                (change)="onFilterChange()"
                class="w-full h-10 px-3 rounded-xl border border-slate-200 bg-slate-50/50 text-xs text-slate-800 focus:bg-white focus:outline-indigo-500 transition-all cursor-pointer"
              >
                <option value="">Tất cả hành động</option>
                <option value="Create">Tạo mới (Create)</option>
                <option value="Update">Chỉnh sửa (Update)</option>
                <option value="Delete">Xóa (Delete)</option>
              </select>
            </div>

            <!-- Lọc Loại đối tượng -->
            <div>
              <label for="filter-entity" class="block text-xs font-bold text-slate-700 mb-1.5">
                Đối tượng thay đổi
              </label>
              <select
                id="filter-entity"
                [(ngModel)]="selectedEntityName"
                (change)="onFilterChange()"
                class="w-full h-10 px-3 rounded-xl border border-slate-200 bg-slate-50/50 text-xs text-slate-800 focus:bg-white focus:outline-indigo-500 transition-all cursor-pointer"
              >
                <option value="">Tất cả đối tượng</option>
                <option value="RoomTypeRate">Bảng giá phòng (RoomTypeRate)</option>
                <option value="PropertySurchargePolicy">Phụ thu chi nhánh (SurchargePolicy)</option>
                <option value="Invoice">Hóa đơn (Invoice)</option>
              </select>
            </div>

            <!-- Từ ngày -->
            <div>
              <label for="filter-from-date" class="block text-xs font-bold text-slate-700 mb-1.5">
                Từ ngày
              </label>
              <input
                id="filter-from-date"
                type="date"
                [(ngModel)]="fromDate"
                (change)="onFilterChange()"
                class="w-full h-10 px-3 rounded-xl border border-slate-200 bg-slate-50/50 text-xs text-slate-800 focus:bg-white focus:outline-indigo-500 transition-all"
              />
            </div>

            <!-- Đến ngày -->
            <div>
              <label for="filter-to-date" class="block text-xs font-bold text-slate-700 mb-1.5">
                Đến ngày
              </label>
              <input
                id="filter-to-date"
                type="date"
                [(ngModel)]="toDate"
                (change)="onFilterChange()"
                class="w-full h-10 px-3 rounded-xl border border-slate-200 bg-slate-50/50 text-xs text-slate-800 focus:bg-white focus:outline-indigo-500 transition-all"
              />
            </div>
          </div>

          <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
            <!-- Tìm kiếm tự do / ID -->
            <div class="relative flex-1 max-w-md">
              <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
              <input
                type="text"
                [(ngModel)]="searchKeyword"
                (keyup.enter)="onFilterChange()"
                placeholder="Tìm theo Mã bản ghi hoặc ID đối tượng..."
                class="w-full h-9 pl-9 pr-3 rounded-xl border border-slate-200 bg-slate-50/50 text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-indigo-500 transition-all"
              />
            </div>

            <div class="flex items-center gap-2">
              <button
                type="button"
                (click)="onFilterChange()"
                class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold text-xs shadow-2xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <i class="pi pi-filter text-xs"></i>
                <span>Lọc dữ liệu</span>
              </button>
              <button
                type="button"
                (click)="resetFilters()"
                class="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-semibold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <i class="pi pi-times text-xs"></i>
                <span>Đặt lại</span>
              </button>
            </div>
          </div>
        </section>

        <!-- 4. THÔNG BÁO LỖI NẾU CÓ -->
        @if (errorMessage()) {
          <div role="alert" class="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center justify-between gap-2 shadow-2xs">
            <div class="flex items-center gap-2">
              <i class="pi pi-exclamation-circle text-rose-600 shrink-0"></i>
              <span>{{ errorMessage() }}</span>
            </div>
            <button type="button" (click)="errorMessage.set('')" class="text-rose-400 hover:text-rose-600 p-1 rounded cursor-pointer" aria-label="Đóng thông báo">
              <i class="pi pi-times text-xs"></i>
            </button>
          </div>
        }

        <!-- 5. BẢNG DANH SÁCH NHẬT KÝ KIỂM TOÁN -->
        <div class="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
          @if (loading()) {
            <div role="status" class="p-12 text-center space-y-3">
              <div class="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto"></div>
              <p class="text-xs font-semibold text-slate-500">Đang tải nhật ký kiểm toán...</p>
            </div>
          } @else if (auditLogs().length === 0) {
            <div class="p-8">
              <app-empty-state
                title="Chưa có dữ liệu kiểm toán"
                description="Không tìm thấy bản ghi nhật ký kiểm toán nào khớp với bộ lọc hiện tại."
                icon="pi-history"
              ></app-empty-state>
            </div>
          } @else {
            <div class="overflow-x-auto">
              <table class="w-full text-left text-xs text-slate-700">
                <thead class="bg-slate-50/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th scope="col" class="py-3 px-4">Thời gian</th>
                    <th scope="col" class="py-3 px-4">Người thực hiện</th>
                    <th scope="col" class="py-3 px-4">Hành động</th>
                    <th scope="col" class="py-3 px-4">Đối tượng</th>
                    <th scope="col" class="py-3 px-4">Tóm tắt thay đổi</th>
                    <th scope="col" class="py-3 px-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  @for (log of auditLogs(); track log.id) {
                    <tr class="hover:bg-slate-50/60 transition-colors">
                      <!-- Thời gian -->
                      <td class="py-3.5 px-4 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                        <div class="font-bold text-slate-800">{{ formatVietnamDate(log.createdAtUtc) }}</div>
                        <div class="text-[10px] text-slate-400">{{ formatVietnamTime(log.createdAtUtc) }}</div>
                      </td>

                      <!-- Người thực hiện -->
                      <td class="py-3.5 px-4">
                        @if (log.userFullName) {
                          <div class="font-semibold text-slate-800">{{ log.userFullName }}</div>
                          @if (log.userEmail) {
                            <div class="text-[10px] text-slate-400 font-mono">{{ log.userEmail }}</div>
                          }
                        } @else {
                          <span class="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 italic">
                            <i class="pi pi-cog text-[10px]"></i> Hệ thống
                          </span>
                        }
                      </td>

                      <!-- Hành động -->
                      <td class="py-3.5 px-4 whitespace-nowrap">
                        <span
                          class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border"
                          [ngClass]="getActionBadgeClass(log.action)"
                        >
                          <i class="pi text-[10px]" [ngClass]="getActionIcon(log.action)"></i>
                          <span>{{ getActionLabel(log.action) }}</span>
                        </span>
                      </td>

                      <!-- Đối tượng -->
                      <td class="py-3.5 px-4">
                        <div class="font-bold text-slate-800">{{ getEntityDisplayLabel(log.entityName) }}</div>
                        <div class="text-[10px] font-mono text-slate-400 truncate max-w-[150px]" [title]="log.entityId">
                          ID: {{ log.entityId }}
                        </div>
                      </td>

                      <!-- Tóm tắt thay đổi (Thân thiện) -->
                      <td class="py-3.5 px-4 max-w-xs sm:max-w-md">
                        <p class="text-xs text-slate-700 line-clamp-2 leading-relaxed font-medium" [title]="log.changeSummary">
                          {{ getFriendlySummary(log.changeSummary, log.action, log.entityName) }}
                        </p>
                        @if (log.changedFields && log.changedFields.length > 0) {
                          <div class="flex flex-wrap gap-1 mt-1">
                            @for (field of log.changedFields; track field) {
                              <span
                                class="inline-block px-1.5 py-0.2 rounded text-[10px] font-medium"
                                [ngClass]="isTechnicalField(field) ? 'bg-slate-100 text-slate-500' : 'bg-indigo-50 text-indigo-700 border border-indigo-100'"
                              >
                                {{ getFieldDisplayLabel(field) }}
                              </span>
                            }
                          </div>
                        }
                      </td>

                      <!-- Nút thao tác (Yêu cầu 2: Update -> So sánh, Create/Delete -> Xem chi tiết) -->
                      <td class="py-3.5 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          (click)="openDetail(log.id)"
                          class="px-3 py-1.5 rounded-xl border font-bold text-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                          [ngClass]="log.action === 'Update'
                            ? 'border-indigo-200 bg-indigo-50/60 hover:bg-indigo-100/80 active:bg-indigo-200 text-indigo-700'
                            : 'border-slate-200 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-slate-700'"
                          [title]="log.action === 'Update' ? 'Xem so sánh chi tiết trước và sau thay đổi' : 'Xem chi tiết dữ liệu kiểm toán'"
                        >
                          <i class="pi text-xs" [ngClass]="getActionButtonIcon(log.action)"></i>
                          <span>{{ getActionButtonLabel(log.action) }}</span>
                        </button>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>

            <!-- Phân trang -->
            <app-pagination
              [page]="currentPage()"
              [pageSize]="pageSize()"
              [totalCount]="totalRecords()"
              [pageSizeOptions]="[10, 20, 50, 100]"
              (pageChange)="onPageChange($event)"
              (pageSizeChange)="onPageSizeChange($event)"
            ></app-pagination>
          }
        </div>
      }
    </div>

    <!-- 6. MODAL SO SÁNH / CHI TIẾT THAY ĐỔI (DIFF DETAIL MODAL) -->
    <!-- Đặt ngoài container space-y-6 để loại bỏ margin-top và che phủ hoàn hảo viewport -->
    @if (isDetailModalOpen()) {
      <div
        class="fixed inset-0 top-0 left-0 right-0 bottom-0 z-[100] !m-0 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-md overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-audit-title"
        (click)="closeDetailModal()"
      >
        <div
          (click)="$event.stopPropagation()"
          class="bg-white rounded-3xl border border-slate-200 max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden my-auto animate-in zoom-in-95 duration-200"
        >
          <!-- Modal Header (Sticky Top) -->
          <div class="p-5 sm:p-6 border-b border-slate-100 flex items-start justify-between gap-4 bg-slate-50/70 shrink-0">
            <div class="space-y-1">
              <div class="flex items-center gap-2">
                <span
                  class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border"
                  [ngClass]="getActionBadgeClass(selectedDetail()?.action)"
                >
                  <i class="pi text-[10px]" [ngClass]="getActionIcon(selectedDetail()?.action)"></i>
                  <span>{{ getActionLabel(selectedDetail()?.action) }}</span>
                </span>
                <span class="text-xs font-mono font-bold text-slate-500">
                  {{ getEntityDisplayLabel(selectedDetail()?.entityName) }}
                </span>
              </div>
              <h2 id="modal-audit-title" class="text-lg font-black text-slate-900 tracking-tight">
                {{ selectedDetail()?.action === 'Update' ? 'So sánh chi tiết thay đổi' : 'Chi tiết nhật ký kiểm toán' }}
              </h2>
              <p class="text-xs text-slate-500">
                Thời điểm: <strong class="text-slate-800">{{ formatVietnamFullDateTime(selectedDetail()?.createdAtUtc) }}</strong>
              </p>
            </div>
            <button
              type="button"
              (click)="closeDetailModal()"
              class="text-slate-400 hover:text-slate-600 active:text-slate-800 p-2 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="Đóng cửa sổ chi tiết (Esc)"
              title="Đóng (Esc)"
            >
              <i class="pi pi-times text-base"></i>
            </button>
          </div>

          <!-- Modal Body (Scrollable) -->
          <div class="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 min-h-0">
            @if (isDetailLoading()) {
              <div class="p-12 text-center space-y-3">
                <div class="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto"></div>
                <p class="text-xs font-semibold text-slate-500">Đang tải chi tiết thay đổi...</p>
              </div>
            } @else if (selectedDetail(); as item) {
              <!-- Metadata Overview Box -->
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-100 text-xs">
                <div>
                  <span class="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Người thao tác</span>
                  <span class="font-bold text-slate-800">{{ item.userFullName || 'Hệ thống' }}</span>
                  @if (item.userEmail) {
                    <span class="block text-[10px] font-mono text-slate-400">{{ item.userEmail }}</span>
                  }
                </div>

                <div>
                  <span class="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Chi nhánh áp dụng</span>
                  <span class="font-bold text-slate-800">{{ item.propertyName || 'Toàn hệ thống (HQ)' }}</span>
                  @if (item.propertyCode) {
                    <span class="text-[10px] font-mono text-slate-400 block">Mã: {{ item.propertyCode }}</span>
                  }
                </div>

                <div>
                  <span class="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Địa chỉ IP</span>
                  <span class="font-mono font-bold text-slate-800">{{ item.ipAddress || 'Không xác định' }}</span>
                </div>

                <!-- Entity ID kèm nút Sao chép ID phục vụ kiểm toán -->
                <div class="sm:col-span-2 lg:col-span-3 pt-2 border-t border-slate-200/50 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span class="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Mã định danh đối tượng (Entity ID)</span>
                    <span class="font-mono text-xs font-bold text-indigo-900 select-all break-all">{{ item.entityId }}</span>
                  </div>
                  <button
                    type="button"
                    (click)="copyToClipboard(item.entityId, 'Mã định danh đối tượng')"
                    class="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-[11px] font-semibold text-slate-700 flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    title="Sao chép Entity ID"
                  >
                    <i class="pi pi-copy text-xs text-indigo-600"></i>
                    <span>Sao chép ID</span>
                  </button>
                </div>
              </div>

              <!-- Tóm tắt thay đổi (Thân thiện + Tùy chọn xem chuỗi gốc) -->
              @if (item.changeSummary) {
                <div class="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-100/90 text-xs text-indigo-950 space-y-1.5">
                  <div class="flex items-center gap-1.5 font-bold text-indigo-900">
                    <i class="pi pi-info-circle text-indigo-600"></i>
                    <span>Tóm tắt nội dung nghiệp vụ:</span>
                  </div>
                  <p class="font-semibold text-slate-800 leading-relaxed text-xs sm:text-sm pl-4">
                    {{ getFriendlySummary(item.changeSummary, item.action, item.entityName) }}
                  </p>
                  @if (item.changeSummary !== getFriendlySummary(item.changeSummary, item.action, item.entityName)) {
                    <details class="text-[11px] text-slate-500 pl-4 pt-1 border-t border-indigo-100/60">
                      <summary class="cursor-pointer text-indigo-600 hover:text-indigo-800 font-medium select-none">
                        Xem chuỗi ghi nhận gốc từ hệ thống
                      </summary>
                      <div class="mt-1 font-mono text-[10px] text-slate-600 bg-white/80 p-2 rounded-lg border border-slate-200 break-all select-all">
                        {{ item.changeSummary }}
                      </div>
                    </details>
                  }
                </div>
              }

              <!-- BẢNG CHI TIẾT THAY ĐỔI PHÂN BIỆT THEO ACTION (YÊU CẦU 1) -->
              @if (item.action === 'Create') {
                <!-- 1A. CREATE: THÔNG TIN ĐƯỢC TẠO MỚI (1 CỘT GIÁ TRỊ MỚI, KHÔNG CÓ CỘT CŨ TOÀN DẤU GẠCH) -->
                <div class="space-y-3">
                  <div class="flex items-center justify-between">
                    <h3 class="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-2">
                      <i class="pi pi-plus-circle text-emerald-600 text-sm"></i>
                      <span>Thông tin được tạo mới ({{ getBusinessChanges(item.changes).length }} thuộc tính)</span>
                    </h3>
                    <span class="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                      Khởi tạo ban đầu
                    </span>
                  </div>

                  @if (getBusinessChanges(item.changes).length > 0) {
                    <div class="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                      <table class="w-full text-left text-xs">
                        <thead class="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                          <tr>
                            <th scope="col" class="py-2.5 px-4 w-1/3">Thuộc tính thiết lập</th>
                            <th scope="col" class="py-2.5 px-4 w-2/3 bg-emerald-50/40 text-emerald-800">Giá trị khởi tạo</th>
                          </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100 text-xs">
                          @for (change of getBusinessChanges(item.changes); track change.fieldName) {
                            <tr class="hover:bg-slate-50/50 transition-colors">
                              <td class="py-3 px-4">
                                <div class="font-bold text-slate-800">{{ getFieldDisplayLabel(change.fieldName) }}</div>
                                <div class="text-[10px] font-mono text-slate-400">{{ change.fieldName }}</div>
                              </td>
                              <td class="py-3 px-4 bg-emerald-50/15 text-emerald-950 break-words select-all">
                                <span class="inline-block px-2.5 py-1 rounded-lg bg-emerald-100/70 border border-emerald-200 font-bold text-xs text-emerald-900">
                                  {{ formatFieldValue(change.fieldName, change.newValue) }}
                                </span>
                              </td>
                            </tr>
                          }
                        </tbody>
                      </table>
                    </div>
                  } @else {
                    <div class="p-5 text-center border border-dashed border-slate-200 rounded-2xl text-xs text-slate-500 bg-slate-50/50">
                      Thao tác tạo mới bản ghi thành công trên hệ thống. Xem thông tin kỹ thuật bên dưới để đối soát các mã liên kết.
                    </div>
                  }
                </div>
              } @else if (item.action === 'Delete') {
                <!-- 1B. DELETE: THÔNG TIN TRƯỚC KHI XÓA (1 CỘT GIÁ TRỊ CŨ, KHÔNG GIẢ ĐỊNH CÓ GIÁ TRỊ MỚI) -->
                <div class="space-y-3">
                  <div class="flex items-center justify-between">
                    <h3 class="text-xs font-bold text-rose-800 uppercase tracking-wider flex items-center gap-2">
                      <i class="pi pi-trash text-rose-600 text-sm"></i>
                      <span>Thông tin trước khi xóa ({{ getBusinessChanges(item.changes).length }} thuộc tính)</span>
                    </h3>
                    <span class="text-[11px] font-semibold text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200">
                      Đã xóa khỏi hệ thống
                    </span>
                  </div>

                  @if (getBusinessChanges(item.changes).length > 0) {
                    <div class="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                      <table class="w-full text-left text-xs">
                        <thead class="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                          <tr>
                            <th scope="col" class="py-2.5 px-4 w-1/3">Thuộc tính</th>
                            <th scope="col" class="py-2.5 px-4 w-2/3 bg-rose-50/40 text-rose-800">Giá trị trước khi xóa</th>
                          </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100 text-xs">
                          @for (change of getBusinessChanges(item.changes); track change.fieldName) {
                            <tr class="hover:bg-slate-50/50 transition-colors">
                              <td class="py-3 px-4">
                                <div class="font-bold text-slate-800">{{ getFieldDisplayLabel(change.fieldName) }}</div>
                                <div class="text-[10px] font-mono text-slate-400">{{ change.fieldName }}</div>
                              </td>
                              <td class="py-3 px-4 bg-rose-50/15 text-rose-950 break-words select-all">
                                <span class="inline-block px-2.5 py-1 rounded-lg bg-rose-100/70 border border-rose-200 font-semibold text-xs text-rose-900 line-through">
                                  {{ formatFieldValue(change.fieldName, change.oldValue) }}
                                </span>
                              </td>
                            </tr>
                          }
                        </tbody>
                      </table>
                    </div>
                  } @else {
                    <div class="p-5 text-center border border-dashed border-slate-200 rounded-2xl text-xs text-slate-500 bg-slate-50/50">
                      Bản ghi đã được xóa khỏi hệ thống.
                    </div>
                  }
                </div>
              } @else {
                <!-- 1C. UPDATE: BẢNG SO SÁNH GIÁ TRỊ TRƯỚC VÀ SAU CHỈNH SỬA (3 CỘT CŨ VS MỚI) -->
                <div class="space-y-3">
                  <div class="flex items-center justify-between">
                    <h3 class="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                      <i class="pi pi-sliders-h text-indigo-600 text-sm"></i>
                      <span>So sánh chi tiết giá trị trước và sau chỉnh sửa</span>
                    </h3>
                    <span class="text-[11px] font-semibold text-sky-700 bg-sky-50 px-2.5 py-0.5 rounded-full border border-sky-200">
                      Chỉnh sửa dữ liệu
                    </span>
                  </div>

                  @if (getBusinessChanges(item.changes).length > 0) {
                    <div class="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                      <table class="w-full text-left text-xs">
                        <thead class="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                          <tr>
                            <th scope="col" class="py-2.5 px-4 w-1/3">Thuộc tính thay đổi</th>
                            <th scope="col" class="py-2.5 px-4 w-1/3 bg-rose-50/40 text-rose-800">Giá trị trước (Cũ)</th>
                            <th scope="col" class="py-2.5 px-4 w-1/3 bg-emerald-50/40 text-emerald-800">Giá trị sau (Mới)</th>
                          </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100 text-xs">
                          @for (change of getBusinessChanges(item.changes); track change.fieldName) {
                            <tr class="hover:bg-slate-50/50 transition-colors">
                              <!-- Tên thuộc tính -->
                              <td class="py-3 px-4">
                                <div class="font-bold text-slate-800">{{ getFieldDisplayLabel(change.fieldName) }}</div>
                                <div class="text-[10px] font-mono text-slate-400">{{ change.fieldName }}</div>
                              </td>

                              <!-- Giá trị cũ -->
                              <td class="py-3 px-4 bg-rose-50/20 text-rose-900 break-words select-all">
                                <span class="inline-block px-2 py-0.5 rounded bg-rose-100/70 border border-rose-200/80">
                                  {{ formatFieldValue(change.fieldName, change.oldValue) }}
                                </span>
                              </td>

                              <!-- Giá trị mới -->
                              <td class="py-3 px-4 bg-emerald-50/20 text-emerald-900 break-words select-all">
                                <span class="inline-block px-2 py-0.5 rounded bg-emerald-100/70 border border-emerald-200/80 font-bold">
                                  {{ formatFieldValue(change.fieldName, change.newValue) }}
                                </span>
                              </td>
                            </tr>
                          }
                        </tbody>
                      </table>
                    </div>
                  } @else {
                    <div class="p-5 text-center border border-dashed border-slate-200 rounded-2xl text-xs text-slate-500 bg-slate-50/50">
                      Không có thay đổi trường nghiệp vụ nào cần so sánh.
                    </div>
                  }
                </div>
              }

              <!-- KHU VỰC THÔNG TIN KỸ THUẬT & TRUY VẾT KIỂM TOÁN (GUID, ROOM_TYPE_ID, CREATED_BY_USER_ID, v.v.) -->
              @if (getTechnicalChanges(item.changes).length > 0) {
                <div class="pt-2 border-t border-slate-100">
                  <details class="group bg-slate-50/60 rounded-xl border border-slate-200/80 p-3 text-xs">
                    <summary class="font-bold text-slate-700 cursor-pointer flex items-center justify-between select-none">
                      <span class="flex items-center gap-2">
                        <i class="pi pi-code text-slate-500"></i>
                        <span>Mã định danh kỹ thuật & Khai thác kiểm toán ({{ getTechnicalChanges(item.changes).length }} trường)</span>
                      </span>
                      <i class="pi pi-chevron-down text-slate-400 group-open:rotate-180 transition-transform"></i>
                    </summary>
                    <div class="mt-3 space-y-2">
                      @for (tech of getTechnicalChanges(item.changes); track tech.fieldName) {
                        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-1 p-2 bg-white rounded-lg border border-slate-200/70 font-mono text-[11px]">
                          <div>
                            <span class="font-bold text-slate-700 font-sans mr-2">{{ getFieldDisplayLabel(tech.fieldName) }}:</span>
                            <span class="text-slate-400 text-[10px]">({{ tech.fieldName }})</span>
                          </div>
                          <div class="flex items-center gap-2">
                            <span class="text-indigo-900 font-semibold break-all select-all">{{ tech.newValue || tech.oldValue || '—' }}</span>
                            @if (tech.newValue || tech.oldValue) {
                              <button
                                type="button"
                                (click)="copyToClipboard(tech.newValue || tech.oldValue || '', getFieldDisplayLabel(tech.fieldName))"
                                class="p-1 text-slate-400 hover:text-indigo-600 rounded cursor-pointer"
                                [title]="'Sao chép ' + getFieldDisplayLabel(tech.fieldName)"
                              >
                                <i class="pi pi-copy text-xs"></i>
                              </button>
                            }
                          </div>
                        </div>
                      }
                    </div>
                  </details>
                </div>
              }
            }
          </div>

          <!-- Modal Footer (Sticky Bottom) -->
          <div class="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/90 shrink-0 flex items-center justify-between gap-3">
            <span class="text-[11px] text-slate-500 font-medium hidden sm:inline">
              {{ selectedDetail()?.action === 'Create' ? 'Bản ghi kiểm toán bất biến phục vụ quản trị.' : (selectedDetail()?.action === 'Delete' ? 'Dữ liệu được lưu trữ vĩnh viễn theo quy định kiểm toán.' : 'Dữ liệu được ghi nhận tự động qua hệ thống Audit.') }}
            </span>
            <button
              type="button"
              (click)="closeDetailModal()"
              class="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer ml-auto"
              title="Đóng cửa sổ chi tiết (Esc)"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    }
  `
})
export class AuditLogsPage implements OnInit {
  private readonly auditLogService = inject(AuditLogService);
  private readonly authService = inject(AuthService);
  private readonly alertService = inject(AlertService);
  private readonly router = inject(Router);

  readonly loading = signal(false);
  readonly errorMessage = signal('');
  readonly auditLogs = signal<AuditLogListItem[]>([]);
  readonly totalRecords = signal(0);
  readonly currentPage = signal(1);
  readonly pageSize = signal(20);

  readonly isDetailModalOpen = signal(false);
  readonly isDetailLoading = signal(false);
  readonly selectedDetail = signal<AuditLogDetail | null>(null);

  selectedAction = '';
  selectedEntityName = '';
  fromDate = '';
  toDate = '';
  searchKeyword = '';

  /**
   * Kiểm tra quyền: Chỉ cho phép Owner và Manager truy cập.
   */
  readonly isAuthorized = computed(() => {
    const user = this.authService.currentUser;
    if (!user) return false;
    const globalRole = user.globalRole;
    if (globalRole === 'Owner' || globalRole === 'PlatformAdmin') return true;

    const activeRole = this.authService.activeRoleName();
    if (activeRole === 'Owner' || activeRole === 'Manager') return true;

    const memberships = this.authService.memberships;
    return memberships.some(m => m.staffRole === 'Owner' || m.staffRole === 'Manager');
  });

  private hasInitialLoaded = false;

  constructor() {
    try {
      effect(() => {
        const propId = this.authService.activePropertyId();
        untracked(() => {
          if (this.isAuthorized()) {
            this.hasInitialLoaded = true;
            this.currentPage.set(1);
            this.loadAuditLogs();
          }
        });
      });
    } catch {
      // Bỏ qua trong môi trường kiểm thử không kích hoạt effect
    }
  }

  ngOnInit(): void {
    if (!this.hasInitialLoaded && this.isAuthorized()) {
      this.loadAuditLogs();
    }
  }

  @HostListener('document:keydown.escape')
  onEscapePress(): void {
    if (this.isDetailModalOpen()) {
      this.closeDetailModal();
    }
  }

  loadAuditLogs(): void {
    this.loading.set(true);
    this.errorMessage.set('');

    const params: AuditLogFilterParams = {
      action: this.selectedAction.trim() || undefined,
      entityName: this.selectedEntityName.trim() || undefined,
      propertyId: this.authService.activePropertyId() || undefined,
      page: this.currentPage(),
      pageSize: this.pageSize()
    };

    if (this.fromDate) {
      params.fromUtc = new Date(this.fromDate + 'T00:00:00Z').toISOString();
    }
    if (this.toDate) {
      params.toUtc = new Date(this.toDate + 'T23:59:59Z').toISOString();
    }
    if (this.searchKeyword.trim()) {
      const kw = this.searchKeyword.trim();
      // Nếu là GUID thì gán EntityId
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(kw)) {
        params.entityId = kw;
      }
    }

    this.auditLogService.getAuditLogs(params).subscribe({
      next: res => {
        this.loading.set(false);
        if (res.success && res.data) {
          this.auditLogs.set(res.data.items);
          this.totalRecords.set(res.data.totalCount);
        } else {
          this.errorMessage.set(res.message || 'Không thể tải nhật ký kiểm toán.');
        }
      },
      error: err => {
        this.loading.set(false);
        const msg = err?.error?.message || 'Lỗi kết nối khi tải nhật ký kiểm toán.';
        this.errorMessage.set(msg);
      }
    });
  }

  onFilterChange(): void {
    this.currentPage.set(1);
    this.loadAuditLogs();
  }

  resetFilters(): void {
    this.selectedAction = '';
    this.selectedEntityName = '';
    this.fromDate = '';
    this.toDate = '';
    this.searchKeyword = '';
    this.currentPage.set(1);
    this.loadAuditLogs();
  }

  onPageChange(page: number): void {
    this.currentPage.set(page);
    this.loadAuditLogs();
  }

  onPageSizeChange(size: number): void {
    this.pageSize.set(size);
    this.currentPage.set(1);
    this.loadAuditLogs();
  }

  openDetail(id: string): void {
    this.isDetailModalOpen.set(true);
    this.isDetailLoading.set(true);
    this.selectedDetail.set(null);

    const propId = this.authService.activePropertyId();
    this.auditLogService.getAuditLogById(id, propId).subscribe({
      next: res => {
        this.isDetailLoading.set(false);
        if (res.success && res.data) {
          this.selectedDetail.set(res.data);
        } else {
          this.alertService.error(res.message || 'Không tìm thấy chi tiết nhật ký kiểm toán.');
          this.closeDetailModal();
        }
      },
      error: err => {
        this.isDetailLoading.set(false);
        this.alertService.error(err?.error?.message || 'Lỗi khi tải chi tiết kiểm toán.');
        this.closeDetailModal();
      }
    });
  }

  closeDetailModal(): void {
    this.isDetailModalOpen.set(false);
    this.selectedDetail.set(null);
  }

  copyToClipboard(text: string, label: string): void {
    if (!text) return;
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        this.alertService.success(`Đã sao chép ${label}.`);
      }).catch(() => {
        this.alertService.toastWarning(`Không thể tự động sao chép. Vui lòng chọn và sao chép thủ công.`);
      });
    } else {
      this.alertService.toastWarning(`Trình duyệt không hỗ trợ tự động sao chép.`);
    }
  }

  /**
   * Phân tách thuộc tính nghiệp vụ chính (hiển thị bảng)
   */
  getBusinessChanges(changes?: AuditFieldChange[]): AuditFieldChange[] {
    if (!changes) return [];
    return changes.filter(c => !this.isTechnicalField(c.fieldName));
  }

  /**
   * Phân tách thuộc tính kỹ thuật / ID (đưa vào khu vực tra cứu kỹ thuật)
   */
  getTechnicalChanges(changes?: AuditFieldChange[]): AuditFieldChange[] {
    if (!changes) return [];
    return changes.filter(c => this.isTechnicalField(c.fieldName));
  }

  /**
   * Kiểm tra xem trường có phải là mã định danh kỹ thuật (ID, GUID)
   */
  isTechnicalField(fieldName: string): boolean {
    return /^(Id|TenantId|PropertyId|RoomTypeId|CreatedByUserId|UserId|ReservationId|InvoiceId)$/i.test(fieldName) ||
      /(Id|Guid)$/i.test(fieldName);
  }

  /**
   * Đổi nhãn nút thao tác tại danh sách (Yêu cầu 2: Update -> So sánh, Create/Delete -> Xem chi tiết)
   */
  getActionButtonLabel(action?: string): string {
    return action === 'Update' ? 'So sánh' : 'Xem chi tiết';
  }

  getActionButtonIcon(action?: string): string {
    return action === 'Update' ? 'pi-sliders-h' : 'pi-eye';
  }

  getActionLabel(action?: string): string {
    switch (action) {
      case 'Create': return 'Tạo mới';
      case 'Update': return 'Chỉnh sửa';
      case 'Delete': return 'Xóa';
      default: return action || 'Không xác định';
    }
  }

  getActionBadgeClass(action?: string): string {
    switch (action) {
      case 'Create': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Update': return 'bg-sky-50 text-sky-700 border-sky-200';
      case 'Delete': return 'bg-rose-50 text-rose-700 border-rose-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  }

  getActionIcon(action?: string): string {
    switch (action) {
      case 'Create': return 'pi-plus-circle text-emerald-600';
      case 'Update': return 'pi-pencil text-sky-600';
      case 'Delete': return 'pi-trash text-rose-600';
      default: return 'pi-info-circle text-slate-500';
    }
  }

  getEntityDisplayLabel(name?: string): string {
    switch (name) {
      case 'RoomTypeRate': return 'Bảng giá phòng';
      case 'PropertySurchargePolicy': return 'Phụ thu chi nhánh';
      case 'Invoice': return 'Hóa đơn thanh toán';
      default: return name || 'Bản ghi';
    }
  }

  /**
   * Chuyển các tên trường kỹ thuật thành tên tiếng Việt dễ hiểu cho Owner/Manager (Yêu cầu 4)
   */
  getFieldDisplayLabel(fieldName: string): string {
    const labels: Record<string, string> = {
      // RoomTypeRate
      NightlyPrice: 'Giá thuê theo đêm',
      FirstHours: 'Số giờ ban đầu',
      FirstHoursPrice: 'Giá số giờ ban đầu',
      AdditionalHourPrice: 'Giá mỗi giờ tiếp theo',
      Currency: 'Đơn vị tiền tệ',
      EffectiveFrom: 'Ngày bắt đầu hiệu lực',
      EffectiveTo: 'Ngày kết thúc hiệu lực (Exclusive)',
      IsActive: 'Trạng thái hoạt động',
      ChangeReason: 'Lý do thay đổi',
      RoomTypeId: 'Mã loại phòng (RoomTypeId)',
      CreatedByUserId: 'Mã người tạo (CreatedByUserId)',
      // PropertySurchargePolicy
      SurchargeType: 'Loại phụ thu',
      CalculationMethod: 'Phương thức tính',
      Percentage: 'Tỷ lệ phụ thu (%)',
      FlatAmount: 'Mức tiền cố định',
      FromTime: 'Từ khung giờ',
      ToTime: 'Đến khung giờ',
      // Invoice
      InvoiceNumber: 'Số hóa đơn',
      ReservationId: 'Mã đặt phòng (ReservationId)',
      TotalAmount: 'Tổng tiền thanh toán',
      SubTotal: 'Tổng tiền dịch vụ',
      TaxAmount: 'Tiền thuế VAT',
      DiscountAmount: 'Tiền giảm giá',
      Status: 'Trạng thái hóa đơn',
      IssuedAtUtc: 'Thời điểm phát hành',
      DueAtUtc: 'Hạn thanh toán',
      PaidAtUtc: 'Thời điểm thanh toán',
      Notes: 'Ghi chú hóa đơn',
      PaymentMethod: 'Phương thức thanh toán',
      // Common
      Id: 'Mã bản ghi (ID)',
      TenantId: 'Mã định danh Tenant',
      PropertyId: 'Mã định danh Chi nhánh'
    };
    return labels[fieldName] || fieldName;
  }

  /**
   * Định dạng tóm tắt mô tả tiếng Việt thân thiện, che chuỗi GUID dài (Yêu cầu 3)
   */
  getFriendlySummary(summary: string | null | undefined, action?: string, entityName?: string): string {
    if (!summary) return 'Không có mô tả chi tiết';

    let s = summary;

    // Thay thế tên Entity
    s = s.replace(/\bRoomTypeRate\b/g, 'Bảng giá phòng');
    s = s.replace(/\bPropertySurchargePolicy\b/g, 'Phụ thu chi nhánh');
    s = s.replace(/\bInvoice\b/g, 'Hóa đơn');

    // Loại bỏ các GUID dài trong chuỗi mô tả chính
    s = s.replace(/,?\s*(RoomTypeId|CreatedByUserId|TenantId|PropertyId|Id)=[0-9a-f-]{36}/gi, '');
    s = s.replace(/\(\s*,\s*/g, '(');
    s = s.replace(/,\s*\)/g, ')');
    s = s.replace(/\(\s*\)/g, '');

    // Định dạng giá tiền
    s = s.replace(/\bNightlyPrice:\s*(\d+)\s*->\s*(\d+)/g, (_, o, n) => {
      return `Giá theo đêm: ${Number(o).toLocaleString('vi-VN')} ₫ → ${Number(n).toLocaleString('vi-VN')} ₫`;
    });
    s = s.replace(/\bFirstHoursPrice:\s*(\d+)\s*->\s*(\d+)/g, (_, o, n) => {
      return `Giá giờ đầu: ${Number(o).toLocaleString('vi-VN')} ₫ → ${Number(n).toLocaleString('vi-VN')} ₫`;
    });
    s = s.replace(/\bAdditionalHourPrice:\s*(\d+)\s*->\s*(\d+)/g, (_, o, n) => {
      return `Giá giờ tiếp theo: ${Number(o).toLocaleString('vi-VN')} ₫ → ${Number(n).toLocaleString('vi-VN')} ₫`;
    });

    // Định dạng ngày hiệu lực (Exclusive rule)
    s = s.replace(/\bEffectiveTo:\s*(\d{4}-\d{2}-\d{2})\s*->\s*(\d{4}-\d{2}-\d{2})/g, (_, o, n) => {
      return `Hạn hiệu lực: ${this.formatShortDate(o)} → ${this.formatShortDate(n)} (Hết ngày trước)`;
    });
    s = s.replace(/\bEffectiveFrom:\s*(\d{4}-\d{2}-\d{2})\s*->\s*(\d{4}-\d{2}-\d{2})/g, (_, o, n) => {
      return `Từ ngày: ${this.formatShortDate(o)} → ${this.formatShortDate(n)}`;
    });
    s = s.replace(/\bEffectiveTo:\s*(\d{4}-\d{2}-\d{2})/g, (_, d) => {
      return `Hạn hiệu lực: ${this.formatShortDate(d)}`;
    });
    s = s.replace(/\bEffectiveFrom:\s*(\d{4}-\d{2}-\d{2})/g, (_, d) => {
      return `Từ ngày: ${this.formatShortDate(d)}`;
    });

    // Định dạng trạng thái & tiền tệ
    s = s.replace(/\bIsActive:\s*(true|True)\b/g, 'Trạng thái: Hoạt động');
    s = s.replace(/\bIsActive:\s*(false|False)\b/g, 'Trạng thái: Tạm dừng');
    s = s.replace(/\bIsActive=(true|True)\b/g, 'Trạng thái=Hoạt động');
    s = s.replace(/\bIsActive=(false|False)\b/g, 'Trạng thái=Tạm dừng');
    s = s.replace(/\bCurrency=VND\b/g, 'Tiền tệ=VND');
    s = s.replace(/\bFirstHours=(\d+)\b/g, 'Số giờ đầu=$1h');
    s = s.replace(/\bChangeReason:\s*/g, 'Lý do: ');

    // Chuẩn hóa dấu mũi tên
    s = s.replace(/->/g, '→');

    return s.trim();
  }

  /**
   * Định dạng ngày kết thúc hiệu lực tuân thủ quy tắc Exclusive trong Domain (Yêu cầu 5)
   */
  formatEffectiveTo(value: string | null): string {
    if (!value) return '—';
    const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) {
      const y = parseInt(m[1], 10);
      const month = parseInt(m[2], 10);
      const day = parseInt(m[3], 10);

      // Tính ngày trước đó (ngày bao gồm cuối cùng có hiệu lực)
      const d = new Date(y, month - 1, day);
      d.setDate(d.getDate() - 1);
      const prevDayStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
      const displayDate = `${m[3]}/${m[2]}/${m[1]}`;
      return `${displayDate} (Hiệu lực đến hết ngày ${prevDayStr} — mốc kết thúc exclusive)`;
    }
    return value;
  }

  /**
   * Định dạng ngày bắt đầu hiệu lực (Inclusive)
   */
  formatEffectiveFrom(value: string | null): string {
    if (!value) return '—';
    const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) {
      return `${m[3]}/${m[2]}/${m[1]} (Bắt đầu áp dụng từ 00:00)`;
    }
    return value;
  }

  formatShortDate(isoDateStr: string): string {
    const parts = isoDateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return isoDateStr;
  }

  formatFieldValue(fieldName: string, value: string | null): string {
    if (value === null || value === undefined || value === '') return '—';

    // Xử lý Effective dates theo quy tắc Domain
    if (fieldName === 'EffectiveTo') {
      return this.formatEffectiveTo(value);
    }
    if (fieldName === 'EffectiveFrom') {
      return this.formatEffectiveFrom(value);
    }

    // Giá tiền VND
    if (/Price|Amount|Fee/i.test(fieldName)) {
      const num = Number(value);
      if (!isNaN(num)) {
        return `${num.toLocaleString('vi-VN')} ₫`;
      }
    }

    // Boolean
    if (value === 'True' || value === 'true') return 'Hoạt động (Có)';
    if (value === 'False' || value === 'false') return 'Vô hiệu (Không)';

    // Giờ
    if (fieldName === 'FirstHours') {
      return `${value} giờ`;
    }

    // Tỷ lệ %
    if (fieldName === 'Percentage') {
      return `${value}%`;
    }

    // Date
    if (/Date|Utc$/i.test(fieldName) && !isNaN(Date.parse(value))) {
      return this.formatVietnamDate(value);
    }

    return value;
  }

  formatVietnamDate(utcDateStr?: string | null): string {
    if (!utcDateStr) return '—';
    const d = new Date(utcDateStr);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  }

  formatVietnamTime(utcDateStr?: string | null): string {
    if (!utcDateStr) return '—';
    const d = new Date(utcDateStr);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleTimeString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  }

  formatVietnamFullDateTime(utcDateStr?: string | null): string {
    if (!utcDateStr) return '—';
    const d = new Date(utcDateStr);
    if (isNaN(d.getTime())) return '—';
    return `${this.formatVietnamDate(utcDateStr)} lúc ${this.formatVietnamTime(utcDateStr)}`;
  }
}
