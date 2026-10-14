using System.Data;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Common.Models;
using HotelSaas.Domain.Enums;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace HotelSaas.Infrastructure.Services;

/// <summary>
/// Direct SQL implementation of <see cref="IMembershipLookupService"/> executing parameterized queries
/// directly against PostgreSQL to prevent circular dependencies during middleware initialization.
/// Enforces deterministic membership selection and fail-closed security.
/// </summary>
public sealed class MembershipLookupService : IMembershipLookupService
{
    private readonly string _connectionString;
    private readonly ILogger<MembershipLookupService> _logger;

    /// <summary>
    /// Initializes a new instance of <see cref="MembershipLookupService"/>.
    /// </summary>
    public MembershipLookupService(IConfiguration configuration, ILogger<MembershipLookupService> logger)
    {
        _connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException("Connection string 'DefaultConnection' is not configured.");
        _logger = logger;
    }

    private sealed record StaffRow(
        Guid Id,
        Guid RoleId,
        StaffRole StaffRole,
        Guid? PropertyId,
        bool IsActive,
        bool UserIsActive,
        int TenantStatus);

    /// <inheritdoc />
    public async Task<MembershipLookupResult> ResolveMembershipAsync(
        Guid tenantId,
        Guid userId,
        Guid? targetPropertyId,
        CancellationToken cancellationToken = default)
    {
        const string sql = @"
            SELECT s.""Id"", s.""RoleId"", s.""StaffRole"", s.""PropertyId"", s.""IsActive"", 
                   u.""IsActive"" AS ""UserIsActive"", t.""Status"" AS ""TenantStatus""
            FROM ""TenantStaffMembers"" s
            JOIN ""Users"" u ON u.""Id"" = s.""UserId""
            JOIN ""Tenants"" t ON t.""Id"" = s.""TenantId""
            WHERE s.""TenantId"" = @tenantId AND s.""UserId"" = @userId;";

        var rows = new List<StaffRow>();

        try
        {
            await using var conn = new NpgsqlConnection(_connectionString);
            await conn.OpenAsync(cancellationToken);

            await using var cmd = new NpgsqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("tenantId", tenantId);
            cmd.Parameters.AddWithValue("userId", userId);

            await using var reader = await cmd.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken))
            {
                var id = reader.GetGuid(0);
                var roleId = reader.GetGuid(1);
                var staffRole = (StaffRole)reader.GetInt32(2);
                var propId = reader.IsDBNull(3) ? (Guid?)null : reader.GetGuid(3);
                var isActive = reader.GetBoolean(4);
                var userIsActive = reader.GetBoolean(5);
                var tenantStatus = reader.GetInt32(6);

                rows.Add(new StaffRow(id, roleId, staffRole, propId, isActive, userIsActive, tenantStatus));
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Fail-Closed: Database connection failure during membership lookup for UserId: {UserId}, TenantId: {TenantId}", userId, tenantId);
            throw; // Fail-closed: caught by middleware to return HTTP 500/503 ERR_SERVICE_UNAVAILABLE
        }

        if (rows.Count == 0)
        {
            return MembershipLookupResult.Failed(
                MembershipLookupStatus.NoMembership,
                "Tài khoản không thuộc tổ chức doanh nghiệp này.");
        }

        // 1. Verify User active status
        if (rows.Any(r => !r.UserIsActive))
        {
            return MembershipLookupResult.Failed(
                MembershipLookupStatus.UserNotFoundOrInactive,
                "Tài khoản người dùng đã bị vô hiệu hóa.");
        }

        // 2. Verify Tenant active status
        if (rows.Any(r => r.TenantStatus != (int)TenantStatus.Active))
        {
            return MembershipLookupResult.Failed(
                MembershipLookupStatus.TenantNotFoundOrInactive,
                "Doanh nghiệp hiện đang bị tạm ngưng hoạt động.");
        }

        // 3. Deterministic membership selection
        if (targetPropertyId.HasValue)
        {
            // Verify target property exists, belongs to tenant and is active
            PropertyStatus? propertyStatus = null;
            try
            {
                await using var conn = new NpgsqlConnection(_connectionString);
                await conn.OpenAsync(cancellationToken);

                await using var propCmd = new NpgsqlCommand(
                    @"SELECT ""Status"" FROM ""Properties"" WHERE ""Id"" = @propId AND ""TenantId"" = @tenantId;", conn);
                propCmd.Parameters.AddWithValue("propId", targetPropertyId.Value);
                propCmd.Parameters.AddWithValue("tenantId", tenantId);

                var propStatusObj = await propCmd.ExecuteScalarAsync(cancellationToken);
                if (propStatusObj is null)
                {
                    return MembershipLookupResult.Failed(
                        MembershipLookupStatus.PropertyNotFound,
                        "Chi nhánh không tồn tại hoặc không thuộc tổ chức doanh nghiệp này.");
                }

                propertyStatus = (PropertyStatus)Convert.ToInt32(propStatusObj);
                if (propertyStatus != PropertyStatus.Active)
                {
                    return MembershipLookupResult.Failed(
                        MembershipLookupStatus.PropertyInactive,
                        "Chi nhánh hiện đang tạm ngưng hoạt động.");
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Fail-Closed: Database connection failure during property validation for PropertyId: {PropertyId}", targetPropertyId.Value);
                throw;
            }

            // Always calculate excluded properties where user has an exact inactive membership
            var excluded = rows
                .Where(r => r.PropertyId.HasValue && !r.IsActive)
                .Select(r => r.PropertyId!.Value)
                .Distinct()
                .ToList();

            // Case A: Specific property requested
            var exactMatch = rows.FirstOrDefault(r => r.PropertyId == targetPropertyId.Value);
            if (exactMatch != null)
            {
                if (!exactMatch.IsActive)
                {
                    // PO Decision 4: Exact membership inactive strictly blocks access. Zero fallback to tenant-wide!
                    return MembershipLookupResult.Failed(
                        MembershipLookupStatus.MembershipRevoked,
                        "Quyền nhân sự của bạn tại chi nhánh này đã bị thu hồi.");
                }

                return MembershipLookupResult.Succeeded(
                    exactMatch.RoleId,
                    exactMatch.StaffRole,
                    targetPropertyId.Value,
                    isTenantWide: false,
                    excludedPropertyIds: excluded,
                    propertyStatus: propertyStatus);
            }

            // Exact match not found: check tenant-wide authority
            var tenantWide = rows.FirstOrDefault(r => r.PropertyId == null);
            if (tenantWide != null && tenantWide.IsActive)
            {
                return MembershipLookupResult.Succeeded(
                    tenantWide.RoleId,
                    tenantWide.StaffRole,
                    targetPropertyId.Value,
                    isTenantWide: true,
                    excludedPropertyIds: excluded,
                    propertyStatus: propertyStatus);
            }

            return MembershipLookupResult.Failed(
                MembershipLookupStatus.PropertyForbidden,
                "Bạn không có quyền truy cập vào chi nhánh này.");
        }
        else
        {
            // Case B: No property requested (pure tenant-wide operation or initial context)
            var tenantWide = rows.FirstOrDefault(r => r.PropertyId == null);
            if (tenantWide != null && tenantWide.IsActive)
            {
                // PO Decision 3: Owner tenant-wide view must automatically exclude branches where user has exact inactive memberships
                var excluded = rows
                    .Where(r => r.PropertyId.HasValue && !r.IsActive)
                    .Select(r => r.PropertyId!.Value)
                    .Distinct()
                    .ToList();

                return MembershipLookupResult.Succeeded(
                    tenantWide.RoleId,
                    tenantWide.StaffRole,
                    null,
                    isTenantWide: true,
                    excluded);
            }

            // PO Decision 2: Staff without tenant-wide authority calling business endpoint without property is denied
            return MembershipLookupResult.Failed(
                MembershipLookupStatus.PropertyRequired,
                "Yêu cầu chọn chi nhánh làm việc để tiếp tục.");
        }
    }
}
