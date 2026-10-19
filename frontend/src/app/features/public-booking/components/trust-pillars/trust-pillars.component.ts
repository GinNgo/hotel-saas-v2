import { Component } from '@angular/core';
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
  template: `
    <section class="mb-14" aria-label="Cam kết dịch vụ & Lý do chọn Hotel SaaS">
      <div class="text-center max-w-2xl mx-auto mb-8">
        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold uppercase tracking-wider mb-2">
          <i class="pi pi-shield"></i> Cam Kết Dịch Vụ Khách Hàng
        </span>
        <h2 class="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
          An Tâm Đặt Phòng &amp; Tận Hưởng Kỳ Nghỉ Trọn Vẹn
        </h2>
        <p class="text-xs sm:text-sm text-slate-500 mt-1">
          Nền tảng ứng dụng công nghệ khách sạn thông minh, bảo vệ quyền lợi tối đa cho khách lưu trú.
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
              <span>Tiêu chuẩn hệ thống</span>
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
      icon: 'pi pi-key',
      iconBg: 'bg-indigo-50',
      iconColor: 'text-indigo-600',
      badge: 'Tự động 24/7',
      title: 'Mở Khóa Thông Minh Smart Lock',
      description: 'Nhận mật mã số PIN và mã QR mở khóa phòng tự động ngay sau khi đặt, vào phòng 24/7 mà không cần chờ lễ tân.'
    },
    {
      icon: 'pi pi-verified',
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
      badge: 'Bảo chứng 100%',
      title: 'Bảo Đảm Hoàn Tiền Rõ Ràng',
      description: 'Hủy phòng miễn phí trước 24 giờ theo chính sách niêm yết. Hoàn tiền minh bạch, tự động về tài khoản ngân hàng.'
    },
    {
      icon: 'pi pi-wallet',
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-600',
      badge: 'Minh bạch 100%',
      title: 'Giá Cuối Cùng – Không Phí Ẩn',
      description: 'Báo giá chính xác gồm thuế VAT và phí dịch vụ. Cam kết không phát sinh phụ thu bất ngờ khi nhận phòng tại quầy.'
    },
    {
      icon: 'pi pi-sparkles',
      iconBg: 'bg-purple-50',
      iconColor: 'text-purple-600',
      badge: 'Hỗ trợ 24/7',
      title: 'Giữ Phòng Trong 30 Giây & AI',
      description: 'Trợ lý AI tiếng Việt hỗ trợ tìm phòng và so sánh tiện nghi tức thì. Lịch trống được xác thực trực tiếp theo thời gian thực.'
    }
  ];
}
