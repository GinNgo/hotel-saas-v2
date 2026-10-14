using HotelSaas.Domain.Common;

namespace HotelSaas.Domain.Entities;

/// <summary>
/// Bảng cấu hình Gói Dịch Vụ (Động) thay cho Enum, do SuperAdmin quản lý.
/// </summary>
public class SubscriptionPlan : BaseEntity
{
    /// <summary>
    /// Mã định danh gói (ví dụ: BASIC, PRO, ENT).
    /// </summary>
    public string Code { get; set; } = string.Empty;

    /// <summary>
    /// Tên hiển thị của gói dịch vụ.
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Giá cước đăng ký theo tháng.
    /// </summary>
    public decimal MonthlyPrice { get; set; }

    /// <summary>
    /// Giá cước đăng ký theo năm.
    /// </summary>
    public decimal YearlyPrice { get; set; }

    /// <summary>
    /// Số lượng phòng tối đa được phép tạo.
    /// </summary>
    public int MaxRooms { get; set; }

    /// <summary>
    /// Số lượng nhân viên tối đa được phép tạo.
    /// </summary>
    public int MaxStaff { get; set; }

    /// <summary>
    /// Cho biết gói dịch vụ có hỗ trợ cổng thanh toán VNPay hay không.
    /// </summary>
    public bool HasVnPay { get; set; }

    /// <summary>
    /// Cho biết gói dịch vụ có hỗ trợ tính năng báo cáo nâng cao hay không.
    /// </summary>
    public bool HasAdvancedReports { get; set; }

    /// <summary>
    /// Trạng thái hoạt động của gói dịch vụ.
    /// </summary>
    public bool IsActive { get; set; } = true;
}
