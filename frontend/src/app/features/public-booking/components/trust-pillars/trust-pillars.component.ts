import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';

interface TrustPillar {
  icon: string;
  iconBg: string;
  iconColor: string;
  badge: string;
  title: string;
  description: string;
}

@Component({
  selector: 'app-trust-pillars',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mb-14" aria-label="Nguyên tắc vận hành & Đặt phòng minh bạch">
      <div class="text-center max-w-2xl mx-auto mb-8">
        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold uppercase tracking-wider mb-2">
          <i class="pi pi-shield"></i> Vận Hành Minh Bạch
        </span>
        <h2 class="font-serif text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
          An Tâm Kiểm Tra Phòng Trống &amp; Báo Giá Trực Tiếp
        </h2>
        <p class="text-xs sm:text-sm text-slate-500 mt-1">
          Dữ liệu phòng trống, thuế phí và chính sách hủy phòng được đồng bộ trực tiếp từ từng cơ sở lưu trú.
        </p>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        @for (pillar of pillars; track pillar.title) {
          <div
            class="rounded-2xl bg-white border border-slate-200/90 p-5 shadow-xs hover:shadow-md transition-all duration-200 group flex flex-col justify-between"
          >
            <div>
              <div class="flex items-center justify-between mb-3.5">
                <div
                  class="w-11 h-11 rounded-xl flex items-center justify-center text-lg shadow-2xs group-hover:scale-105 transition-transform"
                  [ngClass]="pillar.iconBg + ' ' + pillar.iconColor"
                >
                  <i [class]="pillar.icon"></i>
                </div>
                <span class="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600">
                  {{ pillar.badge }}
                </span>
              </div>

              <h3 class="text-sm font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
                {{ pillar.title }}
              </h3>
              <p class="text-xs text-slate-500 mt-1.5 leading-relaxed">
                {{ pillar.description }}
              </p>
            </div>

            <div class="mt-4 pt-3 border-t border-slate-100 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700">
              <i class="pi pi-check-circle text-xs"></i>
              <span>Đồng bộ từ hệ thống PMS</span>
            </div>
          </div>
        }
      </div>
    </section>
  `
})
export class TrustPillarsComponent {
  readonly pillars: TrustPillar[] = [
    {
      icon: 'pi pi-clock',
      iconBg: 'bg-indigo-50',
      iconColor: 'text-indigo-600',
      badge: 'Giữ chỗ 15p',
      title: 'Giữ Phòng Tạm Thời Theo Thời Gian Thực',
      description: 'Giữ chỗ trong 15 phút (có thể gia hạn 1 lần thêm 5 phút) trong lúc bạn kiểm tra thông tin và hoàn tất đặt phòng.'
    },
    {
      icon: 'pi pi-verified',
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
      badge: 'Chính sách rõ',
      title: 'Xem Trước Điều Kiện Hủy Phòng',
      description: 'Hiển thị rõ mức phí hủy và số tiền dự kiến hoàn trả theo chính sách của cơ sở trước khi bạn xác nhận hủy.'
    },
    {
      icon: 'pi pi-wallet',
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-600',
      badge: 'Quote Engine',
      title: 'Báo Giá Theo Biểu Giá Cơ Sở',
      description: 'Tính giá trực tiếp theo giờ, qua đêm hoặc theo ngày cùng thuế VAT và phí dịch vụ do từng cơ sở cấu hình.'
    },
    {
      icon: 'pi pi-sparkles',
      iconBg: 'bg-purple-50',
      iconColor: 'text-purple-600',
      badge: 'Trực tuyến',
      title: 'Tra Cứu Mã Đặt Phòng & Trợ Lý AI',
      description: 'Hỗ trợ tìm kiếm chỗ nghỉ theo khu vực, khoảng cách địa danh và tra cứu chi tiết đơn đặt phòng bằng mã bảo mật.'
    }
  ];
}
