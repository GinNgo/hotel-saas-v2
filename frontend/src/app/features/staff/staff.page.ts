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
import { StaffService } from '../../core/services/staff.service';
import { PropertyManagementService } from '../../core/services/property-management.service';
import { AuthService } from '../../core/services/auth.service';
import { AlertService } from '../../core/services/alert.service';
import {
  StaffMemberDto,
  AccessRoleDto,
  StaffRole,
  STAFF_ROLE_LABELS,
  STAFF_ROLE_BADGES,
  CreateStaffMemberRequest,
  UpdateStaffMemberRequest
} from '../../core/models/staff.model';
import { TenantPropertySummaryDto } from '../../core/models/public-booking.model';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { PaginationComponent } from '../../shared/components/pagination/pagination.component';

@Component({
  selector: 'app-staff',
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
              Quản lý Nhân sự & Phân quyền (Staff & RBAC)
            </h1>
            <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-100 text-indigo-800 border border-indigo-200">
              Phân quyền chi nhánh
            </span>
          </div>
          <p class="text-xs sm:text-sm text-slate-500 mt-1">
            Quản lý đội ngũ nhân viên, phân công chi nhánh làm việc và cấp quyền truy cập theo vai trò chức vụ.
          </p>
        </div>

        <div class="flex items-center gap-2.5">
          <button
            type="button"
            (click)="loadStaff()"
            class="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200/90 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
            title="Làm mới danh sách"
          >
            <i class="pi pi-refresh text-xs" [class.animate-spin]="loading()"></i>
            <span>Làm mới</span>
          </button>

          <button
            type="button"
            (click)="openCreateModal()"
            class="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            <i class="pi pi-user-plus text-xs"></i>
            <span>Thêm nhân viên</span>
          </button>
        </div>
      </div>

      <!-- Stat Cards -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div class="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
          <div class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tổng nhân sự</div>
          <div class="text-2xl font-extrabold text-slate-900 mt-1">{{ totalCount() }}</div>
          <div class="text-[11px] text-emerald-600 mt-0.5 font-medium">Toàn hệ thống</div>
        </div>
        <div class="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
          <div class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Quản lý / Chủ CS</div>
          <div class="text-2xl font-extrabold text-indigo-900 mt-1">{{ countManagers() }}</div>
          <div class="text-[11px] text-indigo-600 mt-0.5 font-medium">Cấp điều hành</div>
        </div>
        <div class="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
          <div class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Lễ tân</div>
          <div class="text-2xl font-extrabold text-emerald-900 mt-1">{{ countReceptionists() }}</div>
          <div class="text-[11px] text-emerald-600 mt-0.5 font-medium">Check-in & Thu ngân</div>
        </div>
        <div class="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
          <div class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Buồng phòng</div>
          <div class="text-2xl font-extrabold text-amber-900 mt-1">{{ countHousekeepers() }}</div>
          <div class="text-[11px] text-amber-600 mt-0.5 font-medium">Vệ sinh & Dọn dẹp</div>
        </div>
      </div>

      <!-- Filters Toolbar -->
      <div class="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div class="flex-1 flex flex-col sm:flex-row gap-2.5">
          <!-- Search Input -->
          <div class="relative flex-1">
            <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
            <input
              type="text"
              [(ngModel)]="searchKeyword"
              (keyup.enter)="onSearch()"
              placeholder="Tìm theo tên, email, số điện thoại..."
              class="w-full h-10 pl-9 pr-3 rounded-lg border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
            />
          </div>

          <!-- Role Filter -->
          <select
            [(ngModel)]="selectedRoleFilter"
            (change)="onFilterChange()"
            class="h-10 px-3 rounded-lg border border-slate-200 text-xs text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          >
            <option [ngValue]="null">Tất cả chức danh</option>
            <option [ngValue]="StaffRole.Owner">Chủ cơ sở (Owner)</option>
            <option [ngValue]="StaffRole.Manager">Quản lý (Manager)</option>
            <option [ngValue]="StaffRole.Receptionist">Lễ tân (Receptionist)</option>
            <option [ngValue]="StaffRole.Housekeeper">Buồng phòng (Housekeeper)</option>
          </select>

          <!-- Branch Filter -->
          <select
            [(ngModel)]="selectedPropertyFilter"
            (change)="onFilterChange()"
            class="h-10 px-3 rounded-lg border border-slate-200 text-xs text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 max-w-[220px]"
          >
            <option [ngValue]="null">Tất cả chi nhánh</option>
            @for (p of properties(); track p.id) {
              <option [ngValue]="p.id">{{ p.name }}</option>
            }
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

      <!-- Staff Table -->
      <div class="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        @if (loading()) {
          <div class="p-8 text-center text-slate-400 space-y-2">
            <i class="pi pi-spin pi-spinner text-2xl text-emerald-600"></i>
            <div class="text-xs">Đang tải danh sách nhân sự...</div>
          </div>
        } @else if (staffList().length === 0) {
          <app-empty-state
            iconClass="pi pi-users"
            title="Chưa có nhân viên nào"
            description="Không tìm thấy nhân viên phù hợp với bộ lọc. Hãy thêm nhân viên mới để phân công quản lý chi nhánh."
          ></app-empty-state>
        } @else {
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs text-slate-600">
              <thead class="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th class="px-5 py-3.5">Họ và tên</th>
                  <th class="px-5 py-3.5">Liên hệ</th>
                  <th class="px-5 py-3.5">Chức danh / Vai trò</th>
                  <th class="px-5 py-3.5">Phân công cơ sở</th>
                  <th class="px-5 py-3.5">Trạng thái</th>
                  <th class="px-5 py-3.5 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 font-medium">
                @for (member of staffList(); track member.id) {
                  <tr class="hover:bg-slate-50/70 transition-colors">
                    <!-- Name & Avatar -->
                    <td class="px-5 py-3.5">
                      <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-bold flex items-center justify-center text-xs">
                          {{ member.fullName.charAt(0).toUpperCase() }}
                        </div>
                        <div>
                          <div class="font-bold text-slate-900">{{ member.fullName }}</div>
                          <div class="text-[10px] text-slate-400">ID: {{ member.id.slice(0, 8) }}</div>
                        </div>
                      </div>
                    </td>

                    <!-- Contact -->
                    <td class="px-5 py-3.5">
                      <div class="text-slate-800">{{ member.email }}</div>
                      <div class="text-[11px] text-slate-400">{{ member.phoneNumber || 'Chưa có SĐT' }}</div>
                    </td>

                    <!-- Role Badge -->
                    <td class="px-5 py-3.5">
                      <span
                        class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border"
                        [ngClass]="getRoleBadgeClass(member.staffRole)"
                      >
                        {{ getRoleLabel(member.staffRole) }}
                      </span>
                    </td>

                    <!-- Branch Assignment -->
                    <td class="px-5 py-3.5">
                      @if (member.isTenantWide) {
                        <span class="inline-flex items-center gap-1 text-purple-700 font-semibold bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200 text-[11px]">
                          <i class="pi pi-globe text-[10px]"></i> Toàn chuỗi (HQ)
                        </span>
                      } @else {
                        <span class="inline-flex items-center gap-1 text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200 text-[11px]">
                          <i class="pi pi-building text-[10px] text-emerald-600"></i>
                          {{ member.propertyName || 'Chi nhánh cụ thể' }}
                        </span>
                      }
                    </td>

                    <!-- Status -->
                    <td class="px-5 py-3.5">
                      @if (member.isActive) {
                        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Đang hoạt động
                        </span>
                      } @else {
                        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                          <span class="w-1.5 h-1.5 rounded-full bg-slate-400"></span> Tạm khóa
                        </span>
                      }
                    </td>

                    <!-- Actions -->
                    <td class="px-5 py-3.5 text-right space-x-1.5">
                      <button
                        type="button"
                        (click)="openEditModal(member)"
                        class="p-1.5 rounded-lg text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer"
                        title="Chỉnh sửa vai trò"
                      >
                        <i class="pi pi-pencil text-xs"></i>
                      </button>
                      <button
                        type="button"
                        (click)="confirmDelete(member)"
                        class="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        title="Xóa phân công"
                      >
                        <i class="pi pi-trash text-xs"></i>
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

      <!-- Create Staff Modal -->
      @if (showCreateModal()) {
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div class="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in duration-150">
            <div class="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 class="text-base font-bold text-slate-900 flex items-center gap-2">
                <i class="pi pi-user-plus text-emerald-600"></i>
                <span>Thêm nhân viên mới</span>
              </h2>
              <button
                type="button"
                (click)="closeCreateModal()"
                class="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <i class="pi pi-times text-xs"></i>
              </button>
            </div>

            <div class="space-y-3.5 text-xs">
              <div>
                <label class="block font-semibold text-slate-700 mb-1">Họ và tên *</label>
                <input
                  type="text"
                  [(ngModel)]="createForm.fullName"
                  placeholder="Ví dụ: Nguyễn Văn An"
                  class="w-full h-10 px-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div>
                <label class="block font-semibold text-slate-700 mb-1">Email đăng nhập *</label>
                <input
                  type="email"
                  [(ngModel)]="createForm.email"
                  placeholder="an.nguyen@hotel.com"
                  class="w-full h-10 px-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block font-semibold text-slate-700 mb-1">Số điện thoại</label>
                  <input
                    type="text"
                    [(ngModel)]="createForm.phoneNumber"
                    placeholder="0912345678"
                    class="w-full h-10 px-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label class="block font-semibold text-slate-700 mb-1">Mật khẩu ban đầu</label>
                  <input
                    type="password"
                    [(ngModel)]="createForm.password"
                    placeholder="Mặc định: Staff@123456"
                    class="w-full h-10 px-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block font-semibold text-slate-700 mb-1">Chức danh / Vai trò *</label>
                  <select
                    [(ngModel)]="createForm.staffRole"
                    class="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  >
                    <option [ngValue]="StaffRole.Receptionist">Lễ tân (Receptionist)</option>
                    <option [ngValue]="StaffRole.Housekeeper">Buồng phòng (Housekeeper)</option>
                    <option [ngValue]="StaffRole.Manager">Quản lý (Manager)</option>
                    <option [ngValue]="StaffRole.Owner">Chủ cơ sở (Owner)</option>
                  </select>
                </div>
                <div>
                  <label class="block font-semibold text-slate-700 mb-1">Cơ sở phân công</label>
                  <select
                    [(ngModel)]="createForm.propertyId"
                    class="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  >
                    <option [ngValue]="null">Toàn chuỗi (HQ Tenant-wide)</option>
                    @for (p of properties(); track p.id) {
                      <option [ngValue]="p.id">{{ p.name }}</option>
                    }
                  </select>
                </div>
              </div>
            </div>

            <div class="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                (click)="closeCreateModal()"
                class="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                (click)="submitCreate()"
                [disabled]="submitting()"
                class="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors shadow-xs disabled:opacity-50"
              >
                @if (submitting()) {
                  <i class="pi pi-spin pi-spinner mr-1"></i>
                }
                <span>Lưu thông tin</span>
              </button>
            </div>
          </div>
        </div>
      }

      <!-- Edit Staff Modal -->
      @if (showEditModal() && editingMember()) {
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div class="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in duration-150">
            <div class="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 class="text-base font-bold text-slate-900 flex items-center gap-2">
                <i class="pi pi-pencil text-emerald-600"></i>
                <span>Chỉnh sửa thông tin nhân sự</span>
              </h2>
              <button
                type="button"
                (click)="closeEditModal()"
                class="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <i class="pi pi-times text-xs"></i>
              </button>
            </div>

            <div class="space-y-3.5 text-xs">
              <div class="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                <div class="font-bold text-slate-800 text-sm">{{ editingMember()!.fullName }}</div>
                <div class="text-slate-500">{{ editingMember()!.email }} &bull; {{ editingMember()!.phoneNumber || 'Chưa có SĐT' }}</div>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block font-semibold text-slate-700 mb-1">Chức danh / Vai trò</label>
                  <select
                    [(ngModel)]="editForm.staffRole"
                    class="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  >
                    <option [ngValue]="StaffRole.Receptionist">Lễ tân (Receptionist)</option>
                    <option [ngValue]="StaffRole.Housekeeper">Buồng phòng (Housekeeper)</option>
                    <option [ngValue]="StaffRole.Manager">Quản lý (Manager)</option>
                    <option [ngValue]="StaffRole.Owner">Chủ cơ sở (Owner)</option>
                  </select>
                </div>
                <div>
                  <label class="block font-semibold text-slate-700 mb-1">Cơ sở phân công</label>
                  <select
                    [(ngModel)]="editForm.propertyId"
                    class="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  >
                    <option [ngValue]="null">Toàn chuỗi (HQ Tenant-wide)</option>
                    @for (p of properties(); track p.id) {
                      <option [ngValue]="p.id">{{ p.name }}</option>
                    }
                  </select>
                </div>
              </div>

              <div class="pt-2">
                <label class="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    [(ngModel)]="editForm.isActive"
                    class="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                  />
                  <span class="font-semibold text-slate-800">Kích hoạt tài khoản làm việc</span>
                </label>
                <p class="text-[11px] text-slate-400 mt-0.5 ml-6">
                  Khi bỏ chọn, nhân viên sẽ bị tạm khóa quyền truy cập vào hệ thống PMS.
                </p>
              </div>
            </div>

            <div class="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                (click)="closeEditModal()"
                class="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                (click)="submitEdit()"
                [disabled]="submitting()"
                class="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors shadow-xs disabled:opacity-50"
              >
                @if (submitting()) {
                  <i class="pi pi-spin pi-spinner mr-1"></i>
                }
                <span>Cập nhật</span>
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `
})
export class StaffPage implements OnInit {
  private readonly staffService = inject(StaffService);
  private readonly propertyService = inject(PropertyManagementService);
  private readonly authService = inject(AuthService);
  private readonly alertService = inject(AlertService);

  readonly StaffRole = StaffRole;

  staffList = signal<StaffMemberDto[]>([]);
  roles = signal<AccessRoleDto[]>([]);
  properties = signal<{ id: string; name: string }[]>([]);
  loading = signal<boolean>(false);
  submitting = signal<boolean>(false);

  totalCount = signal<number>(0);
  currentPage = signal<number>(1);
  pageSize = signal<number>(20);

  searchKeyword = '';
  selectedRoleFilter: StaffRole | null = null;
  selectedPropertyFilter: string | null = null;

  showCreateModal = signal<boolean>(false);
  showEditModal = signal<boolean>(false);
  editingMember = signal<StaffMemberDto | null>(null);

  createForm: CreateStaffMemberRequest = {
    fullName: '',
    email: '',
    phoneNumber: '',
    password: '',
    propertyId: null,
    staffRole: StaffRole.Receptionist
  };

  editForm: UpdateStaffMemberRequest = {
    id: '',
    propertyId: null,
    staffRole: StaffRole.Receptionist,
    isActive: true
  };

  countManagers = computed(() =>
    this.staffList().filter(s => s.staffRole === StaffRole.Manager || s.staffRole === StaffRole.Owner).length
  );

  countReceptionists = computed(() =>
    this.staffList().filter(s => s.staffRole === StaffRole.Receptionist).length
  );

  countHousekeepers = computed(() =>
    this.staffList().filter(s => s.staffRole === StaffRole.Housekeeper).length
  );

  ngOnInit(): void {
    this.loadProperties();
    this.loadRoles();
    this.loadStaff();
  }

  loadProperties(): void {
    this.propertyService.getTenantProperties().subscribe({
      next: (props: TenantPropertySummaryDto[]) => this.properties.set(props.map(p => ({ id: p.id, name: p.name }))),
      error: () => {}
    });
  }

  loadRoles(): void {
    this.staffService.getRoles().subscribe({
      next: r => this.roles.set(r),
      error: () => {}
    });
  }

  loadStaff(): void {
    this.loading.set(true);
    this.staffService
      .getStaffMembers({
        search: this.searchKeyword,
        propertyId: this.selectedPropertyFilter || undefined,
        staffRole: this.selectedRoleFilter ?? undefined,
        page: this.currentPage(),
        pageSize: this.pageSize()
      })
      .subscribe({
        next: res => {
          this.staffList.set(res.items);
          this.totalCount.set(res.totalCount);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.alertService.toastError('Không thể tải danh sách nhân viên.');
        }
      });
  }

  onSearch(): void {
    this.currentPage.set(1);
    this.loadStaff();
  }

  onFilterChange(): void {
    this.currentPage.set(1);
    this.loadStaff();
  }

  onPageChange(page: number): void {
    this.currentPage.set(page);
    this.loadStaff();
  }

  getRoleLabel(role: StaffRole): string {
    return STAFF_ROLE_LABELS[role] || 'Nhân viên';
  }

  getRoleBadgeClass(role: StaffRole): string {
    return STAFF_ROLE_BADGES[role] || 'bg-slate-100 text-slate-800 border-slate-200';
  }

  openCreateModal(): void {
    this.createForm = {
      fullName: '',
      email: '',
      phoneNumber: '',
      password: '',
      propertyId: this.authService.activePropertyId() || null,
      staffRole: StaffRole.Receptionist
    };
    this.showCreateModal.set(true);
  }

  closeCreateModal(): void {
    this.showCreateModal.set(false);
  }

  submitCreate(): void {
    if (!this.createForm.fullName.trim() || !this.createForm.email.trim()) {
      this.alertService.toastError('Vui lòng điền họ tên và email hợp lệ.');
      return;
    }

    this.submitting.set(true);
    this.staffService.createStaffMember(this.createForm).subscribe({
      next: () => {
        this.submitting.set(false);
        this.closeCreateModal();
        this.alertService.toastSuccess('Thêm nhân sự mới thành công.');
        this.loadStaff();
      },
      error: err => {
        this.submitting.set(false);
        const msg = err.error?.message || 'Không thể tạo nhân viên mới.';
        this.alertService.toastError(msg);
      }
    });
  }

  openEditModal(member: StaffMemberDto): void {
    this.editingMember.set(member);
    this.editForm = {
      id: member.id,
      propertyId: member.propertyId || null,
      staffRole: member.staffRole,
      isActive: member.isActive
    };
    this.showEditModal.set(true);
  }

  closeEditModal(): void {
    this.showEditModal.set(false);
    this.editingMember.set(null);
  }

  submitEdit(): void {
    if (!this.editForm.id) return;

    this.submitting.set(true);
    this.staffService.updateStaffMember(this.editForm.id, this.editForm).subscribe({
      next: () => {
        this.submitting.set(false);
        this.closeEditModal();
        this.alertService.toastSuccess('Cập nhật nhân sự thành công.');
        this.loadStaff();
      },
      error: err => {
        this.submitting.set(false);
        const msg = err.error?.message || 'Không thể cập nhật thông tin nhân viên.';
        this.alertService.toastError(msg);
      }
    });
  }

  confirmDelete(member: StaffMemberDto): void {
    if (confirm(`Bạn có chắc chắn muốn thu hồi phân công nhân sự của ${member.fullName}?`)) {
      this.staffService.deleteStaffMember(member.id).subscribe({
        next: () => {
          this.alertService.toastSuccess('Đã thu hồi phân công nhân sự.');
          this.loadStaff();
        },
        error: err => {
          const msg = err.error?.message || 'Không thể xóa phân công nhân sự.';
          this.alertService.toastError(msg);
        }
      });
    }
  }
}
