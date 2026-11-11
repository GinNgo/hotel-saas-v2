import {
  Component,
  input,
  output,
  signal,
  computed,
  ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  PermissionMatrixRow,
  getVietnameseFunctionName,
  getVietnameseModuleName,
  getVietnameseFunctionDescription,
  calculateRowMaskScore,
  getScoreLevelMeta,
  applyScoreMaskToRow,
  toggleCrudCellWithCascade
} from './roles-management.utils';

export type CrudColumnKey = 'canRead' | 'canCreate' | 'canUpdate' | 'canDelete';

@Component({
  selector: 'app-permissions-matrix',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-3.5" data-testid="permissions-matrix-root">
      <!-- 1. Thông tin cơ chế cấp quyền phân cấp & Thống kê số tính năng -->
      <div class="p-3.5 rounded-xl bg-gradient-to-r from-indigo-50/90 via-slate-50 to-emerald-50/80 border border-indigo-200/80 shadow-2xs">
        <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div class="space-y-1">
            <div class="flex items-center flex-wrap gap-2">
              <span class="inline-flex items-center gap-1.5 text-xs font-extrabold text-indigo-950">
                <i class="pi pi-shield text-indigo-600 text-xs"></i>
                <span>Ma trận Phân quyền Chức năng (CRUD):</span>
              </span>
              <span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-600 text-white">
                Tự động kế thừa quyền Xem
              </span>
            </div>
            <p class="text-[11px] text-slate-600 leading-relaxed">
              Khi bật quyền <strong class="text-sky-700">Thêm</strong>, <strong class="text-amber-700">Sửa</strong> hoặc <strong class="text-rose-700">Xóa</strong>, hệ thống tự động cấp quyền <strong class="text-emerald-700">Xem</strong> cho tính năng đó. Khi tắt quyền <strong class="text-emerald-700">Xem</strong>, toàn bộ quyền thao tác của dòng sẽ được thu hồi.
            </p>
          </div>

          <!-- Thống kê số tính năng & thao tác đang cấp -->
          <div class="flex items-center gap-3 bg-white/90 px-3.5 py-2 rounded-xl border border-indigo-200/80 shrink-0 self-start lg:self-center">
            <div>
              <div class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Phân hệ được cấp</div>
              <div class="text-sm font-extrabold text-emerald-700 mt-0.5">
                {{ activeModulesCount() }} / {{ rows().length }} tính năng
              </div>
            </div>
            <div class="h-7 w-px bg-slate-200"></div>
            <div>
              <div class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Quyền đang bật</div>
              <div class="text-sm font-extrabold text-indigo-700 mt-0.5">
                {{ totalCheckedActions() }} quyền CRUD
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 2. Thanh tìm kiếm tính năng & Chọn nhanh theo cấp độ quyền -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
        <!-- Search feature input -->
        <div class="relative flex-1 max-w-xs">
          <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
          <input
            type="text"
            [ngModel]="featureSearch()"
            (ngModelChange)="featureSearch.set($event)"
            placeholder="Tìm nhanh tính năng (VD: Đặt phòng, Hóa đơn)..."
            aria-label="Tìm nhanh tính năng trong ma trận"
            class="w-full h-9 pl-8 pr-7 rounded-lg border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
          @if (featureSearch()) {
            <button
              type="button"
              (click)="featureSearch.set('')"
              class="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              aria-label="Xóa tìm kiếm tính năng"
            >
              <i class="pi pi-times text-[10px]"></i>
            </button>
          }
        </div>

        <!-- Quick Permission Level Presets (Không hiển thị điểm số) -->
        @if (!readonly()) {
          <div class="flex items-center flex-wrap gap-1.5">
            <span class="text-[11px] font-semibold text-slate-500 mr-1">Chọn nhanh cấp độ:</span>
            <button
              type="button"
              (click)="applyGlobalScorePreset(15)"
              class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs transition-all cursor-pointer"
            >
              <i class="pi pi-check-circle text-[10px]"></i>
              <span>Chọn tất cả</span>
            </button>
            <button
              type="button"
              (click)="applyGlobalScorePreset(7)"
              class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-all cursor-pointer"
              title="Cấp quyền Xem, Thêm và Sửa (Không bao gồm Xóa)"
            >
              <span>Nghiệp vụ (Xem, Thêm, Sửa)</span>
            </button>
            <button
              type="button"
              (click)="applyGlobalScorePreset(3)"
              class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 transition-all cursor-pointer"
              title="Cấp quyền Xem và Thêm mới"
            >
              <span>Tác nghiệp (Xem, Thêm)</span>
            </button>
            <button
              type="button"
              (click)="applyGlobalScorePreset(1)"
              class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition-all cursor-pointer"
              title="Chỉ cấp quyền Xem dữ liệu"
            >
              <span>Chỉ xem</span>
            </button>
            <button
              type="button"
              (click)="applyGlobalScorePreset(0)"
              class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 transition-all cursor-pointer"
            >
              <span>Bỏ chọn hết</span>
            </button>
          </div>
        }
      </div>

      <!-- 3. Bảng Ma trận Cấp quyền CRUD (Permissions Matrix Grid) -->
      <div class="border border-slate-200/90 rounded-2xl overflow-hidden bg-white shadow-2xs">
        <div class="overflow-x-auto max-h-[460px] overflow-y-auto">
          <table class="w-full text-left text-xs text-slate-600 border-collapse" data-testid="permissions-matrix-table">
            <thead class="bg-slate-50/95 sticky top-0 z-10 text-[11px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200 backdrop-blur-xs">
              <tr>
                <th scope="col" class="px-4 py-3 min-w-[240px]">Tính năng & Phân hệ nghiệp vụ</th>

                <!-- Column Header: Xem (Read) with Master Column Tick -->
                <th scope="col" class="px-2.5 py-3 text-center min-w-[96px] whitespace-nowrap">
                  <button
                    type="button"
                    [disabled]="readonly()"
                    (click)="toggleColumn('canRead')"
                    class="group inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-default"
                    aria-label="Chọn tất cả cột Xem (Read)"
                    title="Nhấn để bật/tắt toàn bộ cột Xem"
                  >
                    <span
                      class="w-4 h-4 rounded-md border flex items-center justify-center transition-all duration-150 shrink-0"
                      [ngClass]="getColumnMasterCheckClass('canRead', 'emerald')"
                    >
                      @if (getColumnState('canRead') === 'all') {
                        <i class="pi pi-check text-[9px] font-extrabold"></i>
                      } @else if (getColumnState('canRead') === 'partial') {
                        <i class="pi pi-minus text-[9px] font-extrabold"></i>
                      }
                    </span>
                    <span class="text-slate-700 group-hover:text-emerald-700">Xem (Read)</span>
                  </button>
                </th>

                <!-- Column Header: Thêm (Create) with Master Column Tick -->
                <th scope="col" class="px-2.5 py-3 text-center min-w-[96px] whitespace-nowrap">
                  <button
                    type="button"
                    [disabled]="readonly()"
                    (click)="toggleColumn('canCreate')"
                    class="group inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-default"
                    aria-label="Chọn tất cả cột Thêm (Create)"
                    title="Nhấn để bật/tắt toàn bộ cột Thêm"
                  >
                    <span
                      class="w-4 h-4 rounded-md border flex items-center justify-center transition-all duration-150 shrink-0"
                      [ngClass]="getColumnMasterCheckClass('canCreate', 'sky')"
                    >
                      @if (getColumnState('canCreate') === 'all') {
                        <i class="pi pi-check text-[9px] font-extrabold"></i>
                      } @else if (getColumnState('canCreate') === 'partial') {
                        <i class="pi pi-minus text-[9px] font-extrabold"></i>
                      }
                    </span>
                    <span class="text-slate-700 group-hover:text-sky-700">Thêm (Create)</span>
                  </button>
                </th>

                <!-- Column Header: Sửa (Update) with Master Column Tick -->
                <th scope="col" class="px-2.5 py-3 text-center min-w-[96px] whitespace-nowrap">
                  <button
                    type="button"
                    [disabled]="readonly()"
                    (click)="toggleColumn('canUpdate')"
                    class="group inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-default"
                    aria-label="Chọn tất cả cột Sửa (Update)"
                    title="Nhấn để bật/tắt toàn bộ cột Sửa"
                  >
                    <span
                      class="w-4 h-4 rounded-md border flex items-center justify-center transition-all duration-150 shrink-0"
                      [ngClass]="getColumnMasterCheckClass('canUpdate', 'amber')"
                    >
                      @if (getColumnState('canUpdate') === 'all') {
                        <i class="pi pi-check text-[9px] font-extrabold"></i>
                      } @else if (getColumnState('canUpdate') === 'partial') {
                        <i class="pi pi-minus text-[9px] font-extrabold"></i>
                      }
                    </span>
                    <span class="text-slate-700 group-hover:text-amber-700">Sửa (Update)</span>
                  </button>
                </th>

                <!-- Column Header: Xóa (Delete) with Master Column Tick -->
                <th scope="col" class="px-2.5 py-3 text-center min-w-[96px] whitespace-nowrap">
                  <button
                    type="button"
                    [disabled]="readonly()"
                    (click)="toggleColumn('canDelete')"
                    class="group inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-default"
                    aria-label="Chọn tất cả cột Xóa (Delete)"
                    title="Nhấn để bật/tắt toàn bộ cột Xóa"
                  >
                    <span
                      class="w-4 h-4 rounded-md border flex items-center justify-center transition-all duration-150 shrink-0"
                      [ngClass]="getColumnMasterCheckClass('canDelete', 'rose')"
                    >
                      @if (getColumnState('canDelete') === 'all') {
                        <i class="pi pi-check text-[9px] font-extrabold"></i>
                      } @else if (getColumnState('canDelete') === 'partial') {
                        <i class="pi pi-minus text-[9px] font-extrabold"></i>
                      }
                    </span>
                    <span class="text-slate-700 group-hover:text-rose-700">Xóa (Delete)</span>
                  </button>
                </th>

                <!-- Column Header: Mức quyền hiện tại -->
                <th scope="col" class="px-3 py-3 text-center min-w-[115px] whitespace-nowrap">
                  <span>Mức quyền</span>
                </th>

                <!-- Column Header: Ô Tick Chung Cả Dòng (Master Row Toggle) -->
                <th scope="col" class="px-3.5 py-3 text-center min-w-[125px] whitespace-nowrap">
                  <button
                    type="button"
                    [disabled]="readonly()"
                    (click)="toggleAllMaster()"
                    class="group inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-default whitespace-nowrap"
                    aria-label="Ô tick chung toàn bảng"
                    title="Bật/Tắt toàn quyền cho tất cả tính năng"
                  >
                    <span
                      class="w-4 h-4 rounded-md border flex items-center justify-center transition-all duration-150 shrink-0"
                      [ngClass]="getGlobalMasterCheckClass()"
                    >
                      @if (globalMasterState() === 'all') {
                        <i class="pi pi-check text-[9px] font-extrabold"></i>
                      } @else if (globalMasterState() === 'partial') {
                        <i class="pi pi-minus text-[9px] font-extrabold"></i>
                      }
                    </span>
                    <span class="text-indigo-900 group-hover:text-indigo-600">Ô tick chung</span>
                  </button>
                </th>
              </tr>
            </thead>

            <tbody class="divide-y divide-slate-100">
              @for (row of filteredRows(); track row.functionId) {
                <tr
                  class="transition-colors"
                  [ngClass]="getRowScore(row) === 15 ? 'bg-indigo-50/20 hover:bg-indigo-50/40' : 'hover:bg-slate-50/80'"
                >
                  <!-- 1. Tên tính năng Tiếng Việt & Mô tả -->
                  <td class="px-4 py-3">
                    <div class="flex items-start justify-between gap-2">
                      <div>
                        <div class="font-bold text-slate-900 text-xs flex items-center flex-wrap gap-1.5">
                          <span>{{ getDisplayName(row) }}</span>
                          <span class="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-100 text-slate-600 border border-slate-200/80">
                            {{ getModuleLabel(row) }}
                          </span>
                        </div>
                        <p class="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                          {{ getDescription(row) }}
                        </p>
                      </div>
                    </div>
                  </td>

                  <!-- 2. Ô tick Xem (Read) -->
                  <td class="px-2.5 py-3 text-center whitespace-nowrap">
                    <button
                      type="button"
                      [disabled]="readonly()"
                      (click)="toggleCell(row, 'canRead')"
                      [attr.aria-label]="getDisplayName(row) + ' - Quyền Xem'"
                      [attr.aria-pressed]="row.canRead"
                      class="group inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xl border transition-all duration-150 cursor-pointer disabled:cursor-default select-none"
                      [ngClass]="row.canRead
                        ? 'bg-emerald-50/90 border-emerald-300 text-emerald-900 shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-400 hover:border-emerald-300 hover:bg-emerald-50/30'"
                    >
                      <span
                        class="w-4 h-4 rounded-md border flex items-center justify-center transition-all duration-150 shrink-0"
                        [ngClass]="row.canRead
                          ? 'bg-emerald-600 border-emerald-600 text-white shadow-2xs'
                          : 'bg-slate-50 border-slate-300 group-hover:border-emerald-400 text-transparent'"
                      >
                        <i class="pi pi-check text-[9px] font-extrabold"></i>
                      </span>
                      <span class="text-[11px] font-bold">Xem</span>
                    </button>
                  </td>

                  <!-- 3. Ô tick Thêm (Create) -->
                  <td class="px-2.5 py-3 text-center whitespace-nowrap">
                    <button
                      type="button"
                      [disabled]="readonly()"
                      (click)="toggleCell(row, 'canCreate')"
                      [attr.aria-label]="getDisplayName(row) + ' - Quyền Thêm'"
                      [attr.aria-pressed]="row.canCreate"
                      class="group inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xl border transition-all duration-150 cursor-pointer disabled:cursor-default select-none"
                      [ngClass]="row.canCreate
                        ? 'bg-sky-50/90 border-sky-300 text-sky-900 shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-400 hover:border-sky-300 hover:bg-sky-50/30'"
                    >
                      <span
                        class="w-4 h-4 rounded-md border flex items-center justify-center transition-all duration-150 shrink-0"
                        [ngClass]="row.canCreate
                          ? 'bg-sky-600 border-sky-600 text-white shadow-2xs'
                          : 'bg-slate-50 border-slate-300 group-hover:border-sky-400 text-transparent'"
                      >
                        <i class="pi pi-check text-[9px] font-extrabold"></i>
                      </span>
                      <span class="text-[11px] font-bold">Thêm</span>
                    </button>
                  </td>

                  <!-- 4. Ô tick Sửa (Update) -->
                  <td class="px-2.5 py-3 text-center whitespace-nowrap">
                    <button
                      type="button"
                      [disabled]="readonly()"
                      (click)="toggleCell(row, 'canUpdate')"
                      [attr.aria-label]="getDisplayName(row) + ' - Quyền Sửa'"
                      [attr.aria-pressed]="row.canUpdate"
                      class="group inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xl border transition-all duration-150 cursor-pointer disabled:cursor-default select-none"
                      [ngClass]="row.canUpdate
                        ? 'bg-amber-50/90 border-amber-300 text-amber-900 shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-400 hover:border-amber-300 hover:bg-amber-50/30'"
                    >
                      <span
                        class="w-4 h-4 rounded-md border flex items-center justify-center transition-all duration-150 shrink-0"
                        [ngClass]="row.canUpdate
                          ? 'bg-amber-500 border-amber-500 text-white shadow-2xs'
                          : 'bg-slate-50 border-slate-300 group-hover:border-amber-400 text-transparent'"
                      >
                        <i class="pi pi-check text-[9px] font-extrabold"></i>
                      </span>
                      <span class="text-[11px] font-bold">Sửa</span>
                    </button>
                  </td>

                  <!-- 5. Ô tick Xóa (Delete) -->
                  <td class="px-2.5 py-3 text-center whitespace-nowrap">
                    <button
                      type="button"
                      [disabled]="readonly()"
                      (click)="toggleCell(row, 'canDelete')"
                      [attr.aria-label]="getDisplayName(row) + ' - Quyền Xóa'"
                      [attr.aria-pressed]="row.canDelete"
                      class="group inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xl border transition-all duration-150 cursor-pointer disabled:cursor-default select-none"
                      [ngClass]="row.canDelete
                        ? 'bg-rose-50/90 border-rose-300 text-rose-900 shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-400 hover:border-rose-300 hover:bg-rose-50/30'"
                    >
                      <span
                        class="w-4 h-4 rounded-md border flex items-center justify-center transition-all duration-150 shrink-0"
                        [ngClass]="row.canDelete
                          ? 'bg-rose-600 border-rose-600 text-white shadow-2xs'
                          : 'bg-slate-50 border-slate-300 group-hover:border-rose-400 text-transparent'"
                      >
                        <i class="pi pi-check text-[9px] font-extrabold"></i>
                      </span>
                      <span class="text-[11px] font-bold">Xóa</span>
                    </button>
                  </td>

                  <!-- 6. Mức quyền của dòng (Không hiển thị điểm số) -->
                  <td class="px-3 py-3 text-center whitespace-nowrap">
                    <div class="inline-flex flex-col items-center gap-1">
                      <span
                        class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-extrabold border whitespace-nowrap"
                        [ngClass]="getRowLevelMeta(row).badgeClass"
                      >
                        <span>{{ getRowLevelMeta(row).label }}</span>
                      </span>
                      <!-- Thanh mức độ trực quan -->
                      <div class="w-16 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          class="h-full rounded-full transition-all duration-200"
                          [style.width.%]="(getRowCountChecked(row) / 4) * 100"
                          [ngClass]="getRowScore(row) === 15 ? 'bg-emerald-500' : getRowScore(row) >= 7 ? 'bg-indigo-500' : getRowScore(row) > 0 ? 'bg-amber-500' : 'bg-transparent'"
                        ></div>
                      </div>
                    </div>
                  </td>

                  <!-- 7. Ô Tick Chung Cả Dòng (Master Row Checkbox with 3 states) -->
                  <td class="px-3.5 py-3 text-center whitespace-nowrap">
                    <button
                      type="button"
                      [disabled]="readonly()"
                      (click)="toggleRow(row)"
                      [attr.aria-label]="'Ô tick chung cả dòng ' + getDisplayName(row)"
                      class="group inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all duration-150 cursor-pointer disabled:cursor-default select-none whitespace-nowrap"
                      [ngClass]="getRowScore(row) === 15
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs shadow-indigo-500/20'
                        : getRowScore(row) > 0
                          ? 'bg-indigo-50 border-indigo-300 text-indigo-800 hover:bg-indigo-100'
                          : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-indigo-300 hover:text-indigo-700 hover:bg-indigo-50/40'"
                      title="Nhấn để chọn đủ cả dòng hoặc bỏ chọn cả dòng"
                    >
                      <span
                        class="w-4 h-4 rounded-md border flex items-center justify-center transition-all duration-150 shrink-0"
                        [ngClass]="getRowScore(row) === 15
                          ? 'bg-white/20 border-white/60 text-white'
                          : getRowScore(row) > 0
                            ? 'bg-indigo-600 border-indigo-600 text-white'
                            : 'bg-white border-slate-300 group-hover:border-indigo-400 text-transparent'"
                      >
                        @if (getRowScore(row) === 15) {
                          <i class="pi pi-check text-[9px] font-extrabold"></i>
                        } @else if (getRowScore(row) > 0) {
                          <i class="pi pi-minus text-[9px] font-extrabold"></i>
                        } @else {
                          <i class="pi pi-check text-[9px]"></i>
                        }
                      </span>
                      <span class="text-[10px] font-bold whitespace-nowrap">
                        {{ getRowScore(row) === 15 ? 'Đã chọn đủ' : getRowScore(row) > 0 ? 'Một phần' : 'Chọn dòng' }}
                      </span>
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `
})
export class PermissionsMatrixComponent {
  /** Danh sách các dòng phân quyền theo từng tính năng */
  readonly rows = input.required<PermissionMatrixRow[]>();

  /** Chế độ chỉ xem */
  readonly readonly = input<boolean>(false);

  /** Sự kiện phát ra mỗi khi danh sách dòng phân quyền thay đổi */
  readonly rowsChange = output<PermissionMatrixRow[]>();

  readonly featureSearch = signal<string>('');

  readonly filteredRows = computed(() => {
    const q = (this.featureSearch() || '').trim().toLowerCase();
    const list = this.rows() || [];
    if (!q) return list;

    return list.filter(r => {
      const vnName = this.getDisplayName(r).toLowerCase();
      const modName = this.getModuleLabel(r).toLowerCase();
      const desc = this.getDescription(r).toLowerCase();
      const code = (r.code || '').toLowerCase();
      return vnName.includes(q) || modName.includes(q) || desc.includes(q) || code.includes(q);
    });
  });

  readonly totalScore = computed(() =>
    (this.rows() || []).reduce((sum, r) => sum + calculateRowMaskScore(r), 0)
  );

  readonly totalCheckedActions = computed(() =>
    (this.rows() || []).reduce(
      (sum, r) =>
        sum +
        (r.canRead ? 1 : 0) +
        (r.canCreate ? 1 : 0) +
        (r.canUpdate ? 1 : 0) +
        (r.canDelete ? 1 : 0),
      0
    )
  );

  readonly activeModulesCount = computed(() =>
    (this.rows() || []).filter(r => calculateRowMaskScore(r) > 0).length
  );

  readonly globalMasterState = computed<'all' | 'partial' | 'none'>(() => {
    const list = this.rows() || [];
    if (list.length === 0) return 'none';
    const total = this.totalScore();
    const max = list.length * 15;
    if (total === 0) return 'none';
    if (total === max) return 'all';
    return 'partial';
  });

  getDisplayName(row: PermissionMatrixRow): string {
    return getVietnameseFunctionName(row.code, row.name);
  }

  getModuleLabel(row: PermissionMatrixRow): string {
    return getVietnameseModuleName(row.code, row.moduleCode);
  }

  getDescription(row: PermissionMatrixRow): string {
    return row.description || getVietnameseFunctionDescription(row.code);
  }

  getRowScore(row: PermissionMatrixRow): number {
    return calculateRowMaskScore(row);
  }

  getRowCountChecked(row: PermissionMatrixRow): number {
    return (
      (row.canRead ? 1 : 0) +
      (row.canCreate ? 1 : 0) +
      (row.canUpdate ? 1 : 0) +
      (row.canDelete ? 1 : 0)
    );
  }

  getRowLevelMeta(row: PermissionMatrixRow) {
    return getScoreLevelMeta(calculateRowMaskScore(row));
  }

  getColumnState(col: CrudColumnKey): 'all' | 'partial' | 'none' {
    const list = this.rows() || [];
    if (list.length === 0) return 'none';
    const checkedCount = list.filter(r => r[col]).length;
    if (checkedCount === 0) return 'none';
    if (checkedCount === list.length) return 'all';
    return 'partial';
  }

  getColumnMasterCheckClass(col: CrudColumnKey, color: 'emerald' | 'sky' | 'amber' | 'rose'): string {
    const state = this.getColumnState(col);
    if (state === 'none') {
      return 'bg-white border-slate-300 text-transparent group-hover:border-indigo-400';
    }
    const colorMap: Record<'emerald' | 'sky' | 'amber' | 'rose', string> = {
      emerald: 'bg-emerald-600 border-emerald-600 text-white shadow-2xs',
      sky: 'bg-sky-600 border-sky-600 text-white shadow-2xs',
      amber: 'bg-amber-500 border-amber-500 text-white shadow-2xs',
      rose: 'bg-rose-600 border-rose-600 text-white shadow-2xs'
    };
    return colorMap[color];
  }

  getGlobalMasterCheckClass(): string {
    const state = this.globalMasterState();
    if (state === 'all') {
      return 'bg-indigo-600 border-indigo-600 text-white shadow-2xs';
    }
    if (state === 'partial') {
      return 'bg-indigo-100 border-indigo-500 text-indigo-700';
    }
    return 'bg-white border-slate-300 text-transparent group-hover:border-indigo-500';
  }

  toggleCell(row: PermissionMatrixRow, col: CrudColumnKey): void {
    if (this.readonly()) return;
    const updated = this.rows().map(r =>
      r.functionId === row.functionId ? toggleCrudCellWithCascade(r, col) : r
    );
    this.rowsChange.emit(updated);
  }

  toggleRow(row: PermissionMatrixRow): void {
    if (this.readonly()) return;
    const currentScore = calculateRowMaskScore(row);
    const nextMask = currentScore === 15 ? 0 : 15;
    const updated = this.rows().map(r =>
      r.functionId === row.functionId ? applyScoreMaskToRow(r, nextMask) : r
    );
    this.rowsChange.emit(updated);
  }

  toggleColumn(col: CrudColumnKey): void {
    if (this.readonly()) return;
    const state = this.getColumnState(col);
    const nextVal = state !== 'all';
    const updated = this.rows().map(r => {
      if (col === 'canRead' && !nextVal) {
        return { ...r, canRead: false, canCreate: false, canUpdate: false, canDelete: false };
      }
      return {
        ...r,
        [col]: nextVal,
        canRead: nextVal ? true : r.canRead
      };
    });
    this.rowsChange.emit(updated);
  }

  toggleAllMaster(): void {
    if (this.readonly()) return;
    const nextMask = this.globalMasterState() === 'all' ? 0 : 15;
    this.applyGlobalScorePreset(nextMask);
  }

  applyGlobalScorePreset(maskScore: number): void {
    if (this.readonly()) return;
    const updated = this.rows().map(r => applyScoreMaskToRow(r, maskScore));
    this.rowsChange.emit(updated);
  }
}
