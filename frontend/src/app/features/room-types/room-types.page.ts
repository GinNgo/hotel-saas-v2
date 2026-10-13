import { Component } from '@angular/core';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';

/**
 * Khung màn hình Quản lý Loại phòng (Room Types Catalog)
 * Chức năng đầy đủ sẽ được tích hợp trong Sprint tiếp theo.
 */
@Component({
  selector: 'app-room-types',
  standalone: true,
  imports: [EmptyStateComponent],
  template: `
    <div class="max-w-7xl mx-auto space-y-6">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <h1 class="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">Quản lý Loại phòng</h1>
          <p class="text-xs sm:text-sm text-slate-500 mt-1">
            Thiết lập danh mục phân loại phòng, giá cơ bản và sức chứa tối đa.
          </p>
        </div>
      </div>

      <app-empty-state
        iconClass="pi pi-tags"
        title="Tính năng đang được phát triển"
        description="Phân hệ Quản lý Hạng phòng đang trong quá trình phát triển và sẽ được tích hợp trong phiên bản tiếp theo."
      />
    </div>
  `
})
export class RoomTypesPage {}
