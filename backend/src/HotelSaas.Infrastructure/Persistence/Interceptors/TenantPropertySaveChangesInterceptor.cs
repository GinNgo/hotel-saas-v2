using System.Data;
using System.Data.Common;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Domain.Common;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.EntityFrameworkCore.Storage;

namespace HotelSaas.Infrastructure.Persistence.Interceptors;

/// <summary>
/// Enforces tenant and property scope boundaries during entity persistence.
/// Verifies partition immutability, validates persisted scopes from the database for detached entities,
/// and prevents cross-tenant or cross-property data mutations.
/// </summary>
public sealed class TenantPropertySaveChangesInterceptor : SaveChangesInterceptor
{
    private readonly ICurrentTenantService _currentTenantService;
    private readonly ICurrentPropertyService _currentPropertyService;

    /// <summary>
    /// Initializes a new instance of <see cref="TenantPropertySaveChangesInterceptor"/>.
    /// </summary>
    public TenantPropertySaveChangesInterceptor(
        ICurrentTenantService currentTenantService,
        ICurrentPropertyService currentPropertyService)
    {
        _currentTenantService = currentTenantService;
        _currentPropertyService = currentPropertyService;
    }

    /// <inheritdoc />
    public override InterceptionResult<int> SavingChanges(
        DbContextEventData eventData,
        InterceptionResult<int> result)
    {
        if (eventData.Context != null)
        {
            ValidateEntitiesSync(eventData.Context);
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
            await ValidateEntitiesAsync(eventData.Context, cancellationToken);
        }
        return await base.SavingChangesAsync(eventData, result, cancellationToken);
    }

    private void ValidateEntitiesSync(DbContext context)
    {
        ValidateEntitiesAsync(context, CancellationToken.None).GetAwaiter().GetResult();
    }

    private async Task ValidateEntitiesAsync(DbContext context, CancellationToken cancellationToken)
    {
        var currentTenantId = _currentTenantService.TenantId;
        var currentPropertyId = _currentPropertyService.PropertyId;
        var isTenantWide = _currentPropertyService.IsTenantWide;
        var excludedProperties = _currentPropertyService.ExcludedPropertyIds ?? Array.Empty<Guid>();

        var entries = context.ChangeTracker.Entries().ToList();
        foreach (var entry in entries)
        {
            if (entry.Entity is not ITenantScopedEntity tenantEntity)
                continue;

            // 1. Kiểm soát phạm vi Tenant
            if (entry.State == EntityState.Added)
            {
                if (!currentTenantId.HasValue)
                    throw new ForbiddenException("ERR_TENANT_REQUIRED", "Không thể ghi dữ liệu khi thiếu Tenant context.");

                if (tenantEntity.TenantId == Guid.Empty)
                    tenantEntity.TenantId = currentTenantId.Value;
                else if (tenantEntity.TenantId != currentTenantId.Value)
                    throw new ForbiddenException("ERR_CROSS_TENANT_MUTATION", "Không được phép tạo entity thuộc Tenant khác.");
            }
            else if (entry.State == EntityState.Modified || entry.State == EntityState.Deleted)
            {
                if (!currentTenantId.HasValue)
                    throw new ForbiddenException("ERR_TENANT_REQUIRED", "Không thể sửa/xóa dữ liệu khi thiếu Tenant context.");

                // Kiểm tra tính bất biến của TenantId
                var tenantProp = entry.Property(nameof(ITenantScopedEntity.TenantId));
                if (tenantProp.IsModified && !Equals(tenantProp.CurrentValue, tenantProp.OriginalValue))
                {
                    throw new ForbiddenException("ERR_IMMUTABLE_SCOPE_FIELDS", "Không được phép thay đổi TenantId của bản ghi.");
                }

                // Kiểm tra scope persisted từ DB nếu entity có ID
                if (entry.Entity is BaseEntity baseEntity && baseEntity.Id != Guid.Empty)
                {
                    await VerifyPersistedScopeAsync(
                        context, entry, baseEntity.Id, currentTenantId.Value,
                        currentPropertyId, isTenantWide, excludedProperties, cancellationToken);
                }
            }

            // 2. Kiểm soát phạm vi Property
            if (entry.Entity is IPropertyScopedEntity propertyEntity)
            {
                if (entry.State == EntityState.Added)
                {
                    // Header mismatch guard: if request specified X-Property-Id, entity must match!
                    if (_currentPropertyService.HeaderPropertyId.HasValue &&
                        propertyEntity.PropertyId != Guid.Empty &&
                        propertyEntity.PropertyId != _currentPropertyService.HeaderPropertyId.Value)
                    {
                        throw new BadRequestException("ERR_CONTEXT_MISMATCH",
                            "Chi nhánh của dữ liệu không khớp với chi nhánh trong header X-Property-Id.");
                    }

                    if (isTenantWide)
                    {
                        if (propertyEntity.PropertyId == Guid.Empty)
                        {
                            if (currentPropertyId.HasValue)
                                propertyEntity.PropertyId = currentPropertyId.Value;
                            else
                                throw new ConflictException("ERR_PROPERTY_REQUIRED", "Bắt buộc chỉ định PropertyId cho thực thể chi nhánh.");
                        }

                        if (excludedProperties.Contains(propertyEntity.PropertyId))
                            throw new ForbiddenException("ERR_MEMBERSHIP_REVOKED", "Quyền nhân sự tại chi nhánh này đã bị đình chỉ.");
                    }
                    else
                    {
                        if (!currentPropertyId.HasValue)
                            throw new ConflictException("ERR_PROPERTY_REQUIRED", "Không thể tạo tài nguyên khi chưa chọn chi nhánh.");

                        if (propertyEntity.PropertyId == Guid.Empty)
                            propertyEntity.PropertyId = currentPropertyId.Value;
                        else if (propertyEntity.PropertyId != currentPropertyId.Value)
                            throw new ForbiddenException("ERR_CROSS_PROPERTY_MUTATION", "Không được phép tạo dữ liệu cho chi nhánh khác.");
                    }
                }
                else if (entry.State == EntityState.Modified || entry.State == EntityState.Deleted)
                {
                    // Header mismatch guard: if request specified X-Property-Id, target entity must match!
                    if (_currentPropertyService.HeaderPropertyId.HasValue &&
                        propertyEntity.PropertyId != _currentPropertyService.HeaderPropertyId.Value)
                    {
                        throw new BadRequestException("ERR_CONTEXT_MISMATCH",
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
                }
            }
        }
    }

    private async Task VerifyPersistedScopeAsync(
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
        if (string.IsNullOrEmpty(tableName)) return;

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

            // Chặn đứng mọi nỗ lực thay đổi hoặc làm sai lệch TenantId persisted
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

                // Chặn đứng mọi nỗ lực thay đổi hoặc làm sai lệch PropertyId persisted
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

                // Đồng bộ OriginalValue để Concurrency Token kiểm tra đối chiếu chính xác
                propProperty.OriginalValue = dbPropertyId;
            }

            tenantProp.OriginalValue = dbTenantId;
        }
    }
}
