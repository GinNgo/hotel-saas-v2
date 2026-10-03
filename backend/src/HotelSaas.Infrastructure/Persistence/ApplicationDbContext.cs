using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Domain.Common;
using HotelSaas.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Infrastructure.Persistence;

/// <summary>
/// Primary database context for the Hotel SaaS platform.
/// Applies tenant-scoped global query filters and automatic audit timestamps.
/// </summary>
public sealed class ApplicationDbContext : DbContext
{
    private readonly ICurrentTenantService _currentTenantService;

    /// <summary>
    /// Initializes a new instance of <see cref="ApplicationDbContext"/>.
    /// </summary>
    /// <param name="options">EF Core options configured with Npgsql provider.</param>
    /// <param name="currentTenantService">Scoped service providing the current tenant identifier.</param>
    public ApplicationDbContext(
        DbContextOptions<ApplicationDbContext> options,
        ICurrentTenantService currentTenantService)
        : base(options)
    {
        _currentTenantService = currentTenantService;
    }

    /// <summary>Hotel/property tenants.</summary>
    public DbSet<Tenant> Tenants => Set<Tenant>();

    /// <summary>Platform user accounts.</summary>
    public DbSet<User> Users => Set<User>();

    /// <summary>RBAC access roles with bitmask permissions.</summary>
    public DbSet<AccessRole> AccessRoles => Set<AccessRole>();

    /// <summary>Available permission functions for the bitmask system.</summary>
    public DbSet<PermissionFunction> PermissionFunctions => Set<PermissionFunction>();

    /// <summary>Junction between roles and their granted permissions.</summary>
    public DbSet<RolePermission> RolePermissions => Set<RolePermission>();

    /// <summary>Staff members assigned to a tenant.</summary>
    public DbSet<TenantStaff> TenantStaffMembers => Set<TenantStaff>();

    /// <summary>JWT refresh tokens for session management.</summary>
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();

    /// <summary>Room type definitions (e.g., Standard, Deluxe, Suite).</summary>
    public DbSet<RoomType> RoomTypes => Set<RoomType>();

    /// <summary>Physical rooms within a property.</summary>
    public DbSet<Room> Rooms => Set<Room>();

    /// <summary>Guest reservations and bookings.</summary>
    public DbSet<Reservation> Reservations => Set<Reservation>();

    /// <inheritdoc />
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Apply all IEntityTypeConfiguration<T> implementations from this assembly.
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(ApplicationDbContext).Assembly);

        // Apply tenant-scoped global query filters to all ITenantScopedEntity types.
        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
        {
            if (!typeof(ITenantScopedEntity).IsAssignableFrom(entityType.ClrType))
                continue;

            var method = typeof(ApplicationDbContext)
                .GetMethod(nameof(ApplyTenantQueryFilter),
                    System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance)!
                .MakeGenericMethod(entityType.ClrType);

            method.Invoke(this, [modelBuilder]);
        }
    }

    /// <summary>
    /// Applies a global query filter for tenant isolation on the specified entity type.
    /// When <see cref="ICurrentTenantService.TenantId"/> is null, no filtering is applied
    /// (used for system-level operations).
    /// </summary>
    private void ApplyTenantQueryFilter<TEntity>(ModelBuilder modelBuilder)
        where TEntity : class, ITenantScopedEntity
    {
        modelBuilder.Entity<TEntity>()
            .HasQueryFilter(e =>
                _currentTenantService.TenantId == null ||
                e.TenantId == _currentTenantService.TenantId);
    }

    /// <inheritdoc />
    public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        var utcNow = DateTime.UtcNow;

        foreach (var entry in ChangeTracker.Entries<BaseEntity>())
        {
            switch (entry.State)
            {
                case EntityState.Added:
                    entry.Entity.CreatedAtUtc = utcNow;
                    entry.Entity.UpdatedAtUtc = utcNow;
                    break;

                case EntityState.Modified:
                    entry.Entity.UpdatedAtUtc = utcNow;
                    break;
            }
        }

        return await base.SaveChangesAsync(cancellationToken);
    }
}
