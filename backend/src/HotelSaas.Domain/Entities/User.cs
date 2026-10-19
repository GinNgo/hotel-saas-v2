using HotelSaas.Domain.Common;
using HotelSaas.Domain.Enums;

namespace HotelSaas.Domain.Entities;

/// <summary>
/// Represents a platform user who can be a customer, staff member, or administrator.
/// </summary>
public class User : BaseEntity
{
    /// <summary>
    /// Unique username for authentication.
    /// </summary>
    public string Username { get; set; } = string.Empty;

    /// <summary>
    /// Email address used for authentication and communication.
    /// </summary>
    public string Email { get; set; } = string.Empty;

    /// <summary>
    /// BCrypt-hashed password.
    /// </summary>
    public string PasswordHash { get; set; } = string.Empty;

    /// <summary>
    /// Full display name of the user.
    /// </summary>
    public string FullName { get; set; } = string.Empty;

    /// <summary>
    /// Optional contact phone number.
    /// </summary>
    public string? PhoneNumber { get; set; }

    /// <summary>
    /// Optional URL to the user's avatar image.
    /// </summary>
    public string? AvatarUrl { get; set; }

    /// <summary>
    /// UTC timestamp when the user's email was verified; null if unverified.
    /// </summary>
    public DateTime? EmailVerifiedAtUtc { get; set; }

    /// <summary>
    /// Global role determining platform-wide access level.
    /// </summary>
    public GlobalUserRole GlobalRole { get; set; } = GlobalUserRole.Customer;

    /// <summary>
    /// Whether the user account is active and can authenticate.
    /// </summary>
    public bool IsActive { get; set; } = true;

    /// <summary>
    /// Optional default tenant association for staff users.
    /// </summary>
    public Guid? TenantId { get; set; }

    /// <summary>
    /// Navigation property to the user's default tenant.
    /// </summary>
    public Tenant? Tenant { get; set; }

    /// <summary>
    /// Tên công ty lưu sẵn của khách hàng phục vụ xuất hóa đơn VAT.
    /// </summary>
    public string? CompanyName { get; set; }

    /// <summary>
    /// Mã số thuế công ty của khách hàng.
    /// </summary>
    public string? CompanyTaxCode { get; set; }

    /// <summary>
    /// Địa chỉ pháp lý công ty lưu sẵn của khách hàng.
    /// </summary>
    public string? CompanyAddress { get; set; }

    // ── Navigation Properties ──────────────────────────────────────────

    /// <summary>
    /// Danh sách thẻ thành viên tích điểm tại các Chuỗi / Cơ sở lưu trú.
    /// </summary>
    public ICollection<GuestLoyaltyMembership> LoyaltyMemberships { get; set; } = new List<GuestLoyaltyMembership>();

    /// <summary>
    /// Collection of refresh tokens issued to this user.
    /// </summary>
    public ICollection<RefreshToken> RefreshTokens { get; set; } = new List<RefreshToken>();

    /// <summary>
    /// Collection of tenant staff profiles this user holds across properties.
    /// </summary>
    public ICollection<TenantStaff> TenantStaffProfiles { get; set; } = new List<TenantStaff>();

    /// <summary>
    /// Liên kết tài khoản mạng xã hội (Google, Facebook).
    /// </summary>
    public ICollection<SocialIdentity> SocialIdentities { get; set; } = new List<SocialIdentity>();
}
