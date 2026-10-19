namespace HotelSaas.Domain.Enums;

/// <summary>
/// Hạng thẻ thành viên của khách hàng trong hệ thống loyalty của chuỗi/cơ sở.
/// </summary>
public enum LoyaltyTier
{
    /// <summary>Thành viên Bạc: mặc định khi đăng ký, giảm 5%, tích điểm 2%.</summary>
    Silver = 1,

    /// <summary>Thành viên Vàng: từ 5 lượt ở, giảm 8%, tích điểm 4%.</summary>
    Gold = 2,

    /// <summary>Thành viên Kim Cương: từ 15 lượt ở, giảm 12%, tích điểm 6%.</summary>
    Diamond = 3
}
