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
    private readonly ISystemMetricsRecorder? _metricsRecorder;

    public NotificationHub(
        IApplicationDbContext? context = null,
        ILogger<NotificationHub>? logger = null,
        ISystemMetricsRecorder? metricsRecorder = null)
    {
        _context = context;
        _logger = logger ?? Microsoft.Extensions.Logging.Abstractions.NullLogger<NotificationHub>.Instance;
        _metricsRecorder = metricsRecorder;
    }

    public override async Task OnConnectedAsync()
    {
        await base.OnConnectedAsync();
        _metricsRecorder?.IncrementSignalRConnection();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        try
        {
            await base.OnDisconnectedAsync(exception);
        }
        finally
        {
            _metricsRecorder?.DecrementSignalRConnection();
        }
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

        // Fail-closed: database context is required for ALL callers, including SuperAdmin
        if (_context == null)
        {
            throw new HubException("ERR_UNAVAILABLE: Database context is not available.");
        }

        var property = await _context.Properties
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Include(p => p.Tenant)
            .FirstOrDefaultAsync(p => p.Id == targetPropertyGuid);

        if (property == null)
        {
            throw new HubException("ERR_PROPERTY_NOT_FOUND: Chi nhánh khách sạn không tồn tại.");
        }

        if (isSuperAdmin)
        {
            var superAdminUser = await _context.Users
                .IgnoreQueryFilters()
                .AsNoTracking()
                .FirstOrDefaultAsync(u => u.Id == userId);

            if (superAdminUser != null && !superAdminUser.IsActive)
            {
                _logger.LogWarning("Security Guard: Deactivated SuperAdmin {UserId} denied JoinProperty for {PropertyId}",
                    userId, targetPropertyGuid);
                _metricsRecorder?.RecordIsolationBlock("ERR_USER_DEACTIVATED");
                throw new HubException("ERR_USER_DEACTIVATED: Tài khoản người dùng đã bị vô hiệu hóa.");
            }

            var nowUtc = DateTime.UtcNow;
            var hasActiveSupportGrant = await _context.SupportAccessGrants
                .IgnoreQueryFilters()
                .AsNoTracking()
                .AnyAsync(g =>
                    g.TargetSupportUserId == userId &&
                    g.TenantId == property.TenantId &&
                    g.RevokedAtUtc == null &&
                    g.ExpiresAtUtc > nowUtc);

            if (!hasActiveSupportGrant)
            {
                _logger.LogWarning("Security Guard: SuperAdmin {UserId} denied JoinProperty for {PropertyId} (Tenant {TenantId}) without an active SupportAccessGrant",
                    userId, targetPropertyGuid, property.TenantId);
                _metricsRecorder?.RecordIsolationBlock("ERR_SUPPORT_GRANT_REQUIRED");
                throw new HubException("ERR_SUPPORT_GRANT_REQUIRED: SuperAdmin cần có SupportAccessGrant đang hiệu lực để tham gia kênh thông báo của chi nhánh khách hàng.");
            }

            await Groups.AddToGroupAsync(Context.ConnectionId, GetPropertyGroupName(propertyId));
            await Groups.AddToGroupAsync(Context.ConnectionId, GetPropertyFinancialGroupName(propertyId));
            await Groups.AddToGroupAsync(Context.ConnectionId, GetPropertyHousekeepingGroupName(propertyId));
            _logger.LogInformation("SuperAdmin {UserId} joined property notification channels for {PropertyId} under active SupportAccessGrant", userId, propertyId);
            return;
        }

        // Cross-tenant guard: Check caller's tenant claim against property tenant (including alias integrity)
        var tenantIdClaim = user.FindFirst("tenantId")?.Value;
        var tidClaim = user.FindFirst("tid")?.Value;
        if (!string.IsNullOrEmpty(tenantIdClaim) && !string.IsNullOrEmpty(tidClaim) &&
            !string.Equals(tenantIdClaim, tidClaim, StringComparison.OrdinalIgnoreCase))
        {
            _logger.LogWarning("Security Guard: User {UserId} presented conflicting tenantId/tid claims while joining property {PropertyId}",
                userId, targetPropertyGuid);
            _metricsRecorder?.RecordIsolationBlock("ERR_CROSS_TENANT_FORBIDDEN");
            throw new HubException("ERR_CROSS_TENANT_FORBIDDEN: Token chứa thông tin Tenant không nhất quán.");
        }

        var tokenTenantStr = tenantIdClaim ?? tidClaim;
        if (Guid.TryParse(tokenTenantStr, out var tokenTenantId) && property.TenantId != tokenTenantId)
        {
            _logger.LogWarning("Security Guard: User {UserId} from tenant {TokenTenant} attempted cross-tenant join to property {PropertyId} (Tenant {PropTenant})",
                userId, tokenTenantId, targetPropertyGuid, property.TenantId);
            _metricsRecorder?.RecordIsolationBlock("ERR_CROSS_TENANT_FORBIDDEN");
            throw new HubException("ERR_CROSS_TENANT_FORBIDDEN: Chi nhánh không thuộc quyền quản lý của khách sạn bạn.");
        }

        // Load all tenant staff assignments for deterministic membership & PO Decision 4 enforcement
        var memberships = await _context.TenantStaffMembers
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Include(s => s.User)
            .Include(s => s.Role)
                .ThenInclude(r => r!.Permissions)
                    .ThenInclude(p => p.Function)
            .Where(s => s.UserId == userId && s.TenantId == property.TenantId)
            .ToListAsync();

        if (memberships.Count == 0)
        {
            _logger.LogWarning("Security Guard: User {UserId} denied access to property {PropertyId} due to lack of active staff membership",
                userId, targetPropertyGuid);
            _metricsRecorder?.RecordIsolationBlock("ERR_PROPERTY_FORBIDDEN");
            throw new HubException("ERR_PROPERTY_FORBIDDEN: Bạn không có quyền truy cập thông báo của chi nhánh này.");
        }

        // Verify User.IsActive
        var staffUser = memberships[0].User ?? await _context.Users
            .IgnoreQueryFilters()
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == userId);

        if (staffUser == null || !staffUser.IsActive)
        {
            _logger.LogWarning("Security Guard: Inactive user {UserId} denied SignalR join for property {PropertyId}",
                userId, targetPropertyGuid);
            _metricsRecorder?.RecordIsolationBlock("ERR_USER_DEACTIVATED");
            throw new HubException("ERR_USER_DEACTIVATED: Tài khoản người dùng đã bị vô hiệu hóa.");
        }

        // Verify Tenant.Status == Active
        var tenant = property.Tenant ?? await _context.Tenants
            .IgnoreQueryFilters()
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == property.TenantId);

        if (tenant == null || tenant.Status != TenantStatus.Active)
        {
            _logger.LogWarning("Security Guard: User {UserId} denied SignalR join because tenant {TenantId} is inactive",
                userId, property.TenantId);
            _metricsRecorder?.RecordIsolationBlock("ERR_TENANT_INACTIVE");
            throw new HubException("ERR_TENANT_INACTIVE: Doanh nghiệp hiện đang bị tạm ngưng hoạt động.");
        }

        // Verify Property.Status == Active
        if (property.Status != PropertyStatus.Active)
        {
            _logger.LogWarning("Security Guard: User {UserId} denied SignalR join because property {PropertyId} is inactive",
                userId, targetPropertyGuid);
            _metricsRecorder?.RecordIsolationBlock("ERR_PROPERTY_INACTIVE");
            throw new HubException("ERR_PROPERTY_INACTIVE: Chi nhánh hiện đang tạm ngưng hoạt động.");
        }

        // PO Decision 4: Exact revoked branch membership strictly denies access with ZERO fallback to tenant-wide row
        var exactBranchRows = memberships.Where(s => s.PropertyId == targetPropertyGuid).ToList();
        if (exactBranchRows.Any(s => !s.IsActive))
        {
            _logger.LogWarning("Security Guard (PO Decision 4): User {UserId} has revoked membership at property {PropertyId}; denying SignalR join without tenant-wide fallback",
                userId, targetPropertyGuid);
            _metricsRecorder?.RecordIsolationBlock("ERR_MEMBERSHIP_REVOKED");
            throw new HubException("ERR_MEMBERSHIP_REVOKED: Quyền nhân sự của bạn tại chi nhánh này đã bị thu hồi.");
        }

        var staff = exactBranchRows.FirstOrDefault(s => s.IsActive)
            ?? memberships.FirstOrDefault(s => s.PropertyId == null && s.IsActive);

        if (staff == null)
        {
            _logger.LogWarning("Security Guard: User {UserId} denied access to property {PropertyId} due to lack of active staff membership",
                userId, targetPropertyGuid);
            _metricsRecorder?.RecordIsolationBlock("ERR_PROPERTY_FORBIDDEN");
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
