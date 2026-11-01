using System;
using System.Collections.Generic;
using System.Data;
using System.Linq;
using System.Net;
using System.Runtime.CompilerServices;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Domain.Common;
using HotelSaas.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.EntityFrameworkCore.Storage;

namespace HotelSaas.Infrastructure.Persistence.Interceptors;

/// <summary>
/// Options controlling which entity types and scalar properties are audited by <see cref="AuditSaveChangesInterceptor"/>.
/// </summary>
public sealed class AuditInterceptorOptions
{
    private readonly Dictionary<Type, (string EntityName, HashSet<string> AllowedProperties)> _auditedEntities = new();

    /// <summary>
    /// Creates the default production configuration auditing <see cref="RoomTypeRate"/>,
    /// <see cref="PropertySurchargePolicy"/>, and <see cref="Invoice"/>.
    /// </summary>
    public static AuditInterceptorOptions CreateDefault()
    {
        var options = new AuditInterceptorOptions();

        options.RegisterEntity<RoomTypeRate>(
            nameof(RoomTypeRate),
            nameof(RoomTypeRate.RoomTypeId),
            nameof(RoomTypeRate.FirstHours),
            nameof(RoomTypeRate.FirstHoursPrice),
            nameof(RoomTypeRate.AdditionalHourPrice),
            nameof(RoomTypeRate.NightlyPrice),
            nameof(RoomTypeRate.Currency),
            nameof(RoomTypeRate.EffectiveFrom),
            nameof(RoomTypeRate.EffectiveTo),
            nameof(RoomTypeRate.CreatedByUserId),
            nameof(RoomTypeRate.ChangeReason),
            nameof(RoomTypeRate.IsActive));

        options.RegisterEntity<PropertySurchargePolicy>(
            nameof(PropertySurchargePolicy),
            nameof(PropertySurchargePolicy.SurchargeType),
            nameof(PropertySurchargePolicy.FromTime),
            nameof(PropertySurchargePolicy.ToTime),
            nameof(PropertySurchargePolicy.CalculationMethod),
            nameof(PropertySurchargePolicy.Percentage),
            nameof(PropertySurchargePolicy.FlatAmount),
            nameof(PropertySurchargePolicy.IsActive));

        // Note: GuestIdNumber (CCCD/Passport) is intentionally excluded per PII/Sensitive Data Policy (Section 9).
        options.RegisterEntity<Invoice>(
            nameof(Invoice),
            nameof(Invoice.ReservationId),
            nameof(Invoice.InvoiceNumber),
            nameof(Invoice.IssuedAtUtc),
            nameof(Invoice.GuestName),
            nameof(Invoice.GuestPhone),
            nameof(Invoice.GuestEmail),
            nameof(Invoice.PropertyName),
            nameof(Invoice.PropertyAddress),
            nameof(Invoice.PropertyPhone),
            nameof(Invoice.PropertyTaxCode),
            nameof(Invoice.Subtotal),
            nameof(Invoice.TaxRate),
            nameof(Invoice.TaxAmount),
            nameof(Invoice.ServiceFeeRate),
            nameof(Invoice.ServiceFeeAmount),
            nameof(Invoice.DiscountAmount),
            nameof(Invoice.GrandTotal),
            nameof(Invoice.PaidAmount),
            nameof(Invoice.Balance),
            nameof(Invoice.Notes),
            nameof(Invoice.Status),
            nameof(Invoice.PointsRedeemed),
            nameof(Invoice.PointsDiscountAmount),
            nameof(Invoice.PointsEarned),
            nameof(Invoice.PointsRefunded),
            nameof(Invoice.BuyerCompanyName),
            nameof(Invoice.BuyerTaxCode),
            nameof(Invoice.BuyerAddress),
            nameof(Invoice.BuyerEmail));

        return options;
    }

    /// <summary>
    /// Registers an entity type and its explicit scalar property allowlist for audit logging.
    /// </summary>
    public AuditInterceptorOptions RegisterEntity<TEntity>(string entityName, params string[] allowedScalarProperties)
        where TEntity : class
    {
        if (typeof(TEntity) == typeof(AuditLog))
        {
            throw new InvalidOperationException("AuditLog cannot be registered as an audited entity.");
        }

        _auditedEntities[typeof(TEntity)] = (
            entityName,
            new HashSet<string>(allowedScalarProperties, StringComparer.OrdinalIgnoreCase));

        return this;
    }

    internal bool TryGetEntityConfig(Type entityType, out string entityName, out HashSet<string> allowedProperties)
    {
        if (_auditedEntities.TryGetValue(entityType, out var config))
        {
            entityName = config.EntityName;
            allowedProperties = config.AllowedProperties;
            return true;
        }

        entityName = string.Empty;
        allowedProperties = null!;
        return false;
    }
}

/// <summary>
/// EF Core SaveChanges interceptor that automatically records immutable <see cref="AuditLog"/> entries
/// within the same atomic database transaction as business mutations.
/// Enforces fail-closed multi-tenant/multi-property isolation, sensitive field redaction,
/// no-op update suppression, and retry deduplication.
/// </summary>
public sealed class AuditSaveChangesInterceptor : SaveChangesInterceptor
{
    private static readonly JsonSerializerOptions AuditJsonOptions = new()
    {
        WriteIndented = false
    };

    private static readonly HashSet<string> SensitivePropertyNames = new(StringComparer.OrdinalIgnoreCase)
    {
        "Password",
        "PasswordHash",
        "Jwt",
        "AccessToken",
        "RefreshToken",
        "Token",
        "TokenHash",
        "LookupToken",
        "IdToken",
        "ApiKey",
        "Secret",
        "SecretKey",
        "PrivateKey",
        "ClientSecret",
        "HashSecret",
        "Otp",
        "SmartLockPin",
        "Pin",
        "PinCode",
        "Passcode",
        "CardNumber",
        "CreditCard",
        "Cvv",
        "Cvc",
        "CardExpiry",
        "Cookie",
        "Authorization",
        "ConnectionString",
        "GuestIdNumber",
        "IdNumber",
        "IdentityNumber",
        "Passport",
        "PassportNumber",
        "Cccd",
        "NationalId",
        "CitizenId",
        "DigitalSignatureHash"
    };

    private static readonly Regex SensitivePropertyTokenRegex = new(
        @"(password|passwd|secret|privatekey|apikey|accesstoken|refreshtoken|lookuptoken|smartlockpin|passcode|cardnumber|cvv|cvc|cookie|authorization|connectionstring|guestidnumber|passport|cccd)",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static readonly Regex SensitiveValuePatternRegex = new(
        @"(Bearer\s+[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+|\beyJ[A-Za-z0-9\-_]{10,}\.[A-Za-z0-9\-_]{10,}\.[A-Za-z0-9\-_]{10,}\b|(?i)(password|pwd|secret|apikey|token)\s*=\s*[^;\s]+)",
        RegexOptions.Compiled);

    private readonly ICurrentTenantService _currentTenantService;
    private readonly ICurrentPropertyService _currentPropertyService;
    private readonly ICurrentUserContext? _currentUserContext;
    private readonly AuditInterceptorOptions _options;

    // Tracks staged AuditLog instances per DbContext during an active SaveChanges invocation
    // so failed saves or retries on the same DbContext never leave duplicate or orphaned AuditLogs.
    private readonly ConditionalWeakTable<DbContext, List<AuditLog>> _pendingAuditLogs = new();

    public AuditSaveChangesInterceptor(
        ICurrentTenantService currentTenantService,
        ICurrentPropertyService currentPropertyService,
        ICurrentUserContext? currentUserContext = null,
        AuditInterceptorOptions? options = null)
    {
        _currentTenantService = currentTenantService ?? throw new ArgumentNullException(nameof(currentTenantService));
        _currentPropertyService = currentPropertyService ?? throw new ArgumentNullException(nameof(currentPropertyService));
        _currentUserContext = currentUserContext;
        _options = options ?? AuditInterceptorOptions.CreateDefault();
    }

    /// <inheritdoc />
    public override InterceptionResult<int> SavingChanges(
        DbContextEventData eventData,
        InterceptionResult<int> result)
    {
        if (eventData.Context != null)
        {
            StageAuditLogsAsync(eventData.Context, CancellationToken.None).GetAwaiter().GetResult();
        }

        return base.SavingChanges(eventData, result);
    }

    /// <inheritdoc />
    public override async ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData eventData,
        InterceptionResult<int> result,
        CancellationToken cancellationToken = default)
    {
        if (eventData.Context != null)
        {
            await StageAuditLogsAsync(eventData.Context, cancellationToken);
        }

        return await base.SavingChangesAsync(eventData, result, cancellationToken);
    }

    /// <inheritdoc />
    public override int SavedChanges(SaveChangesCompletedEventData eventData, int result)
    {
        if (eventData.Context != null)
        {
            ClearPendingAuditLogs(eventData.Context);
        }

        return base.SavedChanges(eventData, result);
    }

    /// <inheritdoc />
    public override ValueTask<int> SavedChangesAsync(
        SaveChangesCompletedEventData eventData,
        int result,
        CancellationToken cancellationToken = default)
    {
        if (eventData.Context != null)
        {
            ClearPendingAuditLogs(eventData.Context);
        }

        return base.SavedChangesAsync(eventData, result, cancellationToken);
    }

    /// <inheritdoc />
    public override void SaveChangesFailed(DbContextErrorEventData eventData)
    {
        if (eventData.Context != null)
        {
            DetachPendingAuditLogs(eventData.Context);
        }

        base.SaveChangesFailed(eventData);
    }

    /// <inheritdoc />
    public override Task SaveChangesFailedAsync(
        DbContextErrorEventData eventData,
        CancellationToken cancellationToken = default)
    {
        if (eventData.Context != null)
        {
            DetachPendingAuditLogs(eventData.Context);
        }

        return base.SaveChangesFailedAsync(eventData, cancellationToken);
    }

    private async Task StageAuditLogsAsync(DbContext context, CancellationToken cancellationToken)
    {
        // 1. If a previous SaveChanges attempt on this same DbContext failed or was aborted before SavedChanges,
        // detach any previously staged AuditLog instances to prevent duplicate logs on retry.
        DetachPendingAuditLogs(context);

        var entries = context.ChangeTracker.Entries().ToList();
        if (entries.Count == 0)
        {
            return;
        }

        // 2. Enforce immutability of existing AuditLog records and skip AuditLog from self-auditing.
        foreach (var entry in entries)
        {
            if (entry.Entity is AuditLog)
            {
                if (entry.State == EntityState.Modified || entry.State == EntityState.Deleted)
                {
                    throw new ForbiddenException(
                        "ERR_AUDIT_LOG_IMMUTABLE",
                        "Không được phép chỉnh sửa hoặc xóa bản ghi nhật ký kiểm toán (AuditLog).");
                }
            }
        }

        var utcNow = DateTime.UtcNow;
        var resolvedUserId = ResolveUserId();
        var resolvedIpAddress = ResolveTrustedIpAddress();
        var stagedLogs = new List<AuditLog>();

        foreach (var entry in entries)
        {
            // Never audit AuditLog itself (recursion guard)
            if (entry.Entity is AuditLog)
            {
                continue;
            }

            if (entry.State != EntityState.Added &&
                entry.State != EntityState.Modified &&
                entry.State != EntityState.Deleted)
            {
                continue;
            }

            var entityType = entry.Metadata.ClrType;
            if (!_options.TryGetEntityConfig(entityType, out var entityName, out var allowedProperties))
            {
                continue;
            }

            // 3. Enforce fail-closed Tenant and Property scope validation on the audited entity
            var (verifiedTenantId, verifiedPropertyId) = await ValidateAndResolveScopeAsync(context, entry, cancellationToken);

            // 4. Resolve EntityId (ensure non-empty Guid on Added entities)
            var entityId = ResolveEntityId(entry);

            // 5. Build OldValues and NewValues according to action type
            string action;
            string? oldValuesJson = null;
            string? newValuesJson = null;

            switch (entry.State)
            {
                case EntityState.Added:
                {
                    action = AuditActions.Create;
                    var newValues = ExtractScalarValues(entry, allowedProperties, useOriginalValues: false);
                    newValuesJson = JsonSerializer.Serialize(newValues, AuditJsonOptions);
                    break;
                }

                case EntityState.Modified:
                {
                    action = AuditActions.Update;
                    var (oldDiff, newDiff) = ExtractModifiedScalarDiff(entry, allowedProperties);

                    // Suppress no-op Update logs when no substantive business property changed
                    if (oldDiff.Count == 0 && newDiff.Count == 0)
                    {
                        continue;
                    }

                    oldValuesJson = JsonSerializer.Serialize(oldDiff, AuditJsonOptions);
                    newValuesJson = JsonSerializer.Serialize(newDiff, AuditJsonOptions);
                    break;
                }

                case EntityState.Deleted:
                {
                    action = AuditActions.Delete;
                    var oldValues = ExtractScalarValues(entry, allowedProperties, useOriginalValues: true);
                    oldValuesJson = JsonSerializer.Serialize(oldValues, AuditJsonOptions);
                    break;
                }

                default:
                    continue;
            }

            var auditLog = new AuditLog
            {
                Id = Guid.NewGuid(),
                TenantId = verifiedTenantId,
                PropertyId = verifiedPropertyId,
                UserId = resolvedUserId,
                Action = action,
                EntityName = entityName,
                EntityId = entityId,
                OldValues = oldValuesJson,
                NewValues = newValuesJson,
                IpAddress = resolvedIpAddress,
                CreatedAtUtc = utcNow
            };

            stagedLogs.Add(auditLog);
        }

        if (stagedLogs.Count > 0)
        {
            var trackedList = _pendingAuditLogs.GetOrCreateValue(context);
            trackedList.AddRange(stagedLogs);
            context.Set<AuditLog>().AddRange(stagedLogs);
        }
    }

    private async Task<(Guid TenantId, Guid? PropertyId)> ValidateAndResolveScopeAsync(
        DbContext context,
        EntityEntry entry,
        CancellationToken cancellationToken)
    {
        var currentTenantId = _currentTenantService.TenantId;
        if (!currentTenantId.HasValue || currentTenantId.Value == Guid.Empty)
        {
            throw new ForbiddenException("ERR_TENANT_REQUIRED", "Không thể ghi dữ liệu khi thiếu Tenant context.");
        }

        if (entry.Entity is not ITenantScopedEntity tenantEntity)
        {
            throw new ForbiddenException("ERR_TENANT_REQUIRED", "Thực thể được kiểm toán bắt buộc phải thuộc phạm vi Tenant.");
        }

        var currentPropertyId = _currentPropertyService.PropertyId;
        var isTenantWide = _currentPropertyService.IsTenantWide;
        var excludedProperties = _currentPropertyService.ExcludedPropertyIds ?? Array.Empty<Guid>();

        if (entry.State == EntityState.Added)
        {
            if (tenantEntity.TenantId == Guid.Empty)
            {
                tenantEntity.TenantId = currentTenantId.Value;
            }
            else if (tenantEntity.TenantId != currentTenantId.Value)
            {
                throw new ForbiddenException("ERR_CROSS_TENANT_MUTATION", "Không được phép tạo entity thuộc Tenant khác.");
            }
        }
        else if (entry.State == EntityState.Modified || entry.State == EntityState.Deleted)
        {
            var tenantProp = entry.Property(nameof(ITenantScopedEntity.TenantId));
            if (tenantProp.IsModified && !Equals(tenantProp.CurrentValue, tenantProp.OriginalValue))
            {
                throw new ForbiddenException("ERR_IMMUTABLE_SCOPE_FIELDS", "Không được phép thay đổi TenantId của bản ghi.");
            }

            if (entry.Entity is BaseEntity baseEntity && baseEntity.Id != Guid.Empty && context.Database.IsRelational())
            {
                await VerifyPersistedScopeAsync(
                    context,
                    entry,
                    baseEntity.Id,
                    currentTenantId.Value,
                    currentPropertyId,
                    isTenantWide,
                    excludedProperties,
                    cancellationToken);
            }

            var originalTenantId = tenantProp.OriginalValue is Guid origTid ? origTid : tenantEntity.TenantId;
            if (tenantEntity.TenantId != currentTenantId.Value || originalTenantId != currentTenantId.Value)
            {
                throw new ForbiddenException("ERR_CROSS_TENANT_MUTATION", "Không được phép sửa/xóa thực thể thuộc Tenant khác.");
            }
        }

        if (entry.Entity is IPropertyScopedEntity propertyEntity)
        {
            if (entry.State == EntityState.Added)
            {
                if (_currentPropertyService.HeaderPropertyId.HasValue &&
                    propertyEntity.PropertyId != Guid.Empty &&
                    propertyEntity.PropertyId != _currentPropertyService.HeaderPropertyId.Value)
                {
                    throw new BadRequestException(
                        "ERR_CONTEXT_MISMATCH",
                        "Chi nhánh của dữ liệu không khớp với chi nhánh trong header X-Property-Id.");
                }

                if (isTenantWide)
                {
                    if (propertyEntity.PropertyId == Guid.Empty)
                    {
                        if (currentPropertyId.HasValue && currentPropertyId.Value != Guid.Empty)
                        {
                            propertyEntity.PropertyId = currentPropertyId.Value;
                        }
                        else
                        {
                            throw new ConflictException("ERR_PROPERTY_REQUIRED", "Bắt buộc chỉ định PropertyId cho thực thể chi nhánh.");
                        }
                    }

                    if (excludedProperties.Contains(propertyEntity.PropertyId))
                    {
                        throw new ForbiddenException("ERR_MEMBERSHIP_REVOKED", "Quyền nhân sự tại chi nhánh này đã bị đình chỉ.");
                    }
                }
                else
                {
                    if (!currentPropertyId.HasValue || currentPropertyId.Value == Guid.Empty)
                    {
                        throw new ConflictException("ERR_PROPERTY_REQUIRED", "Không thể tạo tài nguyên khi chưa chọn chi nhánh.");
                    }

                    if (propertyEntity.PropertyId == Guid.Empty)
                    {
                        propertyEntity.PropertyId = currentPropertyId.Value;
                    }
                    else if (propertyEntity.PropertyId != currentPropertyId.Value)
                    {
                        throw new ForbiddenException("ERR_CROSS_PROPERTY_MUTATION", "Không được phép tạo dữ liệu cho chi nhánh khác.");
                    }
                }
            }
            else if (entry.State == EntityState.Modified || entry.State == EntityState.Deleted)
            {
                if (_currentPropertyService.HeaderPropertyId.HasValue &&
                    propertyEntity.PropertyId != _currentPropertyService.HeaderPropertyId.Value)
                {
                    throw new BadRequestException(
                        "ERR_CONTEXT_MISMATCH",
                        "Chi nhánh của dữ liệu không khớp với chi nhánh trong header X-Property-Id.");
                }

                if (excludedProperties.Contains(propertyEntity.PropertyId))
                {
                    throw new ForbiddenException("ERR_MEMBERSHIP_REVOKED", "Quyền nhân sự tại chi nhánh này đã bị đình chỉ.");
                }

                var propProperty = entry.Property(nameof(IPropertyScopedEntity.PropertyId));
                if (propProperty.IsModified && !Equals(propProperty.CurrentValue, propProperty.OriginalValue))
                {
                    throw new ForbiddenException("ERR_IMMUTABLE_SCOPE_FIELDS", "Không được phép thay đổi PropertyId của bản ghi.");
                }

                var origPropertyId = propProperty.OriginalValue is Guid origPid ? origPid : propertyEntity.PropertyId;
                if (!isTenantWide && (!currentPropertyId.HasValue || propertyEntity.PropertyId != currentPropertyId.Value || origPropertyId != currentPropertyId.Value))
                {
                    throw new ForbiddenException("ERR_CROSS_PROPERTY_MUTATION", "Không được phép sửa/xóa thực thể thuộc chi nhánh khác.");
                }
            }

            return (currentTenantId.Value, propertyEntity.PropertyId);
        }

        // Tenant-scoped entity without IPropertyScopedEntity (e.g., Invoice):
        // Never assign an arbitrary or mismatched PropertyId from ambient context if the entity does not bind to a property.
        // For Invoice, deterministically resolve PropertyId from its associated Reservation (in memory or DB).
        if (entry.Entity is Invoice invoice)
        {
            var invoicePropertyId = await ResolveInvoicePropertyScopeAsync(
                context,
                entry,
                invoice,
                currentTenantId.Value,
                currentPropertyId,
                isTenantWide,
                excludedProperties,
                cancellationToken);

            return (currentTenantId.Value, invoicePropertyId);
        }

        return (currentTenantId.Value, null);
    }

    private async Task<Guid?> ResolveInvoicePropertyScopeAsync(
        DbContext context,
        EntityEntry entry,
        Invoice invoice,
        Guid currentTenantId,
        Guid? currentPropertyId,
        bool isTenantWide,
        IReadOnlyList<Guid> excludedProperties,
        CancellationToken cancellationToken)
    {
        var reservationId = invoice.ReservationId;
        if (entry.State == EntityState.Deleted || reservationId == Guid.Empty)
        {
            var resIdProp = entry.Property(nameof(Invoice.ReservationId));
            if (resIdProp.OriginalValue is Guid origResId && origResId != Guid.Empty)
            {
                reservationId = origResId;
            }
        }

        Guid? resTenantId = null;
        Guid? resPropertyId = null;

        // 1. Check navigation property or ChangeTracker first
        if (invoice.Reservation != null && invoice.Reservation.Id == reservationId)
        {
            resTenantId = invoice.Reservation.TenantId;
            resPropertyId = invoice.Reservation.PropertyId;
        }
        else if (reservationId != Guid.Empty)
        {
            var trackedReservation = context.ChangeTracker
                .Entries<Reservation>()
                .FirstOrDefault(e => e.Entity.Id == reservationId)?.Entity;

            if (trackedReservation != null)
            {
                resTenantId = trackedReservation.TenantId;
                resPropertyId = trackedReservation.PropertyId;
            }
        }

        // 2. Fall back to querying Reservations table in the current transaction when navigation is not loaded
        if ((!resTenantId.HasValue || !resPropertyId.HasValue || resPropertyId.Value == Guid.Empty) &&
            reservationId != Guid.Empty &&
            context.Database.IsRelational())
        {
            var connection = context.Database.GetDbConnection();
            if (connection.State != ConnectionState.Open)
            {
                await connection.OpenAsync(cancellationToken);
            }

            await using var command = connection.CreateCommand();
            command.Transaction = context.Database.CurrentTransaction?.GetDbTransaction();
            command.CommandText = "SELECT \"TenantId\", \"PropertyId\" FROM \"Reservations\" WHERE \"Id\" = @reservationId";

            var param = command.CreateParameter();
            param.ParameterName = "@reservationId";
            param.Value = reservationId;
            command.Parameters.Add(param);

            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            if (await reader.ReadAsync(cancellationToken))
            {
                resTenantId = reader.GetGuid(0);
                resPropertyId = reader.GetGuid(1);
            }
        }

        if (!resTenantId.HasValue || !resPropertyId.HasValue || resPropertyId.Value == Guid.Empty)
        {
            return null;
        }

        if (resTenantId.Value != currentTenantId)
        {
            throw new ForbiddenException(
                "ERR_CROSS_TENANT_MUTATION",
                "Không được phép thao tác hóa đơn liên kết với đơn đặt phòng thuộc Tenant khác.");
        }

        var resolvedPropertyId = resPropertyId.Value;

        if (_currentPropertyService.HeaderPropertyId.HasValue &&
            _currentPropertyService.HeaderPropertyId.Value != resolvedPropertyId)
        {
            throw new BadRequestException(
                "ERR_CONTEXT_MISMATCH",
                "Chi nhánh của hóa đơn không khớp với chi nhánh trong header X-Property-Id.");
        }

        if (excludedProperties.Contains(resolvedPropertyId))
        {
            throw new ForbiddenException(
                "ERR_MEMBERSHIP_REVOKED",
                "Quyền nhân sự tại chi nhánh của hóa đơn này đã bị đình chỉ.");
        }

        if (!isTenantWide && (!currentPropertyId.HasValue || currentPropertyId.Value != resolvedPropertyId))
        {
            throw new ForbiddenException(
                "ERR_CROSS_PROPERTY_MUTATION",
                "Không được phép thao tác hóa đơn thuộc chi nhánh khác.");
        }

        return resolvedPropertyId;
    }

    private static async Task VerifyPersistedScopeAsync(
        DbContext context,
        EntityEntry entry,
        Guid entityId,
        Guid currentTenantId,
        Guid? currentPropertyId,
        bool isTenantWide,
        IReadOnlyList<Guid> excludedProperties,
        CancellationToken cancellationToken)
    {
        var tableName = entry.Metadata.GetTableName();
        if (string.IsNullOrEmpty(tableName))
        {
            return;
        }

        var isPropertyScoped = entry.Entity is IPropertyScopedEntity;
        var connection = context.Database.GetDbConnection();
        if (connection.State != ConnectionState.Open)
        {
            await connection.OpenAsync(cancellationToken);
        }

        await using var command = connection.CreateCommand();
        command.Transaction = context.Database.CurrentTransaction?.GetDbTransaction();
        command.CommandText = isPropertyScoped
            ? $"SELECT \"TenantId\", \"PropertyId\" FROM \"{tableName}\" WHERE \"Id\" = @id"
            : $"SELECT \"TenantId\" FROM \"{tableName}\" WHERE \"Id\" = @id";

        var param = command.CreateParameter();
        param.ParameterName = "@id";
        param.Value = entityId;
        command.Parameters.Add(param);

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        if (await reader.ReadAsync(cancellationToken))
        {
            var dbTenantId = reader.GetGuid(0);
            var tenantProp = entry.Property(nameof(ITenantScopedEntity.TenantId));

            if (!Equals(tenantProp.CurrentValue, dbTenantId))
            {
                throw new ForbiddenException("ERR_IMMUTABLE_SCOPE_FIELDS", "Không được phép thay đổi TenantId của bản ghi.");
            }

            if (dbTenantId != currentTenantId)
            {
                throw new ForbiddenException("ERR_CROSS_TENANT_MUTATION", "Không được phép sửa/xóa thực thể thuộc Tenant khác.");
            }

            if (isPropertyScoped)
            {
                var dbPropertyId = reader.GetGuid(1);
                var propProperty = entry.Property(nameof(IPropertyScopedEntity.PropertyId));

                if (!Equals(propProperty.CurrentValue, dbPropertyId))
                {
                    throw new ForbiddenException("ERR_IMMUTABLE_SCOPE_FIELDS", "Không được phép thay đổi PropertyId của bản ghi.");
                }

                if (!isTenantWide)
                {
                    if (!currentPropertyId.HasValue || dbPropertyId != currentPropertyId.Value)
                    {
                        throw new ForbiddenException("ERR_CROSS_PROPERTY_MUTATION", "Không được phép sửa/xóa thực thể thuộc chi nhánh khác.");
                    }
                }
                else
                {
                    if (excludedProperties.Contains(dbPropertyId))
                    {
                        throw new ForbiddenException("ERR_MEMBERSHIP_REVOKED", "Quyền nhân sự của bạn tại chi nhánh đích của bản ghi này đã bị thu hồi.");
                    }
                }

                propProperty.OriginalValue = dbPropertyId;
            }

            tenantProp.OriginalValue = dbTenantId;
        }
    }

    private static Guid ResolveEntityId(EntityEntry entry)
    {
        if (entry.Entity is BaseEntity baseEntity)
        {
            if (entry.State == EntityState.Added && baseEntity.Id == Guid.Empty)
            {
                baseEntity.Id = Guid.NewGuid();
            }

            return baseEntity.Id;
        }

        var idProp = entry.Properties.FirstOrDefault(p => p.Metadata.IsPrimaryKey());
        if (idProp != null)
        {
            var rawVal = entry.State == EntityState.Deleted ? idProp.OriginalValue : idProp.CurrentValue;
            if (rawVal is Guid guidId && guidId != Guid.Empty)
            {
                return guidId;
            }
        }

        return Guid.Empty;
    }

    private Guid? ResolveUserId()
    {
        if (_currentUserContext != null && _currentUserContext.UserId != Guid.Empty)
        {
            return _currentUserContext.UserId;
        }

        return null;
    }

    private string? ResolveTrustedIpAddress()
    {
        var rawIp = _currentUserContext?.IpAddress;
        if (string.IsNullOrWhiteSpace(rawIp))
        {
            return null;
        }

        var trimmed = rawIp.Trim();
        if (IPAddress.TryParse(trimmed, out var parsed))
        {
            var normalized = parsed.ToString();
            return normalized.Length <= 64 ? normalized : normalized[..64];
        }

        return null;
    }

    private static Dictionary<string, object?> ExtractScalarValues(
        EntityEntry entry,
        HashSet<string> allowedProperties,
        bool useOriginalValues)
    {
        var result = new Dictionary<string, object?>(StringComparer.Ordinal);

        foreach (var prop in entry.Properties)
        {
            var propName = prop.Metadata.Name;
            if (!allowedProperties.Contains(propName) || IsSensitivePropertyName(propName))
            {
                continue;
            }

            var rawValue = useOriginalValues ? prop.OriginalValue : prop.CurrentValue;
            result[propName] = NormalizeAndSanitizeScalarValue(rawValue);
        }

        return result;
    }

    private static (Dictionary<string, object?> OldDiff, Dictionary<string, object?> NewDiff) ExtractModifiedScalarDiff(
        EntityEntry entry,
        HashSet<string> allowedProperties)
    {
        var oldDiff = new Dictionary<string, object?>(StringComparer.Ordinal);
        var newDiff = new Dictionary<string, object?>(StringComparer.Ordinal);

        foreach (var prop in entry.Properties)
        {
            var propName = prop.Metadata.Name;
            if (!allowedProperties.Contains(propName) || IsSensitivePropertyName(propName))
            {
                continue;
            }

            if (!prop.IsModified)
            {
                continue;
            }

            if (AreScalarValuesEqual(prop.OriginalValue, prop.CurrentValue))
            {
                continue;
            }

            oldDiff[propName] = NormalizeAndSanitizeScalarValue(prop.OriginalValue);
            newDiff[propName] = NormalizeAndSanitizeScalarValue(prop.CurrentValue);
        }

        return (oldDiff, newDiff);
    }

    public static bool IsSensitivePropertyName(string propertyName)
    {
        if (string.IsNullOrWhiteSpace(propertyName))
        {
            return false;
        }

        return SensitivePropertyNames.Contains(propertyName) ||
               SensitivePropertyTokenRegex.IsMatch(propertyName);
    }

    private static bool AreScalarValuesEqual(object? originalValue, object? currentValue)
    {
        if (ReferenceEquals(originalValue, currentValue))
        {
            return true;
        }

        if (originalValue is null || currentValue is null)
        {
            return false;
        }

        if (originalValue is decimal decA && currentValue is decimal decB)
        {
            return decA == decB;
        }

        return Equals(originalValue, currentValue);
    }

    private static object? NormalizeAndSanitizeScalarValue(object? value)
    {
        if (value is null)
        {
            return null;
        }

        return value switch
        {
            string str => SanitizeStringValue(str),
            Enum enumVal => enumVal.ToString(),
            DateOnly dateOnly => dateOnly.ToString("yyyy-MM-dd"),
            TimeOnly timeOnly => timeOnly.ToString("HH:mm:ss"),
            DateTime dateTime => (dateTime.Kind == DateTimeKind.Utc ? dateTime : DateTime.SpecifyKind(dateTime, DateTimeKind.Utc)).ToString("O"),
            _ => value
        };
    }

    private static string SanitizeStringValue(string value)
    {
        if (string.IsNullOrEmpty(value))
        {
            return value;
        }

        if (SensitiveValuePatternRegex.IsMatch(value))
        {
            return SensitiveValuePatternRegex.Replace(value, "[REDACTED]");
        }

        return value;
    }

    private void ClearPendingAuditLogs(DbContext context)
    {
        if (_pendingAuditLogs.TryGetValue(context, out var list))
        {
            list.Clear();
            _pendingAuditLogs.Remove(context);
        }
    }

    private void DetachPendingAuditLogs(DbContext context)
    {
        if (_pendingAuditLogs.TryGetValue(context, out var list))
        {
            foreach (var log in list)
            {
                var trackedEntry = context.Entry(log);
                if (trackedEntry.State != EntityState.Detached)
                {
                    trackedEntry.State = EntityState.Detached;
                }
            }

            list.Clear();
            _pendingAuditLogs.Remove(context);
        }
    }
}
