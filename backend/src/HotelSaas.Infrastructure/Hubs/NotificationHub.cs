using System;
using System.Security.Claims;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Domain.Enums;
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
    Task ReceiveBookingPaymentConfirmed(PaymentConfirmedNotificationPayload notification);
    Task ReceiveBookingCancellationRequested(BookingCancellationNotificationPayload notification);
    Task ReceiveHoldExpired(HoldExpiredNotificationPayload notification);
}

public sealed record PaymentConfirmedNotificationPayload(
    string EventId,
    string ReservationId,
    string ConfirmationCode,
    string GuestName,
    decimal TotalAmount,
    decimal PaidAmount,
    string PaymentMethod,
    string PropertyId,
    string CreatedAtUtc,
    string TargetRoute
);

public sealed record BookingCancellationNotificationPayload(
    string EventId,
    string ReservationId,
    string ConfirmationCode,
    string GuestName,
    string Reason,
    decimal RefundableAmount,
    string PropertyId,
    string CreatedAtUtc,
    string TargetRoute
);

public sealed record HoldExpiredNotificationPayload(
    string EventId,
    string ReservationId,
    string ConfirmationCode,
    string RoomTypeName,
    string PropertyId,
    string CreatedAtUtc,
    string TargetRoute
);

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
    public static string GetPropertyFinancialGroupName(string propertyId) => $"Property_{propertyId.Trim().ToLowerInvariant()}_financial";
    public static string GetPropertyFrontdeskGroupName(string propertyId) => $"Property_{propertyId.Trim().ToLowerInvariant()}_frontdesk";
    public static string GetPropertyHousekeepingGroupName(string propertyId) => $"Property_{propertyId.Trim().ToLowerInvariant()}_housekeeping";

    /// <summary>
    /// Authenticated receptionists / hotel staff join their specific property notification channel.
    /// Strictly verifies user active membership and prevents cross-tenant or cross-branch eavesdropping.
    /// Granularly assigns staff to role-scoped channels (base operations vs. financial payouts vs. housekeeping).
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
            await Groups.AddToGroupAsync(Context.ConnectionId, GetPropertyGroupName(propertyId));
            await Groups.AddToGroupAsync(Context.ConnectionId, GetPropertyFinancialGroupName(propertyId));
            await Groups.AddToGroupAsync(Context.ConnectionId, GetPropertyHousekeepingGroupName(propertyId));
            _logger.LogInformation("SuperAdmin {UserId} joined property notification channels for {PropertyId}", userId, propertyId);
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
        var staff = await _context.TenantStaffMembers
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Include(s => s.Role)
                .ThenInclude(r => r!.Permissions)
                    .ThenInclude(p => p.Function)
            .FirstOrDefaultAsync(s => s.UserId == userId &&
                           s.TenantId == property.TenantId &&
                           s.IsActive &&
                           (s.PropertyId == null || s.PropertyId == targetPropertyGuid));

        if (staff == null)
        {
            _logger.LogWarning("Security Guard: User {UserId} denied access to property {PropertyId} due to lack of active staff membership",
                userId, targetPropertyGuid);
            throw new HubException("ERR_PROPERTY_FORBIDDEN: Bạn không có quyền truy cập thông báo của chi nhánh này.");
        }

        var groupName = GetPropertyGroupName(propertyId);
        await Groups.AddToGroupAsync(Context.ConnectionId, groupName);

        // RBAC Scoping: Only staff with financial approval authority (Owner, Manager, or PAYMENTS:Approve) join the financial channel
        bool hasFinancialPermission = staff.StaffRole == StaffRole.Owner ||
                                      staff.StaffRole == StaffRole.Manager ||
                                      (staff.Role?.Permissions?.Any(p => p.Function?.Code == "PAYMENTS" && (p.ActionMask & 16) != 0) == true);
        if (hasFinancialPermission)
        {
            var financialGroup = GetPropertyFinancialGroupName(propertyId);
            await Groups.AddToGroupAsync(Context.ConnectionId, financialGroup);
            _logger.LogInformation("Staff {UserId} (Role: {Role}) joined property financial notification channel {Group}",
                userId, staff.StaffRole, financialGroup);
        }
        else if (staff.StaffRole == StaffRole.Receptionist || staff.Role?.Permissions?.Any(p => p.Function?.Code == "RESERVATIONS") == true)
        {
            // Frontdesk operational channel: Mutually exclusive with financial channel to prevent double notifications
            var frontdeskGroup = GetPropertyFrontdeskGroupName(propertyId);
            await Groups.AddToGroupAsync(Context.ConnectionId, frontdeskGroup);
            _logger.LogInformation("Staff {UserId} (Role: {Role}) joined property frontdesk notification channel {Group}",
                userId, staff.StaffRole, frontdeskGroup);
        }

        // Housekeeping channel
        if (staff.StaffRole == StaffRole.Housekeeper || staff.StaffRole == StaffRole.Manager || staff.StaffRole == StaffRole.Owner)
        {
            var housekeepingGroup = GetPropertyHousekeepingGroupName(propertyId);
            await Groups.AddToGroupAsync(Context.ConnectionId, housekeepingGroup);
        }

        _logger.LogInformation("Staff {UserId} joined property notification group {Group}", userId, groupName);
    }

    public async Task LeaveProperty(string propertyId)
    {
        if (!string.IsNullOrWhiteSpace(propertyId))
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, GetPropertyGroupName(propertyId));
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, GetPropertyFinancialGroupName(propertyId));
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, GetPropertyFrontdeskGroupName(propertyId));
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, GetPropertyHousekeepingGroupName(propertyId));
        }
    }
}
