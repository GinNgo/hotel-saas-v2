using System;
using System.Collections.Generic;
using HotelSaas.Domain.Common;
using HotelSaas.Domain.Enums;

namespace HotelSaas.Domain.Entities;

/// <summary>
/// Represents a physical branch, hotel location, or resort under a tenant enterprise.
/// Operates as the core boundary for room inventory, reservations, and localized operations.
/// </summary>
public class Property : BaseEntity, ITenantScopedEntity
{
    /// <summary>
    /// Foreign key to the parent tenant enterprise.
    /// </summary>
    public Guid TenantId { get; set; }

    /// <summary>
    /// Navigation property to the parent tenant enterprise.
    /// </summary>
    public Tenant? Tenant { get; set; }

    /// <summary>
    /// Display name of the physical property (e.g., "Golden Lotus Hotel - Da Nang Branch").
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Unique property code within the tenant (e.g., "MAIN", "DN-01").
    /// </summary>
    public string Code { get; set; } = string.Empty;

    /// <summary>
    /// Unique public URL slug for guests and online bookings.
    /// </summary>
    public string Slug { get; set; } = string.Empty;

    /// <summary>
    /// Detailed overview and description of this physical branch.
    /// </summary>
    public string? Description { get; set; }

    /// <summary>
    /// Physical street address of the property.
    /// </summary>
    public string Address { get; set; } = string.Empty;

    /// <summary>
    /// City or province where the property is located.
    /// </summary>
    public string City { get; set; } = string.Empty;

    /// <summary>
    /// Front desk or branch contact phone number.
    /// </summary>
    public string? PhoneNumber { get; set; }

    /// <summary>
    /// Front desk or reservations email address.
    /// </summary>
    public string? Email { get; set; }

    /// <summary>
    /// Classification of the property (Hotel, Resort, Hostel, Villa, etc.).
    /// </summary>
    public PropertyType PropertyType { get; set; } = PropertyType.Hotel;

    /// <summary>
    /// Star rating standard (0 for unrated, 1-5 stars).
    /// </summary>
    public int StarRating { get; set; }

    /// <summary>
    /// Standard check-in time for overnight stays (Decision D06 default: 12:00:00).
    /// </summary>
    public TimeOnly CheckInTime { get; set; } = new TimeOnly(12, 0, 0);

    /// <summary>
    /// Standard check-out time for overnight stays (Decision D06 default: 12:00:00 next day).
    /// </summary>
    public TimeOnly CheckOutTime { get; set; } = new TimeOnly(12, 0, 0);

    /// <summary>
    /// Minimum housekeeping turnover buffer between guest stays in minutes (Decision D07 default: 30 minutes).
    /// </summary>
    public int BufferMinutes { get; set; } = 30;

    /// <summary>
    /// Interim maximum allowable duration for hourly rentals in hours (Decision D14 - Chờ PO phê duyệt / Pending PO Approval).
    /// Configured as property policy boundary (1 &lt;= MaxHourlyHours &lt;= 24, interim default: 12) pending formal PO decision.
    /// Rentals exceeding this threshold must book overnight.
    /// </summary>
    public int MaxHourlyHours { get; set; } = 12;

    /// <summary>
    /// VAT tax percentage rate configured for this branch (default: 0.00%).
    /// </summary>
    public decimal TaxRatePercent { get; set; } = 0.00m;

    /// <summary>
    /// Service fee percentage rate configured for this branch (default: 0.00%).
    /// </summary>
    public decimal ServiceFeeRatePercent { get; set; } = 0.00m;

    /// <summary>
    /// GPS latitude coordinate for mapping and location search.
    /// </summary>
    public double? Latitude { get; set; }

    /// <summary>
    /// GPS longitude coordinate for mapping and location search.
    /// </summary>
    public double? Longitude { get; set; }

    /// <summary>
    /// Indicates whether the branch has been reviewed and published for public bookings.
    /// Default is false (safety guard: no auto-publishing).
    /// </summary>
    public bool IsPublished { get; set; } = false;

    /// <summary>
    /// Current operational status of the property (Active, Inactive, Suspended).
    /// </summary>
    public PropertyStatus Status { get; set; } = PropertyStatus.Active;

    // ── Navigation Collections ──────────────────────────────────────────

    /// <summary>
    /// Collection of physical rooms located at this branch.
    /// </summary>
    public ICollection<Room> Rooms { get; set; } = new List<Room>();

    /// <summary>
    /// Collection of room categories configured for this branch.
    /// </summary>
    public ICollection<RoomType> RoomTypes { get; set; } = new List<RoomType>();

    /// <summary>
    /// Collection of branch-specific surcharge policies (early check-in and late check-out).
    /// </summary>
    public ICollection<PropertySurchargePolicy> SurchargePolicies { get; set; } = new List<PropertySurchargePolicy>();

    /// <summary>
    /// Collection of room type pricing schedules configured for this branch.
    /// </summary>
    public ICollection<RoomTypeRate> RoomTypeRates { get; set; } = new List<RoomTypeRate>();

    /// <summary>
    /// Collection of reservations received for this branch.
    /// </summary>
    public ICollection<Reservation> Reservations { get; set; } = new List<Reservation>();

    /// <summary>
    /// Collection of payment transactions processed for this branch.
    /// </summary>
    public ICollection<Payment> Payments { get; set; } = new List<Payment>();

    /// <summary>
    /// Collection of staff members scoped to this specific branch.
    /// </summary>
    public ICollection<TenantStaff> StaffMembers { get; set; } = new List<TenantStaff>();
}
