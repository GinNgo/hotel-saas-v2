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

    /// <summary>
    /// Persists all pending changes to the database.
    /// </summary>
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
