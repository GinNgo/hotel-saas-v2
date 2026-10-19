using System;
using HotelSaas.Domain.Common;
using HotelSaas.Domain.Enums;

namespace HotelSaas.Domain.Entities;

/// <summary>
/// Thực thể Hợp đồng Cung cấp Dịch vụ Phần mềm ký kết giữa Nền tảng SaaS và Khách sạn / Doanh nghiệp Đối tác (Tenant).
/// </summary>
public class TenantContract : BaseEntity
{
    /// <summary>
    /// Khóa ngoại liên kết với Khách sạn / Doanh nghiệp đối tác (Tenant).
    /// </summary>
    public Guid TenantId { get; set; }

    /// <summary>
    /// Điều hướng tới Khách sạn / Doanh nghiệp đối tác.
    /// </summary>
    public Tenant? Tenant { get; set; }

    /// <summary>
    /// Số hợp đồng định danh duy nhất (ví dụ: HD-2026-STARTER-001, HD-2026-PRO-002).
    /// </summary>
    public string ContractNumber { get; set; } = string.Empty;

    /// <summary>
    /// Mã gói dịch vụ đăng ký (ví dụ: STARTER, PRO, ENTERPRISE).
    /// </summary>
    public string PlanCode { get; set; } = string.Empty;

    /// <summary>
    /// Tên gói dịch vụ đăng ký.
    /// </summary>
    public string PlanName { get; set; } = string.Empty;

    /// <summary>
    /// Loại hợp đồng (Standard, EnterpriseCustom, PilotTrial, AnnualPromotion).
    /// </summary>
    public string ContractType { get; set; } = "Standard";

    /// <summary>
    /// Họ và tên người đại diện pháp lý / người ký của bên khách sạn.
    /// </summary>
    public string RepresentativeName { get; set; } = string.Empty;

    /// <summary>
    /// Email liên hệ người đại diện.
    /// </summary>
    public string RepresentativeEmail { get; set; } = string.Empty;

    /// <summary>
    /// Số điện thoại liên hệ người đại diện.
    /// </summary>
    public string RepresentativePhone { get; set; } = string.Empty;

    /// <summary>
    /// Ngày bắt đầu có hiệu lực hợp đồng.
    /// </summary>
    public DateOnly StartDate { get; set; }

    /// <summary>
    /// Ngày kết thúc hiệu lực hợp đồng.
    /// </summary>
    public DateOnly EndDate { get; set; }

    /// <summary>
    /// Chu kỳ thanh toán cước phần mềm (Monthly, Annual, etc.).
    /// </summary>
    public BillingCycle BillingCycle { get; set; } = BillingCycle.Monthly;

    /// <summary>
    /// Tổng giá trị hợp đồng theo chu kỳ (VND).
    /// </summary>
    public decimal ContractValue { get; set; }

    /// <summary>
    /// Trạng thái pháp lý và hiệu lực hiện hành của hợp đồng.
    /// </summary>
    public TenantContractStatus Status { get; set; } = TenantContractStatus.Active;

    /// <summary>
    /// Thời điểm ký kết hợp đồng số bằng chữ ký điện tử (UTC). Null nếu chưa ký.
    /// </summary>
    public DateTime? SignedAtUtc { get; set; }

    /// <summary>
    /// Mã băm xác thực chữ ký điện tử hoặc mã checksum cam kết.
    /// </summary>
    public string? DigitalSignatureHash { get; set; }

    /// <summary>
    /// Nội dung các điều khoản cam kết dịch vụ (SLA, bảo mật dữ liệu, giới hạn phòng).
    /// </summary>
    public string? TermsAndConditions { get; set; }

    /// <summary>
    /// Ghi chú nội bộ dành cho Ban quản trị nền tảng (Super Admin).
    /// </summary>
    public string? Notes { get; set; }
}
