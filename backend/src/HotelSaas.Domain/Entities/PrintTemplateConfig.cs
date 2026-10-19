using System;
using HotelSaas.Domain.Common;

namespace HotelSaas.Domain.Entities;

/// <summary>
/// Cấu hình và Mẫu in ấn tài liệu pháp lý / hóa đơn / phiếu xác nhận theo cơ sở hoặc chuỗi khách sạn.
/// </summary>
public class PrintTemplateConfig : BaseEntity
{
    /// <summary>
    /// Khóa ngoại liên kết với Doanh nghiệp đối tác (Tenant).
    /// </summary>
    public Guid TenantId { get; set; }

    /// <summary>
    /// Navigation property to Tenant.
    /// </summary>
    public Tenant? Tenant { get; set; }

    /// <summary>
    /// Khóa ngoại tùy chọn liên kết với Chi nhánh cụ thể (null nếu áp dụng toàn chuỗi).
    /// </summary>
    public Guid? PropertyId { get; set; }

    /// <summary>
    /// Navigation property to Property.
    /// </summary>
    public Property? Property { get; set; }

    /// <summary>
    /// Tên đơn vị in ấn / Tên thương hiệu hiển thị đầu hóa đơn/phiếu.
    /// </summary>
    public string HeaderCompanyName { get; set; } = string.Empty;

    /// <summary>
    /// Địa chỉ pháp lý hoặc địa chỉ chi nhánh xuất hiện trên bản in.
    /// </summary>
    public string HeaderAddress { get; set; } = string.Empty;

    /// <summary>
    /// Mã số thuế (MST) của cơ sở / doanh nghiệp.
    /// </summary>
    public string TaxNumber { get; set; } = string.Empty;

    /// <summary>
    /// Số điện thoại đường dây nóng hỗ trợ khách hàng in trên phiếu.
    /// </summary>
    public string Hotline { get; set; } = string.Empty;

    /// <summary>
    /// URL logo chất lượng cao hiển thị ở góc trên bên trái bản in.
    /// </summary>
    public string? LogoUrl { get; set; }

    /// <summary>
    /// Tên ngân hàng thụ hưởng (dùng tạo mã VietQR chuyển khoản thanh toán).
    /// </summary>
    public string BankName { get; set; } = "MBBank";

    /// <summary>
    /// Số tài khoản ngân hàng nhận tiền phòng / tiền cọc.
    /// </summary>
    public string BankAccountNumber { get; set; } = string.Empty;

    /// <summary>
    /// Tên chủ tài khoản thụ hưởng.
    /// </summary>
    public string BankAccountHolder { get; set; } = string.Empty;

    /// <summary>
    /// Lời cảm ơn hoặc quy định in ở cuối hóa đơn (Footer note).
    /// </summary>
    public string FooterNote { get; set; } = "Cảm ơn Quý khách đã tin tưởng và sử dụng dịch vụ của chúng tôi! Hẹn gặp lại Quý khách.";

    /// <summary>
    /// Quy định nhận/trả phòng và phạt hủy phòng in trên phiếu xác nhận.
    /// </summary>
    public string CheckInPolicyText { get; set; } = "Nhận phòng từ 14:00 - Trả phòng trước 12:00. Vui lòng xuất trình CCCD/Hộ chiếu khi làm thủ tục.";

    /// <summary>
    /// Cờ bật/tắt in mã QR động chuyển khoản tức thì trên phiếu thu ngân.
    /// </summary>
    public bool ShowVietQrCode { get; set; } = true;

    /// <summary>
    /// Khổ giấy mặc định (A4, A5, K80_Receipt).
    /// </summary>
    public string DefaultPaperSize { get; set; } = "A4";
}
