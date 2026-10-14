using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Domain.Common;
using HotelSaas.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Infrastructure.Persistence;

/// <summary>
/// Primary database context for the Hotel SaaS platform.
/// Applies tenant-scoped global query filters and automatic audit timestamps.
/// </summary>
public sealed class ApplicationDbContext : DbContext, IApplicationDbContext
{
    private readonly ICurrentTenantService _currentTenantService;
    private readonly ICurrentPropertyService _currentPropertyService;

    /// <summary>
    /// Initializes a new instance of <see cref="ApplicationDbContext"/>.
    /// </summary>
    /// <param name="options">EF Core options configured with Npgsql provider.</param>
    /// <param name="currentTenantService">Scoped service providing the current tenant identifier.</param>
    /// <param name="currentPropertyService">Optional scoped service providing property scoping.</param>
    public ApplicationDbContext(
        DbContextOptions<ApplicationDbContext> options,
        ICurrentTenantService currentTenantService,
        ICurrentPropertyService? currentPropertyService = null)
        : base(options)
    {
        _currentTenantService = currentTenantService;
        _currentPropertyService = currentPropertyService ?? new NullCurrentPropertyService();
    }

    /// <summary>Hotel/property tenants.</summary>
    public DbSet<Tenant> Tenants => Set<Tenant>();

    /// <summary>Physical branches/properties belonging to tenants.</summary>
    public DbSet<Property> Properties => Set<Property>();

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

    /// <summary>Branch-specific early check-in and late check-out surcharge policies.</summary>
    public DbSet<PropertySurchargePolicy> PropertySurchargePolicies => Set<PropertySurchargePolicy>();

    /// <summary>Versioned room type pricing schedules.</summary>
    public DbSet<RoomTypeRate> RoomTypeRates => Set<RoomTypeRate>();

    /// <summary>Audit trail for room type rate modifications and interval splittings.</summary>
    public DbSet<RoomTypeRateAudit> RoomTypeRateAudits => Set<RoomTypeRateAudit>();

    /// <summary>Physical rooms within a property.</summary>
    public DbSet<Room> Rooms => Set<Room>();

    /// <summary>Guest reservations and bookings.</summary>
    public DbSet<Reservation> Reservations => Set<Reservation>();

    /// <summary>Payment records for reservations and services.</summary>
    public DbSet<Payment> Payments => Set<Payment>();

    /// <summary>Tenant subscription plans.</summary>
    public DbSet<Subscription> Subscriptions => Set<Subscription>();

    /// <summary>Payments linked to subscriptions.</summary>
    public DbSet<SubscriptionPayment> SubscriptionPayments => Set<SubscriptionPayment>();

    /// <summary>Invoice documents issued to guests or tenants.</summary>
    public DbSet<Invoice> Invoices => Set<Invoice>();

    /// <summary>Individual line items within an invoice.</summary>
    public DbSet<InvoiceItem> InvoiceItems => Set<InvoiceItem>();

    /// <summary>Thẻ thành viên tích điểm chuỗi/cơ sở của khách hàng.</summary>
    public DbSet<GuestLoyaltyMembership> GuestLoyaltyMemberships => Set<GuestLoyaltyMembership>();

    /// <summary>Sổ cái giao dịch điểm thưởng bất biến.</summary>
    public DbSet<LoyaltyPointTransaction> LoyaltyPointTransactions => Set<LoyaltyPointTransaction>();


    /// <summary>System and user notifications.</summary>
    public DbSet<Notification> Notifications => Set<Notification>();

    /// <summary>Promotional offers and discount codes.</summary>
    public DbSet<Promotion> Promotions => Set<Promotion>();

    /// <summary>Guest reviews and ratings for properties.</summary>
    public DbSet<GuestReview> GuestReviews => Set<GuestReview>();

    /// <summary>AI feature usage tracking logs.</summary>
    public DbSet<AiUsageLog> AiUsageLogs => Set<AiUsageLog>();

    /// <summary>Cấu hình gói dịch vụ hệ thống.</summary>
    public DbSet<SubscriptionPlan> SubscriptionPlans => Set<SubscriptionPlan>();

    /// <summary>Banner thông báo và quảng cáo hệ thống.</summary>
    public DbSet<SystemBanner> SystemBanners => Set<SystemBanner>();

    /// <inheritdoc />
    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
    {
        base.OnConfiguring(optionsBuilder);
        optionsBuilder.ConfigureWarnings(w =>
            w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.PendingModelChangesWarning));
    }

    /// <inheritdoc />
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Apply all IEntityTypeConfiguration<T> implementations from this assembly.
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(ApplicationDbContext).Assembly);

        // Apply tenant- and property-scoped global query filters to entities.
        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
        {
            if (typeof(IPropertyScopedEntity).IsAssignableFrom(entityType.ClrType))
            {
                var method = typeof(ApplicationDbContext)
                    .GetMethod(nameof(ApplyPropertyQueryFilter),
                        System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance)!
                    .MakeGenericMethod(entityType.ClrType);

                method.Invoke(this, [modelBuilder]);
            }
            else if (typeof(ITenantScopedEntity).IsAssignableFrom(entityType.ClrType))
            {
                var method = typeof(ApplicationDbContext)
                    .GetMethod(nameof(ApplyTenantQueryFilter),
                        System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance)!
                    .MakeGenericMethod(entityType.ClrType);

                method.Invoke(this, [modelBuilder]);
            }
        }
    }

    /// <summary>
    /// Applies a global query filter for tenant isolation on the specified entity type.
    /// Fail-closed: when TenantId is null, filter evaluates to false (returns 0 rows).
    /// </summary>
    private void ApplyTenantQueryFilter<TEntity>(ModelBuilder modelBuilder)
        where TEntity : class, ITenantScopedEntity
    {
        modelBuilder.Entity<TEntity>()
            .HasQueryFilter(e =>
                _currentTenantService.TenantId != null &&
                e.TenantId == _currentTenantService.TenantId);
    }

    /// <summary>
    /// Applies a global query filter for property-scoped isolation on the specified entity type.
    /// Enforces tenant isolation, working property pinning for staff, and inactive property exclusion for owners.
    /// </summary>
    private void ApplyPropertyQueryFilter<TEntity>(ModelBuilder modelBuilder)
        where TEntity : class, IPropertyScopedEntity
    {
        modelBuilder.Entity<TEntity>()
            .HasQueryFilter(e =>
                _currentTenantService.TenantId != null &&
                e.TenantId == _currentTenantService.TenantId &&
                (
                    (_currentPropertyService.PropertyId != null && e.PropertyId == _currentPropertyService.PropertyId) ||
                    (_currentPropertyService.IsTenantWide && _currentPropertyService.PropertyId == null && !_currentPropertyService.ExcludedPropertyIds.Contains(e.PropertyId))
                ));
    }

    private sealed class NullCurrentPropertyService : ICurrentPropertyService
    {
        public Guid? PropertyId { get; set; }
        public bool IsTenantWide { get; set; } = true;
        public IReadOnlyList<Guid> ExcludedPropertyIds { get; set; } = Array.Empty<Guid>();
        public Guid? HeaderPropertyId { get; set; }
        public Guid? TokenPropertyId { get; set; }
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
                    if (entry.Entity.CreatedAtUtc == default)
                    {
                        entry.Entity.CreatedAtUtc = utcNow;
                    }
                    entry.Entity.UpdatedAtUtc = utcNow;
                    break;

                case EntityState.Modified:
                    entry.Entity.UpdatedAtUtc = utcNow;
                    break;
            }
        }

        try
        {
            return await base.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException ex)
        {
            if (TryGetPostgresUniqueViolation(ex, out var constraintName))
            {
                if (string.Equals(constraintName, "UX_Room_PropertyId_RoomNumber", StringComparison.OrdinalIgnoreCase))
                {
                    throw new ConflictException("ERR_CONFLICT", "Số phòng đã tồn tại trong chi nhánh này.");
                }

                if (string.Equals(constraintName, "UX_RoomType_PropertyId_Code", StringComparison.OrdinalIgnoreCase))
                {
                    throw new ConflictException("ERR_CONFLICT", "Mã loại phòng đã tồn tại trong chi nhánh này.");
                }
            }

            if (TryGetPostgresExclusionViolation(ex, out var exclusionConstraint))
            {
                if (string.Equals(exclusionConstraint, "EXCLUDE_RoomTypeRates_NoOverlap", StringComparison.OrdinalIgnoreCase) ||
                    exclusionConstraint?.Contains("RoomTypeRates", StringComparison.OrdinalIgnoreCase) == true)
                {
                    throw new ConflictException("ERR_RATE_OVERLAP", "Khoảng ngày hiệu lực bị chồng lấn với bảng giá hiện có của loại phòng này.");
                }
            }

            throw;
        }
    }

    private static bool TryGetPostgresUniqueViolation(DbUpdateException ex, out string? constraintName)
    {
        var current = ex.InnerException;
        while (current != null)
        {
            if (current is Npgsql.PostgresException pgEx && pgEx.SqlState == "23505")
            {
                constraintName = pgEx.ConstraintName;
                return true;
            }
            current = current.InnerException;
        }

        constraintName = null;
        return false;
    }

    private static bool TryGetPostgresExclusionViolation(DbUpdateException ex, out string? constraintName)
    {
        var current = ex.InnerException;
        while (current != null)
        {
            if (current is Npgsql.PostgresException pgEx && pgEx.SqlState == "23P01")
            {
                constraintName = pgEx.ConstraintName;
                return true;
            }
            current = current.InnerException;
        }

        constraintName = null;
        return false;
    }

    /// <inheritdoc />
    public Task<Microsoft.EntityFrameworkCore.Storage.IDbContextTransaction> BeginTransactionAsync(CancellationToken cancellationToken = default)
        => Database.BeginTransactionAsync(cancellationToken);

    /// <inheritdoc />
    public Task LockUserRowAsync(Guid userId, CancellationToken cancellationToken = default)
        => Database.ExecuteSqlInterpolatedAsync($"SELECT \"Id\" FROM \"Users\" WHERE \"Id\" = {userId} FOR UPDATE;", cancellationToken);

    /// <inheritdoc />
    public Task LockRoomTypeRowAsync(Guid roomTypeId, Guid tenantId, Guid propertyId, CancellationToken cancellationToken = default)
        => Database.ExecuteSqlInterpolatedAsync(
            $"SELECT \"Id\" FROM \"RoomTypes\" WHERE \"Id\" = {roomTypeId} AND \"TenantId\" = {tenantId} AND \"PropertyId\" = {propertyId} FOR UPDATE;",
            cancellationToken);

    /// <inheritdoc />
    public Task LockRoomRowAsync(Guid roomId, Guid tenantId, Guid propertyId, CancellationToken cancellationToken = default)
        => Database.ExecuteSqlInterpolatedAsync(
            $"SELECT \"Id\" FROM \"Rooms\" WHERE \"Id\" = {roomId} AND \"TenantId\" = {tenantId} AND \"PropertyId\" = {propertyId} FOR UPDATE;",
            cancellationToken);

    /// <inheritdoc />
    public Task LockReservationRowAsync(Guid reservationId, Guid tenantId, Guid propertyId, CancellationToken cancellationToken = default)
        => Database.ExecuteSqlInterpolatedAsync(
            $"SELECT \"Id\" FROM \"Reservations\" WHERE \"Id\" = {reservationId} AND \"TenantId\" = {tenantId} AND \"PropertyId\" = {propertyId} FOR UPDATE;",
            cancellationToken);

    /// <inheritdoc />
    public Task LockIdempotencyKeyAsync(Guid propertyId, string idempotencyKey, CancellationToken cancellationToken = default)
    {
        var lockKey = $"idemp_{propertyId:N}_{idempotencyKey.Trim()}";
        return Database.ExecuteSqlInterpolatedAsync(
            $"SELECT pg_advisory_xact_lock(hashtext({lockKey}));",
            cancellationToken);
    }

    /// <inheritdoc />
    public Task<int> UpdateRoomStatusAtomicAsync(
        Guid roomId,
        Guid tenantId,
        Guid propertyId,
        HotelSaas.Domain.Enums.RoomStatus expectedOldStatus,
        HotelSaas.Domain.Enums.RoomStatus newStatus,
        DateTime updatedAtUtc,
        CancellationToken cancellationToken = default)
    {
        return Database.ExecuteSqlInterpolatedAsync(
            $@"UPDATE ""Rooms""
               SET ""Status"" = {(int)newStatus},
                   ""UpdatedAtUtc"" = {updatedAtUtc}
               WHERE ""Id"" = {roomId}
                 AND ""TenantId"" = {tenantId}
                 AND ""PropertyId"" = {propertyId}
                 AND ""Status"" = {(int)expectedOldStatus};",
            cancellationToken);
    }
}
