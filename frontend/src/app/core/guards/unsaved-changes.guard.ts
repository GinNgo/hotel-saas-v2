import { inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { AlertService } from '../services/alert.service';

/**
 * Giao diện đánh dấu component có trạng thái biểu mẫu chưa lưu.
 */
export interface HasUnsavedChanges {
  hasUnsavedChanges(): boolean;
}

/**
 * Route guard chặn điều hướng rời trang khi còn thay đổi chưa lưu,
 * hiển thị hộp thoại xác nhận qua AlertService.
 */
export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = (
  component: HasUnsavedChanges | null | undefined
) => {
  if (!component?.hasUnsavedChanges?.()) {
    return true;
  }

  const alertService = inject(AlertService);
  return alertService.confirmAction({
    title: 'Rời khỏi trang?',
    text: 'Bạn có thay đổi chưa được lưu. Nếu rời trang ngay lúc này, các thay đổi sẽ bị mất.',
    confirmButtonText: 'Rời khỏi trang',
    cancelButtonText: 'Ở lại chỉnh sửa',
    icon: 'warning'
  });
};
