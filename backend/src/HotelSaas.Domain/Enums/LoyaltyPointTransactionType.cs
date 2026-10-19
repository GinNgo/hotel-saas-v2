namespace HotelSaas.Domain.Enums;

/// <summary>
/// Loại giao dịch điểm trong Sổ cái Điểm thưởng bất biến (Loyalty Point Ledger).
/// </summary>
public enum LoyaltyPointTransactionType
{
    /// <summary>Điểm thưởng chào mừng khi đăng ký thành viên mới tại cơ sở/chuỗi.</summary>
    WelcomeBonus = 1,

    /// <summary>Điểm tích lũy cộng sau khi trả phòng (Check-out) và thanh toán đủ.</summary>
    EarnedOnCheckout = 2,

    /// <summary>Khóa tạm/dùng điểm khi thực hiện giữ chỗ (GuestHold).</summary>
    HeldForBooking = 3,

    /// <summary>Dùng điểm thanh toán đơn đặt phòng đã xác nhận.</summary>
    RedeemedOnPayment = 4,

    /// <summary>Hoàn trả 100% điểm khi hủy đơn hợp lệ hoặc hết hạn giữ chỗ.</summary>
    RefundedOnCancel = 5,

    /// <summary>Khấu trừ thu hồi điểm khi có hoàn tiền hoặc điều chỉnh sau check-out.</summary>
    ClawbackOnRefund = 6
}
