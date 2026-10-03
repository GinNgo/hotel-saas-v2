namespace HotelSaas.Domain.Enums;

/// <summary>
/// Gói đăng ký dịch vụ cho tenant (khách sạn).
/// Subscription tiers available for tenants.
/// </summary>
public enum SubscriptionTier
{
    /// <summary>
    /// Gói cơ bản — giới hạn số phòng và tính năng.
    /// Basic tier with limited rooms and features.
    /// </summary>
    Basic = 1,

    /// <summary>
    /// Gói chuyên nghiệp — mở rộng số phòng, báo cáo nâng cao.
    /// Professional tier with more rooms and advanced reporting.
    /// </summary>
    Pro = 2,

    /// <summary>
    /// Gói doanh nghiệp — không giới hạn, hỗ trợ ưu tiên.
    /// Enterprise tier with unlimited rooms and priority support.
    /// </summary>
    Enterprise = 3
}
