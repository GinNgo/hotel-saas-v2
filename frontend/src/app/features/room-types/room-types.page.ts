import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Khung màn hình Quản lý Loại phòng (Room Types Scaffold)
 * Phân hệ phụ trách: Nguyễn Khôi Nguyên (MSSV: 24TX810011)
 * Nhánh tính năng: feature/nguyen-rooms
 * (Mã nguồn hoàn chỉnh sẽ được đưa vào qua Pull Request từ feature/nguyen-rooms)
 */
@Component({
  selector: 'app-room-types',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="max-w-7xl mx-auto space-y-6">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h1 class="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">Quản lý Loại phòng</h1>
          <p class="text-xs sm:text-sm text-slate-500 mt-1">
            Thiết lập danh mục phân loại phòng, giá cơ bản và sức chứa tối đa.
          </p>
        </div>
      </div>

      <div class="bg-white rounded-xl border border-slate-200/80 p-8 text-center shadow-xs">
        <div class="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-3">
          <i class="pi pi-tags text-xl"></i>
        </div>
        <h3 class="text-base font-semibold text-slate-800">Phân hệ Quản lý Hạng phòng</h3>
        <p class="text-xs sm:text-sm text-slate-500 mt-1 max-w-md mx-auto">
          Màn hình đang được hoàn thiện bởi <b>Nguyễn Khôi Nguyên (24TX810011)</b> trên nhánh tính năng <code>feature/nguyen-rooms</code>.
        </p>
      </div>
    </div>
  `
})
export class RoomTypesPage {}
