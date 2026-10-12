import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Dialog } from 'primeng/dialog';
import { Button } from 'primeng/button';
import { AuthService } from '../../../core/services/auth.service';
import { UserMembershipDto } from '../../../core/models/auth.model';
import { NotificationService } from '../../../core/services/notification.service';

/**
 * Hộp thoại Chọn / Đổi Chi nhánh làm việc (Branch Context Selector).
 * Bắt buộc người dùng đăng nhập bằng Bootstrap Token phải chủ động chọn chi nhánh,
 * không tự ý gán nhánh đầu tiên (tuân thủ nguyên tắc PO & Handoff).
 */
@Component({
  selector: 'app-context-selector-dialog',
  standalone: true,
  imports: [CommonModule, Dialog, Button],
  template: `
    <p-dialog
      [(visible)]="visible"
      [modal]="true"
      [closable]="!requireSelection"
      [dismissableMask]="!requireSelection"
      [closeOnEscape]="!requireSelection"
      closeAriaLabel="Đóng hộp thoại chọn chi nhánh"
      header="Chọn chi nhánh làm việc"
      [style]="{ width: '92vw', maxWidth: '560px', maxHeight: '90vh' }"
      [contentStyle]="{ maxHeight: '75vh', overflow: 'auto' }"
      styleClass="p-dialog-modern"
      (onHide)="onClose()"
    >
      <div class="space-y-4 pt-1">
        <p class="text-sm text-slate-600 leading-relaxed">
          Tài khoản của bạn có quyền thao tác trên nhiều chi nhánh. Vui lòng chọn chi nhánh làm việc để hệ thống thiết lập dữ liệu và phân quyền phù hợp:
        </p>

        @if (errorMessage()) {
          <div class="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start gap-2.5">
            <i class="pi pi-exclamation-triangle text-base text-rose-500 mt-0.5"></i>
            <span>{{ errorMessage() }}</span>
          </div>
        }

        <!-- Danh sách chi nhánh -->
        <div class="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
          @for (m of branchMemberships(); track m.id) {
            <div
              (click)="selectBranch(m)"
              class="group relative flex items-center justify-between p-3.5 rounded-xl border transition-all duration-200 cursor-pointer"
              [ngClass]="{
                'border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-500/20': isActive(m.propertyId),
                'border-slate-200 bg-white hover:border-emerald-300 hover:bg-slate-50/80 hover:shadow-xs': !isActive(m.propertyId),
                'opacity-60 pointer-events-none': switchingPropertyId() !== null
              }"
            >
              <div class="flex items-center gap-3.5 min-w-0">
                <!-- Icon / Code Badge -->
                <div
                  class="flex items-center justify-center w-11 h-11 rounded-lg text-xs font-bold shrink-0 transition-colors"
                  [ngClass]="{
                    'bg-emerald-600 text-white shadow-xs': isActive(m.propertyId),
                    'bg-slate-100 text-slate-700 group-hover:bg-emerald-100 group-hover:text-emerald-800': !isActive(m.propertyId)
                  }"
                >
                  {{ m.propertyCode || 'CN' }}
                </div>

                <!-- Text Info -->
                <div class="min-w-0">
                  <div class="flex items-center gap-2">
                    <span class="text-sm font-semibold text-slate-800 truncate group-hover:text-emerald-700 transition-colors">
                      {{ m.propertyName || ('Chi nhánh ' + m.propertyCode) }}
                    </span>
                    @if (isActive(m.propertyId)) {
                      <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-800">
                        Đang chọn
                      </span>
                    }
                  </div>
                  <div class="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                    <span>Vai trò: <strong class="text-slate-700 font-medium">{{ m.roleName || m.staffRole }}</strong></span>
                    <span>&bull;</span>
                    <span>{{ m.tenantName }}</span>
                  </div>
                </div>
              </div>

              <!-- Action Indicator -->
              <div class="shrink-0 pl-3">
                @if (switchingPropertyId() === m.propertyId) {
                  <i class="pi pi-spin pi-spinner text-emerald-600 text-lg"></i>
                } @else if (isActive(m.propertyId)) {
                  <i class="pi pi-check-circle text-emerald-600 text-lg"></i>
                } @else {
                  <i class="pi pi-arrow-right text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all text-sm"></i>
                }
              </div>
            </div>
          } @empty {
            <div class="py-8 text-center text-slate-500">
              <i class="pi pi-building text-3xl text-slate-300 mb-2"></i>
              <p class="text-sm">Không tìm thấy chi nhánh nào được gán cho tài khoản này.</p>
            </div>
          }
        </div>

        @if (!requireSelection) {
          <div class="pt-3 border-t border-slate-100 flex justify-end">
            <p-button
              label="Đóng"
              icon="pi pi-times"
              [text]="true"
              severity="secondary"
              (onClick)="onClose()"
            />
          </div>
        }
      </div>
    </p-dialog>
  `
})
export class ContextSelectorDialogComponent {
  private readonly authService = inject(AuthService);
  private readonly notification = inject(NotificationService);

  @Input() visible = false;
  @Input() requireSelection = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() contextSwitched = new EventEmitter<UserMembershipDto>();

  switchingPropertyId = signal<string | null>(null);
  errorMessage = signal<string | null>(null);

  /** Lọc các memberships có gắn với một Property cụ thể (bỏ qua tenant-wide không có propertyId) */
  branchMemberships = signal<UserMembershipDto[]>([]);

  ngOnInit(): void {
    this.refreshMemberships();
  }

  ngOnChanges(): void {
    this.refreshMemberships();
  }

  refreshMemberships(): void {
    const list = this.authService.memberships;
    const validBranches = list.filter(m => !!m.propertyId);
    if (validBranches.length === 0) {
      this.authService.fetchMyMemberships().subscribe({
        next: (fullList) => {
          this.branchMemberships.set(fullList.filter(m => !!m.propertyId));
        },
        error: () => {
          this.branchMemberships.set([]);
        }
      });
    } else {
      this.branchMemberships.set(validBranches);
    }
  }

  isActive(propertyId: string | null): boolean {
    if (!propertyId) return false;
    return this.authService.activePropertyId()?.toLowerCase() === propertyId.toLowerCase();
  }

  selectBranch(membership: UserMembershipDto): void {
    if (!membership.propertyId) return;

    // Nếu đã là chi nhánh hiện tại và không bị ép buộc chọn, chỉ cần đóng modal
    if (this.isActive(membership.propertyId) && !this.requireSelection) {
      this.closeDialog();
      return;
    }

    this.switchingPropertyId.set(membership.propertyId);
    this.errorMessage.set(null);

    this.authService.switchContext(membership.propertyId).subscribe({
      next: () => {
        this.switchingPropertyId.set(null);
        this.notification.success(`Đã chuyển sang chi nhánh: ${membership.propertyName || membership.propertyCode}`);
        this.contextSwitched.emit(membership);
        this.closeDialog();
      },
      error: (err) => {
        this.switchingPropertyId.set(null);
        const detail = err?.error?.title || err?.error?.message || 'Không thể chuyển chi nhánh. Vui lòng thử lại.';
        this.errorMessage.set(detail);
      }
    });
  }

  onClose(): void {
    if (this.requireSelection && !this.authService.activePropertyId()) {
      return; // Không cho phép đóng nếu chưa chọn chi nhánh
    }
    this.closeDialog();
  }

  private closeDialog(): void {
    this.visible = false;
    this.visibleChange.emit(false);
  }
}
