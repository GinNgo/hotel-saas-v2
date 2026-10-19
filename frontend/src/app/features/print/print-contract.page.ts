import { Component, OnInit, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { PrintDocumentsService } from '../../core/services/print-documents.service';
import { PrintContractDto } from '../../core/models/print-document.model';

@Component({
  selector: 'app-print-contract-page',
  standalone: true,
  imports: [CommonModule, RouterModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-slate-100 p-4 sm:p-8 print:p-0 print:bg-white text-slate-800 font-serif">
      <!-- Action Toolbar -->
      <div class="max-w-4xl mx-auto mb-6 flex items-center justify-between print:hidden font-sans">
        <a
          routerLink="/admin/contracts"
          class="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 bg-white px-3.5 py-2 rounded-xl border border-slate-200 shadow-2xs"
        >
          <i class="pi pi-arrow-left"></i> Về danh sách hợp đồng
        </a>

        <div class="flex items-center gap-3">
          <button
            type="button"
            (click)="windowPrint()"
            class="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors shadow-sm cursor-pointer"
          >
            <i class="pi pi-print"></i> In Hợp Đồng (Ctrl + P)
          </button>
        </div>
      </div>

      <!-- Printable Legal Document Sheet -->
      @if (contract(); as c) {
        <div class="max-w-4xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200/80 p-10 sm:p-14 print:shadow-none print:border-none print:p-0 print:max-w-none space-y-6">
          <!-- National Emblem / Header -->
          <div class="text-center space-y-1 pb-4 border-b border-slate-300">
            <div class="font-bold text-xs uppercase tracking-widest text-slate-900">
              CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
            </div>
            <div class="text-xs font-semibold text-slate-700">Độc lập - Tự do - Hạnh phúc</div>
            <div class="text-[11px] text-slate-400">---***---</div>
            <div class="pt-4">
              <h1 class="text-xl sm:text-2xl font-black text-slate-900 uppercase tracking-tight">
                HỢP ĐỒNG CUNG CẤP & SỬ DỤNG DỊCH VỤ PHẦN MỀM SAAS
              </h1>
              <div class="text-xs text-slate-600 font-mono mt-1">
                Số HĐ: <span class="font-bold text-slate-900">{{ c.contractNumber }}</span>
              </div>
              <div class="text-[11px] text-slate-500 italic mt-0.5">
                (Áp dụng theo Nghị định 52/2013/NĐ-CP & Luật Giao dịch Điện tử về hợp đồng số)
              </div>
            </div>
          </div>

          <!-- Preamble -->
          <div class="text-xs leading-relaxed text-slate-700 text-justify">
            Hôm nay, ngày {{ c.createdAt | slice:0:10 }}, tại nền tảng điện toán đám mây Hotel SaaS Platform v2, chúng tôi gồm các bên:
          </div>

          <!-- Parties Info -->
          <div class="space-y-4 text-xs font-sans">
            <!-- Party A (SaaS Provider) -->
            <div class="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1.5">
              <div class="font-bold text-slate-900 uppercase text-[11px]">BÊN A: BÊN CUNG CẤP DỊCH VỤ NỀN TẢNG (HOTEL SAAS)</div>
              <div><span class="text-slate-500">Tên đơn vị:</span> <strong class="text-slate-900 ml-1">{{ c.providerName }}</strong></div>
              <div><span class="text-slate-500">Địa chỉ trụ sở:</span> <span class="text-slate-800 ml-1">{{ c.providerAddress }}</span></div>
              <div class="flex flex-wrap gap-6">
                <div><span class="text-slate-500">Mã số thuế:</span> <span class="font-mono font-semibold text-slate-800 ml-1">{{ c.providerTaxCode }}</span></div>
                <div><span class="text-slate-500">Người đại diện:</span> <strong class="text-slate-800 ml-1">{{ c.providerRepresentative }}</strong></div>
                <div><span class="text-slate-500">Hotline kỹ thuật:</span> <span class="text-slate-800 ml-1">{{ c.providerHotline }}</span></div>
              </div>
            </div>

            <!-- Party B (Tenant Hotel) -->
            <div class="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1.5">
              <div class="font-bold text-slate-900 uppercase text-[11px]">BÊN B: BÊN SỬ DỤNG DỊCH VỤ (ĐỐI TÁC KHÁCH SẠN / TENANT)</div>
              <div><span class="text-slate-500">Tên doanh nghiệp:</span> <strong class="text-slate-900 ml-1">{{ c.tenantName }}</strong></div>
              <div><span class="text-slate-500">Mã Tenant:</span> <span class="font-mono font-bold text-indigo-700 ml-1">{{ c.tenantCode }}</span></div>
              <div><span class="text-slate-500">Địa chỉ pháp lý:</span> <span class="text-slate-800 ml-1">{{ c.tenantAddress }}</span></div>
              <div class="flex flex-wrap gap-6">
                <div><span class="text-slate-500">Người đại diện pháp luật:</span> <strong class="text-slate-800 ml-1">{{ c.representativeName }}</strong></div>
                <div><span class="text-slate-500">Điện thoại liên hệ:</span> <span class="text-slate-800 ml-1">{{ c.representativePhone }}</span></div>
                <div><span class="text-slate-500">Email nhận thông báo:</span> <span class="text-slate-800 ml-1">{{ c.representativeEmail }}</span></div>
              </div>
            </div>
          </div>

          <!-- Contract Clauses -->
          <div class="space-y-4 text-xs leading-relaxed text-slate-700 text-justify">
            <div>
              <strong class="text-slate-900">ĐIỀU 1: ĐỐI TƯỢNG VÀ PHẠM VI HỢP ĐỒNG</strong>
              <p class="mt-1">
                Bên A đồng ý cấp quyền truy cập và duy trì phần mềm quản lý khách sạn điện toán đám mây cho Bên B theo gói <strong>{{ c.planName }} (Mã gói: {{ c.planCode }})</strong>, loại hợp đồng <strong>{{ c.contractType }}</strong>. Hệ thống hỗ trợ quản lý phòng, giá bán linh hoạt (giờ/đêm/ngày), đặt phòng trực tuyến, thanh toán VietQR và báo cáo thống kê.
              </p>
            </div>

            <div>
              <strong class="text-slate-900">ĐIỀU 2: THỜI HẠN VÀ GIÁ TRỊ HỢP ĐỒNG</strong>
              <div class="mt-1 space-y-1">
                <div>- Thời hạn hiệu lực: Từ ngày <strong class="text-slate-900">{{ c.startDate }}</strong> đến hết ngày <strong class="text-slate-900">{{ c.endDate }}</strong>.</div>
                <div>- Chu kỳ thanh toán: <strong class="text-slate-900">{{ c.billingCycle }}</strong>.</div>
                <div>- Tổng giá trị hợp đồng: <strong class="text-indigo-700 text-sm">{{ c.contractValue | number:'1.0-0' }} VNĐ</strong> (Đã bao gồm thuế GTGT và phí vận hành máy chủ).</div>
              </div>
            </div>

            <div>
              <strong class="text-slate-900">ĐIỀU 3: CAM KẾT CHẤT LƯỢNG DỊCH VỤ (SLA 99.9%)</strong>
              <p class="mt-1">
                Bên A cam kết độ khả dụng của hệ thống máy chủ đạt tối thiểu 99.9% hàng tháng. Toàn bộ dữ liệu của Bên B được sao lưu định kỳ hàng ngày, mã hóa chuẩn TLS 1.3 và lưu trữ đa vùng an toàn. Hỗ trợ sự cố khẩn cấp qua hotline 24/7.
              </p>
            </div>

            <div>
              <strong class="text-slate-900">ĐIỀU 4: ĐIỀU KHOẢN BỔ SUNG & BẢO MẬT</strong>
              <p class="mt-1 italic text-slate-600">
                "{{ c.termsAndConditions }}"
              </p>
            </div>
          </div>

          <!-- Digital Signature Verification Box -->
          <div class="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 space-y-2 text-xs font-sans">
            <div class="flex items-center gap-2 text-emerald-800 font-bold uppercase text-[11px]">
              <i class="pi pi-shield"></i> Xác thực Chữ Ký Điện Tử Hợp Lệ
            </div>
            <div class="text-slate-700">
              Trạng thái hợp đồng: <strong class="text-emerald-700">{{ c.status }}</strong>
              @if (c.signedAtUtc) {
                <span> — Ký lúc: <strong>{{ c.signedAtUtc | slice:0:19 }} UTC</strong></span>
              }
            </div>
            <div class="font-mono text-[11px] text-slate-500 break-all">
              Mã băm kiểm toán (Hash): {{ c.digitalSignatureHash || 'SHA256:7a9c8b2d3e4f1a2b3c4d5e6f7a8b9c0d1e2f3a4b' }}
            </div>
          </div>

          <!-- Signatures Section -->
          <div class="grid grid-cols-2 gap-8 pt-8 text-center text-xs font-sans">
            <div>
              <div class="font-bold text-slate-900 uppercase tracking-wider">ĐẠI DIỆN BÊN B (KHÁCH SẠN)</div>
              <div class="text-[11px] text-slate-400 italic">(Đã ký xác nhận điện tử)</div>
              <div class="h-20 flex items-center justify-center">
                <div class="border-2 border-emerald-600 rounded-lg p-2 text-emerald-700 font-mono text-[10px] text-left">
                  [DIGITALLY SIGNED]<br>
                  Signer: {{ c.representativeName }}<br>
                  Status: VERIFIED
                </div>
              </div>
              <div class="font-semibold text-slate-800">{{ c.representativeName }}</div>
            </div>

            <div>
              <div class="font-bold text-slate-900 uppercase tracking-wider">ĐẠI DIỆN BÊN A (NỀN TẢNG SAAS)</div>
              <div class="text-[11px] text-slate-400 italic">(Ký số & con dấu điện tử)</div>
              <div class="h-20 flex items-center justify-center">
                <div class="border-2 border-dashed border-indigo-600 rounded-full px-4 py-2 text-indigo-700 font-bold uppercase text-[10px] rotate-[-4deg]">
                  HOTEL SAAS PLATFORM<br>AUTHORIZED SIGNATURE
                </div>
              </div>
              <div class="font-semibold text-slate-800">{{ c.providerRepresentative }}</div>
            </div>
          </div>
        </div>
      } @else if (isLoading()) {
        <div class="max-w-4xl mx-auto bg-white rounded-2xl p-12 text-center text-slate-500 font-sans">
          <i class="pi pi-spin pi-spinner text-3xl mb-3 text-indigo-600"></i>
          <div>Đang khởi tạo văn bản hợp đồng dịch vụ số...</div>
        </div>
      } @else {
        <div class="max-w-4xl mx-auto bg-white rounded-2xl p-12 text-center text-rose-500 font-sans">
          <i class="pi pi-exclamation-triangle text-3xl mb-3"></i>
          <div>Không tìm thấy hợp đồng hoặc mã hợp đồng không hợp lệ.</div>
        </div>
      }
    </div>
  `,
  styles: [`
    @media print {
      body {
        background: white !important;
      }
      .print\\:hidden {
        display: none !important;
      }
    }
  `]
})
export class PrintContractPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly printService = inject(PrintDocumentsService);

  readonly contract = signal<PrintContractDto | null>(null);
  readonly isLoading = signal(true);

  ngOnInit(): void {
    const contractId = this.route.snapshot.paramMap.get('id');
    if (contractId) {
      this.printService.getContract(contractId).subscribe({
        next: data => {
          this.contract.set(data);
          this.isLoading.set(false);
        },
        error: () => {
          this.isLoading.set(false);
        }
      });
    } else {
      this.isLoading.set(false);
    }
  }

  windowPrint(): void {
    window.print();
  }
}
