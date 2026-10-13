import { Component } from '@angular/core';

/**
 * Khung màn hình Quản lý Buồng phòng (Housekeeping Scaffold)
 * (Mã nguồn hoàn chỉnh sẽ được đưa vào qua Pull Request từ nhánh tính năng)
 */
@Component({
  selector: 'app-housekeeping',
  standalone: true,
  template: `
    <div class="max-w-7xl mx-auto space-y-6">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h1 class="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">Quản lý Buồng phòng</h1>
          <p class="text-xs sm:text-sm text-slate-500 mt-1">
            Theo dõi phân luồng dọn dẹp và cập nhật trạng thái phòng vật lý theo thời gian thực.
          </p>
        </div>
      </div>

      <div class="bg-white rounded-xl border border-slate-200/80 p-8 text-center shadow-xs">
        <div class="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
          <i class="pi pi-sparkles text-xl"></i>
        </div>
        <h3 class="text-base font-semibold text-slate-800">Phân hệ Bảng Buồng phòng & Trạng thái phòng</h3>
        <p class="text-xs sm:text-sm text-slate-500 mt-1 max-w-md mx-auto">
          Tính năng này đang được phát triển và sẽ sớm ra mắt trong các phiên bản tiếp theo.
        </p>
      </div>
    </div>
  `
})
export class HousekeepingPage {}
