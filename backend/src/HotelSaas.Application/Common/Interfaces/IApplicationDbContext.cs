using HotelSaas.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Common.Interfaces;

/// <summary>
/// Abstraction over the application's database context for use in the Application layer.
/// </summary>
public interface IApplicationDbContext
{
    /// <summary>Platform user accounts.</summary>
    DbSet<User> Users { get; }

    /// <summary>JWT refresh tokens.</summary>
    DbSet<RefreshToken> RefreshTokens { get; }

    /// <summary>Hotel/property tenants.</summary>
    DbSet<Tenant> Tenants { get; }

    /// <summary>Physical branches/properties belonging to tenants.</summary>
    DbSet<Property> Properties { get; }

    /// <summary>RBAC access roles.</summary>
    DbSet<AccessRole> AccessRoles { get; }

    /// <summary>Available permission functions.</summary>
    DbSet<PermissionFunction> PermissionFunctions { get; }

    /// <summary>Role-permission junction with bitmask.</summary>
    DbSet<RolePermission> RolePermissions { get; }

    /// <summary>Staff assignments to tenants.</summary>
    DbSet<TenantStaff> TenantStaffMembers { get; }

    /// <summary>Room type definitions.</summary>
    DbSet<RoomType> RoomTypes { get; }

    /// <summary>Physical rooms.</summary>
    DbSet<Room> Rooms { get; }

    /// <summary>Guest reservations.</summary>
    DbSet<Reservation> Reservations { get; }

    /// <summary>Payments.</summary>
    DbSet<Payment> Payments { get; }

    /// <summary>Tenant subscriptions.</summary>
    DbSet<Subscription> Subscriptions { get; }

    /// <summary>Cấu hình gói dịch vụ hệ thống.</summary>
    DbSet<SubscriptionPlan> SubscriptionPlans { get; }

    /// <summary>Banner thông báo và quảng cáo hệ thống.</summary>
    DbSet<SystemBanner> SystemBanners { get; }

    /// <summary>Branch-specific early check-in and late check-out surcharge policies.</summary>
    DbSet<PropertySurchargePolicy> PropertySurchargePolicies { get; }

    /// <summary>Versioned room type pricing schedules.</summary>
    DbSet<RoomTypeRate> RoomTypeRates { get; }

    /// <summary>Audit trail for room type rate modifications and interval splittings.</summary>
    DbSet<RoomTypeRateAudit> RoomTypeRateAudits { get; }

    /// <summary>Invoices issued for reservations.</summary>
    DbSet<Invoice> Invoices { get; }

    /// <summary>Line items on invoices.</summary>
    DbSet<InvoiceItem> InvoiceItems { get; }

    /// <summary>Thẻ thành viên tích điểm chuỗi/cơ sở của khách hàng.</summary>
    DbSet<GuestLoyaltyMembership> GuestLoyaltyMemberships { get; }

    /// <summary>Sổ cái giao dịch điểm thưởng bất biến.</summary>
    DbSet<LoyaltyPointTransaction> LoyaltyPointTransactions { get; }

    /// <summary>Hợp đồng cung cấp dịch vụ phần mềm SaaS ký kết với đối tác.</summary>
    DbSet<TenantContract> TenantContracts { get; }

    /// <summary>Cấu hình và mẫu in ấn tài liệu pháp lý / hóa đơn / phiếu xác nhận.</summary>
    DbSet<PrintTemplateConfig> PrintTemplateConfigs { get; }

    /// <summary>Liên kết tài khoản mạng xã hội (Google, Facebook).</summary>
    DbSet<SocialIdentity> SocialIdentities { get; }

    /// <summary>Đánh giá và nhận xét của khách lưu trú (Guest Reviews).</summary>
    DbSet<GuestReview> GuestReviews { get; }

    /// <summary>
    /// Starts a database transaction asynchronously.
    /// </summary>
    Task<Microsoft.EntityFrameworkCore.Storage.IDbContextTransaction> BeginTransactionAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Acquires an exclusive row-level lock on the specified user row using SELECT ... FOR UPDATE.
    /// Acts as root synchronization mutex across rotation, switch-context, and family revocation.
    /// </summary>
    Task LockUserRowAsync(Guid userId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Acquires an exclusive row-level lock on the parent room type row using SELECT ... FOR UPDATE
    /// with strict TenantId and PropertyId scoping to prevent concurrent rate overlaps.
    /// </summary>
    Task LockRoomTypeRowAsync(Guid roomTypeId, Guid tenantId, Guid propertyId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Acquires an exclusive row-level lock on the room row using SELECT ... FOR UPDATE
    /// with strict TenantId and PropertyId scoping to prevent concurrent overlapping bookings.
    /// </summary>
    Task LockRoomRowAsync(Guid roomId, Guid tenantId, Guid propertyId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Acquires an exclusive row-level lock on the reservation row using SELECT ... FOR UPDATE
    /// with strict TenantId and PropertyId scoping to prevent concurrent payment races or state transitions.
    /// </summary>
    Task LockReservationRowAsync(Guid reservationId, Guid tenantId, Guid propertyId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Acquires an exclusive advisory transaction-scoped lock for a specific idempotency key within a property scope.
    /// Serializes concurrent booking requests sharing the same idempotency key across different rooms.
    /// </summary>
    Task LockIdempotencyKeyAsync(Guid propertyId, string idempotencyKey, CancellationToken cancellationToken = default);

    /// <summary>
    /// Atomically updates a room's status using parameterized Raw SQL containing ExpectedOldStatus,
    /// TenantId, and PropertyId in the WHERE predicate. Returns the number of rows affected.
    /// </summary>
    Task<int> UpdateRoomStatusAtomicAsync(
        Guid roomId,
        Guid tenantId,
        Guid propertyId,
        HotelSaas.Domain.Enums.RoomStatus expectedOldStatus,
        HotelSaas.Domain.Enums.RoomStatus newStatus,
        DateTime updatedAtUtc,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Persists all pending changes to the database.
    /// </summary>
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
