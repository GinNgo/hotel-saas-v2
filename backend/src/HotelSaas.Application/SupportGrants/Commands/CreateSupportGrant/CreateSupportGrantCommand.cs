using System;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using FluentValidation;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.SupportGrants.DTOs;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.SupportGrants.Commands.CreateSupportGrant;

public static class SupportGrantRules
{
    public const string ScopeReadOnly = "READ_ONLY";
    public const string ScopeDiagnostic = "DIAGNOSTIC";

    public static string NormalizeScope(string? scope) =>
        scope?.Trim().ToUpperInvariant() ?? string.Empty;

    public static bool IsValidScope(string? scope)
    {
        var normalized = NormalizeScope(scope);
        return normalized is ScopeReadOnly or ScopeDiagnostic;
    }

    public static bool IsWithinAllowedWindow(DateTime expiresAtUtc)
    {
        var utcExpires = expiresAtUtc.Kind == DateTimeKind.Utc
            ? expiresAtUtc
            : expiresAtUtc.ToUniversalTime();
        var now = DateTime.UtcNow;
        var minAllowed = now.AddMinutes(15).AddSeconds(-5);
        var maxAllowed = now.AddHours(72).AddSeconds(5);
        return utcExpires >= minAllowed && utcExpires <= maxAllowed;
    }

    public static void EnsureTenantOwnerAccess(ICurrentUserContext currentUser, ICurrentTenantService tenantService, out Guid tenantId)
    {
        var resolved = tenantService.TenantId ?? currentUser.TenantId;
        if (!resolved.HasValue || resolved.Value == Guid.Empty)
        {
            throw new ForbiddenException("ERR_TENANT_REQUIRED", "Yêu cầu ngữ cảnh doanh nghiệp (Tenant) hợp lệ.");
        }

        if (currentUser.StaffRole.HasValue && currentUser.StaffRole.Value != StaffRole.Owner)
        {
            throw new ForbiddenException("ERR_OWNER_REQUIRED", "Chỉ Chủ sở hữu doanh nghiệp (Owner) mới có quyền quản lý quyền hỗ trợ kỹ thuật.");
        }

        tenantId = resolved.Value;
    }

    public static SupportAccessGrantDto MapToDto(
        SupportAccessGrant grant,
        string tenantName,
        string grantedByEmail,
        string targetEmail,
        string targetName,
        DateTime nowUtc)
    {
        var isActive = !grant.RevokedAtUtc.HasValue && grant.ExpiresAtUtc > nowUtc;
        var status = grant.RevokedAtUtc.HasValue
            ? "REVOKED"
            : grant.ExpiresAtUtc <= nowUtc
                ? "EXPIRED"
                : "ACTIVE";

        return new SupportAccessGrantDto(
            grant.Id,
            grant.TenantId,
            tenantName,
            grant.GrantedByUserId,
            grantedByEmail,
            grant.TargetSupportUserId,
            targetEmail,
            targetName,
            grant.Scope,
            grant.Reason,
            grant.ExpiresAtUtc,
            grant.RevokedAtUtc,
            grant.RevokedByUserId,
            status,
            isActive,
            grant.CreatedAtUtc);
    }
}

public sealed record CreateSupportGrantCommand(
    Guid TargetSupportUserId,
    string Scope,
    string Reason,
    DateTime ExpiresAtUtc
) : IRequest<SupportAccessGrantDto>;

public sealed class CreateSupportGrantCommandValidator : AbstractValidator<CreateSupportGrantCommand>
{
    public CreateSupportGrantCommandValidator()
    {
        RuleFor(x => x.TargetSupportUserId)
            .NotEmpty().WithMessage("Vui lòng chọn nhân sự hỗ trợ nền tảng (Support User).");

        RuleFor(x => x.Scope)
            .NotEmpty().WithMessage("Phạm vi truy cập hỗ trợ là bắt buộc.")
            .Must(SupportGrantRules.IsValidScope)
            .WithMessage("Phạm vi truy cập chỉ hỗ trợ 'READ_ONLY' hoặc 'DIAGNOSTIC'.");

        RuleFor(x => x.Reason)
            .NotEmpty().WithMessage("Lý do cấp quyền hỗ trợ là bắt buộc.")
            .MinimumLength(5).WithMessage("Lý do cấp quyền cần ít nhất 5 ký tự.")
            .MaximumLength(500).WithMessage("Lý do cấp quyền không được vượt quá 500 ký tự.");

        RuleFor(x => x.ExpiresAtUtc)
            .Must(SupportGrantRules.IsWithinAllowedWindow)
            .WithMessage("Thời hạn hiệu lực phải nằm trong khoảng từ 15 phút đến 72 giờ kể từ hiện tại.");
    }
}

public sealed class CreateSupportGrantCommandHandler
    : IRequestHandler<CreateSupportGrantCommand, SupportAccessGrantDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentTenantService _tenantService;
    private readonly ICurrentUserContext _currentUser;

    public CreateSupportGrantCommandHandler(
        IApplicationDbContext context,
        ICurrentTenantService tenantService,
        ICurrentUserContext currentUser)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _tenantService = tenantService ?? throw new ArgumentNullException(nameof(tenantService));
        _currentUser = currentUser ?? throw new ArgumentNullException(nameof(currentUser));
    }

    public async Task<SupportAccessGrantDto> Handle(
        CreateSupportGrantCommand request,
        CancellationToken cancellationToken)
    {
        SupportGrantRules.EnsureTenantOwnerAccess(_currentUser, _tenantService, out var tenantId);

        var targetUser = await _context.Users
            .IgnoreQueryFilters()
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == request.TargetSupportUserId, cancellationToken);

        if (targetUser == null || !targetUser.IsActive || targetUser.GlobalRole != GlobalUserRole.SuperAdmin)
        {
            throw new BadRequestException(
                "ERR_INVALID_SUPPORT_USER",
                "Nhân sự được cấp quyền phải là tài khoản Quản trị / Hỗ trợ Nền tảng (SuperAdmin) đang hoạt động.");
        }

        var tenant = await _context.Tenants
            .IgnoreQueryFilters()
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == tenantId, cancellationToken);

        if (tenant == null)
        {
            throw new NotFoundException(nameof(Tenant), tenantId);
        }

        var now = DateTime.UtcNow;
        var expiresUtc = request.ExpiresAtUtc.Kind == DateTimeKind.Utc
            ? request.ExpiresAtUtc
            : request.ExpiresAtUtc.ToUniversalTime();
        var normalizedScope = SupportGrantRules.NormalizeScope(request.Scope);

        var grant = new SupportAccessGrant
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            GrantedByUserId = _currentUser.UserId,
            TargetSupportUserId = targetUser.Id,
            Scope = normalizedScope,
            Reason = request.Reason.Trim(),
            ExpiresAtUtc = expiresUtc,
            CreatedAtUtc = now,
            UpdatedAtUtc = now
        };

        var auditEntry = new SupportAuditLog
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            SupportAccessGrantId = grant.Id,
            ActorUserId = _currentUser.UserId,
            Action = "GRANT_CREATED",
            ResourcePath = "/api/tenants/current/support-grants",
            DetailsJson = JsonSerializer.Serialize(new
            {
                Scope = normalizedScope,
                TargetSupportUserId = targetUser.Id,
                TargetSupportEmail = targetUser.Email,
                ExpiresAtUtc = expiresUtc,
                Reason = grant.Reason
            }),
            IpAddress = _currentUser.IpAddress,
            CreatedAtUtc = now,
            UpdatedAtUtc = now
        };

        _context.SupportAccessGrants.Add(grant);
        _context.SupportAuditLogs.Add(auditEntry);
        await _context.SaveChangesAsync(cancellationToken);

        return SupportGrantRules.MapToDto(
            grant,
            tenant.Name,
            _currentUser.Email,
            targetUser.Email,
            targetUser.FullName,
            now);
    }
}
