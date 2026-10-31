using System;
using System.Security.Claims;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace HotelSaas.Infrastructure.Hubs;

/// <summary>
/// Strongly-typed client contract for receptionist terminals and guest notifications.
/// </summary>
public interface INotificationClient
{
    Task ReceiveNewReservation(ReservationNotificationPayload notification);
    Task ReceiveReservationStatusUpdated(ReservationStatusNotificationPayload notification);
    Task ReceiveHousekeepingAlert(HousekeepingNotificationPayload alert);
}

public sealed record ReservationNotificationPayload(
    string ReservationId,
    string ConfirmationCode,
    string GuestName,
    string RoomTypeName,
    decimal TotalAmount,
    decimal DepositPaid,
    string Status,
    string PropertyId,
    string CreatedAtUtc
);

public sealed record ReservationStatusNotificationPayload(
    string ReservationId,
    string ConfirmationCode,
    string PreviousStatus,
    string NewStatus,
    string PropertyId,
    string UpdatedAtUtc
);

public sealed record HousekeepingNotificationPayload(
    string RoomNumber,
    string RoomStatus,
    string PropertyId,
    string Message,
    string UpdatedAtUtc
);

/// <summary>
/// Realtime SignalR Hub for hotel operations and automated booking alerts (Task A03 / T01).
/// Groups clients by PropertyId with fail-closed multi-tenant and branch authorization.
/// </summary>
[Authorize]
public class NotificationHub : Hub<INotificationClient>
{
    private readonly IApplicationDbContext? _context;
    private readonly ILogger<NotificationHub> _logger;

    public NotificationHub(IApplicationDbContext? context = null, ILogger<NotificationHub>? logger = null)
    {
        _context = context;
        _logger = logger ?? Microsoft.Extensions.Logging.Abstractions.NullLogger<NotificationHub>.Instance;
    }

    public static string GetPropertyGroupName(string propertyId) => $"Property_{propertyId.Trim().ToLowerInvariant()}";

    /// <summary>
    /// Authenticated receptionists / hotel staff join their specific property notification channel.
    /// Strictly verifies user active membership and prevents cross-tenant or cross-branch eavesdropping.
    /// </summary>
    public async Task JoinProperty(string propertyId)
    {
        if (string.IsNullOrWhiteSpace(propertyId))
        {
            throw new HubException("ERR_PROPERTY_REQUIRED: Mã chi nhánh không được để trống.");
        }

        if (!Guid.TryParse(propertyId.Trim(), out var targetPropertyGuid))
        {
            throw new HubException("ERR_INVALID_PROPERTY: Mã chi nhánh không hợp lệ.");
        }

        var user = Context.User;
        if (user?.Identity?.IsAuthenticated != true)
        {
            throw new HubException("ERR_UNAUTHORIZED: Yêu cầu đăng nhập xác thực để kết nối kênh thông báo.");
        }

        var userIdStr = user.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? user.FindFirst("sub")?.Value;
        if (!Guid.TryParse(userIdStr, out var userId))
        {
            throw new HubException("ERR_UNAUTHORIZED: Token danh tính người dùng không hợp lệ.");
        }

        var globalRoleStr = user.FindFirst("globalRole")?.Value;
        bool isSuperAdmin = string.Equals(globalRoleStr, "SuperAdmin", StringComparison.OrdinalIgnoreCase);

        if (isSuperAdmin)
        {
            var superAdminGroup = GetPropertyGroupName(propertyId);
            await Groups.AddToGroupAsync(Context.ConnectionId, superAdminGroup);
            _logger.LogInformation("SuperAdmin {UserId} joined property notification channel {Group}", userId, superAdminGroup);
            return;
        }

        // Verify property exists
        if (_context == null)
        {
            throw new HubException("ERR_UNAVAILABLE: Database context is not available.");
        }

        var property = await _context.Properties
            .IgnoreQueryFilters()
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == targetPropertyGuid);

        if (property == null)
        {
            throw new HubException("ERR_PROPERTY_NOT_FOUND: Chi nhánh khách sạn không tồn tại.");
        }

        // Cross-tenant guard: Check caller's tenant claim against property tenant
        var tokenTenantStr = user.FindFirst("tenantId")?.Value ?? user.FindFirst("tid")?.Value;
        if (Guid.TryParse(tokenTenantStr, out var tokenTenantId) && property.TenantId != tokenTenantId)
        {
            _logger.LogWarning("Security Guard: User {UserId} from tenant {TokenTenant} attempted cross-tenant join to property {PropertyId} (Tenant {PropTenant})",
                userId, tokenTenantId, targetPropertyGuid, property.TenantId);
            throw new HubException("ERR_CROSS_TENANT_FORBIDDEN: Chi nhánh không thuộc quyền quản lý của khách sạn bạn.");
        }

        // Multi-branch membership verification: User must have active staff assignment for this tenant and property
        var isAuthorizedStaff = await _context.TenantStaffMembers
            .IgnoreQueryFilters()
            .AsNoTracking()
            .AnyAsync(s => s.UserId == userId &&
                           s.TenantId == property.TenantId &&
                           s.IsActive &&
                           (s.PropertyId == null || s.PropertyId == targetPropertyGuid));

        if (!isAuthorizedStaff)
        {
            _logger.LogWarning("Security Guard: User {UserId} denied access to property {PropertyId} due to lack of active staff membership",
                userId, targetPropertyGuid);
            throw new HubException("ERR_PROPERTY_FORBIDDEN: Bạn không có quyền truy cập thông báo của chi nhánh này.");
        }

        var groupName = GetPropertyGroupName(propertyId);
        await Groups.AddToGroupAsync(Context.ConnectionId, groupName);
        _logger.LogInformation("Staff {UserId} joined property notification group {Group}", userId, groupName);
    }

    public async Task LeaveProperty(string propertyId)
    {
        if (!string.IsNullOrWhiteSpace(propertyId))
        {
            var groupName = GetPropertyGroupName(propertyId);
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, groupName);
        }
    }
}

