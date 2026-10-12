import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, FormsModule, Validators } from '@angular/forms';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Textarea } from 'primeng/textarea';
import { Dialog } from 'primeng/dialog';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { RoomTypeService } from '../../core/services/room-type.service';
import { AuthService } from '../../core/services/auth.service';
import { RoomTypeDto } from '../../core/models/room-type.model';
import { AlertService } from '../../core/services/alert.service';
import { HttpErrorResponse } from '@angular/common/http';

/**
 * Trang Quản lý Loại phòng (Room Types Management).
 * Hỗ trợ toàn diện CRUD: Xem danh sách, Thêm mới, Chỉnh sửa, Xóa (kèm xử lý 409 Conflict).
 */
@Component({
  selector: 'app-room-types',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    Button,
    InputText,
    Textarea,
    Dialog,
    ConfirmDialog
  ],
  template: `
    <div class="max-w-7xl mx-auto space-y-6">
      <!-- Page Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h1 class="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">Quản lý Loại phòng</h1>
          <p class="text-xs sm:text-sm text-slate-500 mt-1">
            Thiết lập danh mục phân loại phòng, giá cơ bản và sức chứa tối đa.
          </p>
        </div>

        <div class="flex items-center gap-3">
          @if (canCreate()) {
            <p-button
              label="Thêm loại phòng"
              icon="pi pi-plus"
              (onClick)="openCreateDialog()"
              styleClass="p-button-success"
            />
          }
        </div>
      </div>

      <!-- Search & Filter Bar -->
      <div class="bg-white rounded-xl border border-slate-200/80 p-3.5 shadow-2xs flex items-center justify-between gap-3">
        <div class="relative flex-1 max-w-md">
          <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
          <input
            pInputText
            id="searchRoomTypeInput"
            name="searchRoomType"
            aria-label="Tìm theo tên hoặc mã loại phòng"
            [(ngModel)]="searchQuery"
            (ngModelChange)="onSearchChange()"
            type="text"
            placeholder="Tìm theo tên hoặc mã loại phòng..."
            class="w-full pl-9 text-sm"
          />
        </div>
        <div class="text-xs text-slate-500 font-medium">
          Tổng số: <strong class="text-slate-800">{{ roomTypes().length }}</strong> loại phòng
        </div>
      </div>

      <!-- Data Table Card -->
      <div class="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        @if (loading()) {
          <div class="p-8 space-y-3">
            @for (i of [1, 2, 3, 4]; track i) {
              <div class="h-12 bg-slate-100/80 animate-pulse rounded-lg"></div>
            }
          </div>
        } @else if (roomTypes().length === 0) {
          <!-- Empty State -->
          <div class="py-16 text-center text-slate-400">
            <div class="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3 border border-emerald-100">
              <i class="pi pi-tags text-2xl"></i>
            </div>
            <h3 class="text-base font-semibold text-slate-700">Chưa có loại phòng nào</h3>
            <p class="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Hãy tạo loại phòng đầu tiên để thiết lập cấu trúc phòng và bảng giá cho chi nhánh.
            </p>
            <div class="mt-4">
              <p-button
                label="Tạo loại phòng ngay"
                icon="pi pi-plus"
                size="small"
                styleClass="p-button-success"
                (onClick)="openCreateDialog()"
              />
            </div>
          </div>
        } @else {
          <!-- Responsive Table -->
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="border-b border-slate-200/80 bg-slate-50/60 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th class="py-3 px-4">Mã</th>
                  <th class="py-3 px-4">Tên loại phòng</th>
                  <th class="py-3 px-4">Giá cơ bản / đêm</th>
                  <th class="py-3 px-4">Sức chứa</th>
                  <th class="py-3 px-4">Loại giường</th>
                  <th class="py-3 px-4 text-center">Số phòng</th>
                  <th class="py-3 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 text-sm">
                @for (rt of roomTypes(); track rt.id) {
                  <tr class="hover:bg-slate-50/80 transition-colors">
                    <td class="py-3.5 px-4 font-mono font-bold text-emerald-700">
                      {{ rt.code }}
                    </td>
                    <td class="py-3.5 px-4 font-semibold text-slate-800">
                      {{ rt.name }}
                      @if (rt.description) {
                        <p class="text-xs font-normal text-slate-400 truncate max-w-xs mt-0.5">{{ rt.description }}</p>
                      }
                    </td>
                    <td class="py-3.5 px-4 font-semibold text-slate-800">
                      {{ formatCurrency(rt.basePrice) }}
                    </td>
                    <td class="py-3.5 px-4 text-slate-600">
                      {{ rt.maxOccupancy }} người
                    </td>
                    <td class="py-3.5 px-4 text-slate-600">
                      {{ rt.bedType || 'Tiêu chuẩn' }}
                    </td>
                    <td class="py-3.5 px-4 text-center">
                      <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                        {{ rt.roomCount }}
                      </span>
                    </td>
                    <td class="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                      @if (canUpdate()) {
                        <button
                          type="button"
                          (click)="openEditDialog(rt)"
                          class="p-1.5 rounded-lg text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
                          title="Chỉnh sửa loại phòng"
                          [attr.aria-label]="'Chỉnh sửa loại phòng ' + rt.name"
                        >
                          <i class="pi pi-pencil text-sm"></i>
                        </button>
                      }
                      @if (canDelete()) {
                        <button
                          type="button"
                          (click)="confirmDelete(rt)"
                          class="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          title="Xóa loại phòng"
                          [attr.aria-label]="'Xóa loại phòng ' + rt.name"
                        >
                          <i class="pi pi-trash text-sm"></i>
                        </button>
                      }
                      @if (!canUpdate() && !canDelete()) {
                        <span class="text-[11px] text-slate-400 italic">Chỉ xem</span>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>
    </div>

    <!-- Dialog Thêm / Sửa Loại phòng -->
    <p-dialog
      [(visible)]="dialogVisible"
      [modal]="true"
      [header]="isEditing() ? 'Cập nhật loại phòng' : 'Thêm loại phòng mới'"
      closeAriaLabel="Đóng hộp thoại"
      [style]="{ width: '92vw', maxWidth: '520px', maxHeight: '90vh' }"
      [contentStyle]="{ maxHeight: '75vh', overflow: 'auto' }"
      styleClass="p-dialog-modern"
    >
      <form [formGroup]="form" (ngSubmit)="saveRoomType()" class="space-y-4 pt-1">
        @if (formError()) {
          <div class="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
            <i class="pi pi-exclamation-triangle mt-0.5"></i>
            <span>{{ formError() }}</span>
          </div>
        }

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <!-- Mã loại phòng -->
          <div>
            <label for="roomTypeCodeInput" class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Mã loại phòng <span class="text-rose-500">*</span>
            </label>
            <input
              pInputText
              id="roomTypeCodeInput"
              name="code"
              formControlName="code"
              placeholder="VD: DLX, VIP"
              class="w-full text-sm uppercase"
            />
            @if (form.get('code')?.touched && form.get('code')?.invalid) {
              <p class="text-xs text-rose-600 mt-1">Mã không được để trống (2-10 ký tự)</p>
            }
          </div>

          <!-- Sức chứa -->
          <div>
            <label for="roomTypeMaxOccupancyInput" class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Sức chứa tối đa <span class="text-rose-500">*</span>
            </label>
            <input
              pInputText
              id="roomTypeMaxOccupancyInput"
              name="maxOccupancy"
              type="number"
              formControlName="maxOccupancy"
              min="1"
              max="20"
              class="w-full text-sm"
            />
          </div>
        </div>

        <!-- Tên loại phòng -->
        <div>
          <label for="roomTypeNameInput" class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
            Tên loại phòng <span class="text-rose-500">*</span>
          </label>
          <input
            pInputText
            id="roomTypeNameInput"
            name="name"
            formControlName="name"
            placeholder="VD: Deluxe Double King"
            class="w-full text-sm"
          />
          @if (form.get('name')?.touched && form.get('name')?.invalid) {
            <p class="text-xs text-rose-600 mt-1">Tên loại phòng là bắt buộc</p>
          }
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <!-- Giá cơ bản -->
          <div>
            <label for="roomTypeBasePriceInput" class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Giá cơ bản (VNĐ) <span class="text-rose-500">*</span>
            </label>
            <input
              pInputText
              id="roomTypeBasePriceInput"
              name="basePrice"
              type="number"
              formControlName="basePrice"
              step="50000"
              min="1"
              class="w-full text-sm font-semibold"
            />
          </div>

          <!-- Loại giường -->
          <div>
            <label for="roomTypeBedTypeInput" class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Loại giường
            </label>
            <input
              pInputText
              id="roomTypeBedTypeInput"
              name="bedType"
              formControlName="bedType"
              placeholder="VD: 1 Giường đôi lớn"
              class="w-full text-sm"
            />
          </div>
        </div>

        <!-- Mô tả -->
        <div>
          <label for="roomTypeDescInput" class="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
            Mô tả tiện ích
          </label>
          <textarea
            pTextarea
            id="roomTypeDescInput"
            name="description"
            formControlName="description"
            rows="3"
            placeholder="Chi tiết nội thất, hướng nhìn, tiện nghi..."
            class="w-full text-sm"
          ></textarea>
        </div>

        <div class="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
          <p-button
            label="Hủy"
            [text]="true"
            severity="secondary"
            (onClick)="dialogVisible = false"
          />
          <p-button
            type="submit"
            [label]="isEditing() ? 'Cập nhật' : 'Thêm mới'"
            icon="pi pi-check"
            [loading]="saving()"
            [disabled]="form.invalid || saving()"
            styleClass="p-button-success"
          />
        </div>
      </form>
    </p-dialog>

    <p-confirmdialog />
  `
})
export class RoomTypesPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly roomTypeService = inject(RoomTypeService);
  private readonly alertService = inject(AlertService);
  readonly authService = inject(AuthService);

  canCreate = computed(() => this.authService.hasPermission('ROOM_TYPES', 2));
  canUpdate = computed(() => this.authService.hasPermission('ROOM_TYPES', 4));
  canDelete = computed(() => this.authService.hasPermission('ROOM_TYPES', 8));

  loading = signal(true);
  saving = signal(false);
  formError = signal<string | null>(null);
  roomTypes = signal<RoomTypeDto[]>([]);
  searchQuery = '';

  dialogVisible = false;
  isEditing = signal(false);
  editingId: string | null = null;

  form = this.fb.group({
    code: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(10)]],
    name: ['', [Validators.required, Validators.minLength(2)]],
    basePrice: [1000000, [Validators.required, Validators.min(1)]],
    maxOccupancy: [2, [Validators.required, Validators.min(1)]],
    bedType: [''],
    description: ['']
  });

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
    this.roomTypeService.getRoomTypes(this.searchQuery, 1, 100).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.roomTypes.set(res.items || []);
      },
      error: () => {
        this.loading.set(false);
      }
    });
  }

  onSearchChange(): void {
    this.loadData();
  }

  openCreateDialog(): void {
    this.isEditing.set(false);
    this.editingId = null;
    this.formError.set(null);
    this.form.reset({
      code: '',
      name: '',
      basePrice: 1000000,
      maxOccupancy: 2,
      bedType: '',
      description: ''
    });
    this.dialogVisible = true;
  }

  openEditDialog(rt: RoomTypeDto): void {
    this.isEditing.set(true);
    this.editingId = rt.id;
    this.formError.set(null);
    this.form.patchValue({
      code: rt.code,
      name: rt.name,
      basePrice: rt.basePrice,
      maxOccupancy: rt.maxOccupancy,
      bedType: rt.bedType || '',
      description: rt.description || ''
    });
    this.dialogVisible = true;
  }

  saveRoomType(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.formError.set(null);

    const val = this.form.getRawValue();
    const payload = {
      code: val.code!.trim().toUpperCase(),
      name: val.name!.trim(),
      basePrice: Number(val.basePrice!),
      maxOccupancy: Number(val.maxOccupancy!),
      bedType: val.bedType?.trim() || undefined,
      description: val.description?.trim() || undefined
    };

    if (this.isEditing() && this.editingId) {
      this.roomTypeService.updateRoomType(this.editingId, payload).subscribe({
        next: () => {
          this.saving.set(false);
          this.dialogVisible = false;
          this.alertService.toastSuccess('Cập nhật loại phòng thành công!');
          this.loadData();
        },
        error: (err: HttpErrorResponse) => {
          this.saving.set(false);
          const detail = err.error?.title || err.error?.message || 'Có lỗi xảy ra khi cập nhật.';
          this.formError.set(detail);
        }
      });
    } else {
      this.roomTypeService.createRoomType(payload).subscribe({
        next: () => {
          this.saving.set(false);
          this.dialogVisible = false;
          this.alertService.toastSuccess('Thêm loại phòng thành công!');
          this.loadData();
        },
        error: (err: HttpErrorResponse) => {
          this.saving.set(false);
          if (err.status === 409) {
            this.formError.set(`Mã loại phòng "${payload.code}" đã tồn tại trên chi nhánh này.`);
          } else {
            const detail = err.error?.title || err.error?.message || 'Có lỗi xảy ra khi tạo loại phòng.';
            this.formError.set(detail);
          }
        }
      });
    }
  }

  async confirmDelete(rt: RoomTypeDto): Promise<void> {
    const confirmed = await this.alertService.confirmDelete({
      title: 'Xác nhận xóa loại phòng?',
      text: `Bạn có chắc chắn muốn xóa loại phòng "${rt.name}" (${rt.code})? Hành động này không thể hoàn tác.`
    });

    if (!confirmed) return;

    this.roomTypeService.deleteRoomType(rt.id).subscribe({
      next: () => {
        this.alertService.toastSuccess(`Đã xóa loại phòng ${rt.name}.`);
        this.loadData();
      },
      error: (err: HttpErrorResponse) => {
        if (err.status === 409) {
          this.alertService.toastError('Không thể xóa loại phòng vì đang có phòng vật lý trực thuộc!');
        } else if (err.status === 403) {
          this.alertService.toastError('Bạn không có quyền thực hiện xóa loại phòng.');
        } else {
          this.alertService.toastError('Có lỗi xảy ra khi xóa loại phòng.');
        }
      }
    });
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
  }
}
