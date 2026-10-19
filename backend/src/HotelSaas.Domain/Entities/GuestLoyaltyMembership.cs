using System;
using System.Collections.Generic;
using HotelSaas.Domain.Common;
using HotelSaas.Domain.Enums;

namespace HotelSaas.Domain.Entities;

/// <summary>
/// Thẻ thành viên khách hàng theo Chuỗi lưu trú (Tenant) và Cơ sở đăng ký (Property).
/// </summary>
public class GuestLoyaltyMembership : BaseEntity, ITenantScopedEntity
{
    /// <summary>
    /// ID người dùng sở hữu thẻ thành viên.
    /// </summary>
    public Guid UserId { get; set; }

    /// <summary>
    /// Navigation property tới tài khoản người dùng.
    /// </summary>
    public User? User { get; set; }

    /// <summary>
    /// ID Chuỗi thương hiệu (Tenant chính) phát hành thẻ.
    /// </summary>
    public Guid TenantId { get; set; }

    /// <summary>
    /// Navigation property tới Tenant sở hữu.
    /// </summary>
    public Tenant? Tenant { get; set; }

    /// <summary>
    /// ID Chi nhánh / Cơ sở lưu trú ban đầu nơi khách hàng đăng ký thẻ.
    /// </summary>
    public Guid EnrolledPropertyId { get; set; }

    /// <summary>
    /// Navigation property tới cơ sở đăng ký.
    /// </summary>
    public Property? EnrolledProperty { get; set; }

    /// <summary>
    /// Mã định danh thẻ thành viên hiển thị cho khách (VD: "AUR-882910", "JOY-551209").
    /// </summary>
    public string MemberCode { get; set; } = string.Empty;

    /// <summary>
    /// Hạng thành viên hiện tại (Silver, Gold, Diamond).
    /// </summary>
    public LoyaltyTier Tier { get; set; } = LoyaltyTier.Silver;

    /// <summary>
    /// Số dư điểm thưởng khả dụng có thể dùng để giảm tiền thanh toán (1 điểm = 1.000 VNĐ).
    /// </summary>
    public int PointsBalance { get; set; }

    /// <summary>
    /// Tổng số điểm tích lũy trọn đời (không bị giảm khi tiêu điểm).
    /// </summary>
    public int LifetimePoints { get; set; }

    /// <summary>
    /// Số lượt lưu trú đã hoàn tất (CheckedOut) tại chuỗi này.
    /// </summary>
    public int CompletedStaysCount { get; set; }

    /// <summary>
    /// Optimistic concurrency token chống gian lận trừ điểm hai lần song song.
    /// </summary>
    public uint Version { get; set; }

    /// <summary>
    /// Danh sách các giao dịch trong Sổ cái Điểm thưởng.
    /// </summary>
    public ICollection<LoyaltyPointTransaction> Transactions { get; set; } = new List<LoyaltyPointTransaction>();
}
