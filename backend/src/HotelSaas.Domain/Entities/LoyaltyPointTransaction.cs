using System;
using HotelSaas.Domain.Common;
using HotelSaas.Domain.Enums;

namespace HotelSaas.Domain.Entities;

/// <summary>
/// Bản ghi giao dịch bất biến trong Sổ cái Điểm thưởng (Immutable Point Ledger).
/// </summary>
public class LoyaltyPointTransaction : BaseEntity, ITenantScopedEntity
{
    /// <summary>
    /// ID thẻ thành viên được cộng/trừ/hoàn điểm.
    /// </summary>
    public Guid MembershipId { get; set; }

    /// <summary>
    /// Navigation property tới thẻ thành viên.
    /// </summary>
    public GuestLoyaltyMembership? Membership { get; set; }

    /// <summary>
    /// ID Chuỗi thương hiệu (Tenant).
    /// </summary>
    public Guid TenantId { get; set; }

    /// <summary>
    /// Navigation property tới Tenant sở hữu.
    /// </summary>
    public Tenant? Tenant { get; set; }

    /// <summary>
    /// ID Chi nhánh / Cơ sở lưu trú phát sinh giao dịch điểm (nếu có).
    /// </summary>
    public Guid? PropertyId { get; set; }

    /// <summary>
    /// Navigation property tới cơ sở lưu trú.
    /// </summary>
    public Property? Property { get; set; }

    /// <summary>
    /// ID Đơn đặt phòng liên quan (nếu có).
    /// </summary>
    public Guid? ReservationId { get; set; }

    /// <summary>
    /// Navigation property tới đơn đặt phòng.
    /// </summary>
    public Reservation? Reservation { get; set; }

    /// <summary>
    /// ID Hóa đơn liên quan (nếu có).
    /// </summary>
    public Guid? InvoiceId { get; set; }

    /// <summary>
    /// Navigation property tới hóa đơn.
    /// </summary>
    public Invoice? Invoice { get; set; }

    /// <summary>
    /// Loại giao dịch điểm (WelcomeBonus, EarnedOnCheckout, HeldForBooking, RedeemedOnPayment, RefundedOnCancel, ClawbackOnRefund).
    /// </summary>
    public LoyaltyPointTransactionType TransactionType { get; set; }

    /// <summary>
    /// Số điểm thay đổi (Dương: cộng/hoàn điểm, Âm: trừ điểm).
    /// </summary>
    public int PointsDelta { get; set; }

    /// <summary>
    /// Số dư điểm khả dụng sau khi thực hiện giao dịch này.
    /// </summary>
    public int BalanceAfter { get; set; }

    /// <summary>
    /// Diễn giải chi tiết lý do biến động điểm.
    /// </summary>
    public string Description { get; set; } = string.Empty;
}
