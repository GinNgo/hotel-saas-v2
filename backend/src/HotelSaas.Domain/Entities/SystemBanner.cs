using HotelSaas.Domain.Common;

namespace HotelSaas.Domain.Entities;

/// <summary>
/// Banner quảng cáo hoặc thông báo toàn hệ thống.
/// Hỗ trợ target hiển thị theo ngày và theo gói dịch vụ (để upsell).
/// </summary>
public class SystemBanner : BaseEntity
{
    /// <summary>
    /// Tiêu đề hiển thị của banner.
    /// </summary>
    public string Title { get; set; } = string.Empty;

    /// <summary>
    /// Đường dẫn hình ảnh hiển thị của banner.
    /// </summary>
    public string ImageUrl { get; set; } = string.Empty;

    /// <summary>
    /// Đường dẫn đích khi người dùng nhấp vào banner (nếu có).
    /// </summary>
    public string? TargetUrl { get; set; }

    /// <summary>
    /// Mã gói dịch vụ mục tiêu cần hiển thị (nếu null = hiển thị cho mọi người).
    /// </summary>
    public string? TargetPlanCode { get; set; }

    /// <summary>
    /// Thời điểm bắt đầu hiển thị banner (UTC).
    /// </summary>
    public DateTime? ValidFromUtc { get; set; }

    /// <summary>
    /// Thời điểm kết thúc hiển thị banner (UTC).
    /// </summary>
    public DateTime? ValidToUtc { get; set; }

    /// <summary>
    /// Trạng thái hoạt động của banner.
    /// </summary>
    public bool IsActive { get; set; } = true;
}
