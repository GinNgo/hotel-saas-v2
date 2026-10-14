import { Component } from '@angular/core';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';

/**
 * Khung màn hình Quản lý Phòng (Rooms Catalog)
 * Chức năng đầy đủ sẽ được tích hợp trong Sprint tiếp theo.
 */
@Component({
  selector: 'app-rooms',
  standalone: true,
  imports: [EmptyStateComponent],
  template: `
    <div class="max-w-7xl mx-auto space-y-6">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <h1 class="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">Quản lý Phòng</h1>
          <p class="text-xs sm:text-sm text-slate-500 mt-1">
            Theo dõi danh sách phòng vật lý, tầng lầu và trạng thái buồng phòng.
          </p>
        </div>
      </div>

      <app-empty-state
        iconClass="pi pi-home"
        title="Tính năng đang được phát triển"
        description="Phân hệ Quản lý Danh mục Phòng đang trong quá trình phát triển và sẽ được tích hợp trong phiên bản tiếp theo."
      />
    </div>
  `
})
export class RoomsPage {}
