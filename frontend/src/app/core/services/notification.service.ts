import { Injectable, inject } from '@angular/core';
import { AlertService } from './alert.service';

/**
 * Service thông báo dùng chung, gom toàn bộ thông báo về AlertService (SweetAlert2)
 * để tránh việc duy trì nhiều hệ thống toast trùng lặp theo yêu cầu PO.
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly alertService = inject(AlertService);

  success(message: string, summary: string = 'Thành công'): void {
    this.alertService.toastSuccess(message, summary);
  }

  error(message: string, summary: string = 'Đã có lỗi'): void {
    this.alertService.toastError(message, summary);
  }

  warning(message: string, summary: string = 'Cảnh báo'): void {
    this.alertService.toastWarning(message, summary);
  }

  info(message: string, summary: string = 'Thông tin'): void {
    this.alertService.toastInfo(message, summary);
  }
}
