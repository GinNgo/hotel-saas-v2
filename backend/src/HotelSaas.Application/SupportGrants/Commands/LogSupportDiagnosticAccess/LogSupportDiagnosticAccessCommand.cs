using System;
using System.Collections.Generic;
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

namespace HotelSaas.Application.SupportGrants.Commands.LogSupportDiagnosticAccess;

public sealed record LogSupportDiagnosticAccessCommand(
    Guid GrantId,
    string? ResourcePath = null
) : IRequest<SupportDiagnosticSnapshotDto>;

public sealed class LogSupportDiagnosticAccessCommandValidator
    : AbstractValidator<LogSupportDiagnosticAccessCommand>
{
    public LogSupportDiagnosticAccessCommandValidator()
    {
        RuleFor(x => x.GrantId)
            .NotEmpty().WithMessage("Mã quyền hỗ trợ (GrantId) là bắt buộc.");

        RuleFor(x => x.ResourcePath)
            .MaximumLength(256).WithMessage("Đường dẫn tài nguyên không được vượt quá 256 ký tự.");
    }
}

public sealed class LogSupportDiagnosticAccessCommandHandler
    : IRequestHandler<LogSupportDiagnosticAccessCommand, SupportDiagnosticSnapshotDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserContext _currentUser;

    public LogSupportDiagnosticAccessCommandHandler(
        IApplicationDbContext context,
        ICurrentUserContext currentUser)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _currentUser = currentUser ?? throw new ArgumentNullException(nameof(currentUser));
    }

    public async Task<SupportDiagnosticSnapshotDto> Handle(
        LogSupportDiagnosticAccessCommand request,
        CancellationToken cancellationToken)
    {
        if (_currentUser.IsAuthenticated && _currentUser.GlobalRole != GlobalUserRole.SuperAdmin)
        {
            throw new ForbiddenException("ERR_FORBIDDEN", "Chỉ Quản trị viên / Kỹ thuật viên Nền tảng mới được truy cập diagnostic theo Support Grant.");
        }

        var grant = await _context.SupportAccessGrants
            .IgnoreQueryFilters()
            .AsNoTracking()
            .FirstOrDefaultAsync(g => g.Id == request.GrantId, cancellationToken);

        if (grant == null)
        {
            throw new NotFoundException(nameof(SupportAccessGrant), request.GrantId);
        }

        if (grant.RevokedAtUtc.HasValue)
        {
            throw new ForbiddenException("ERR_SUPPORT_GRANT_REVOKED", "Quyền hỗ trợ kỹ thuật tạm thời đã bị Tenant thu hồi.");
        }

        var now = DateTime.UtcNow;
        if (grant.ExpiresAtUtc <= now)
        {
            throw new ForbiddenException("ERR_SUPPORT_GRANT_EXPIRED", "Quyền hỗ trợ kỹ thuật tạm thời đã hết hạn.");
        }

        if (_currentUser.UserId != Guid.Empty && grant.TargetSupportUserId != _currentUser.UserId)
        {
            throw new ForbiddenException("ERR_SUPPORT_GRANT_USER_MISMATCH", "Support Grant này không cấp cho tài khoản hỗ trợ hiện tại.");
        }

        var tenant = await _context.Tenants
            .IgnoreQueryFilters()
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == grant.TenantId, cancellationToken);

        if (tenant == null)
        {
            throw new NotFoundException(nameof(Tenant), grant.TenantId);
        }

        var resourcePath = string.IsNullOrWhiteSpace(request.ResourcePath)
            ? $"/api/platform/support-grants/{grant.Id}/diagnostics"
            : request.ResourcePath.Trim();

        var properties = await _context.Properties
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(p => p.TenantId == tenant.Id)
            .OrderBy(p => p.Name)
            .ToListAsync(cancellationToken);

        var rooms = await _context.Rooms
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(r => r.TenantId == tenant.Id)
            .Select(r => r.PropertyId)
            .ToListAsync(cancellationToken);

        var activeReservations = await _context.Reservations
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(r => r.TenantId == tenant.Id &&
                        r.Status != ReservationStatus.Cancelled &&
                        r.Status != ReservationStatus.CheckedOut &&
                        r.Status != ReservationStatus.NoShow)
            .Select(r => r.PropertyId)
            .ToListAsync(cancellationToken);

        var activeStaffCount = await _context.TenantStaffMembers
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(s => s.TenantId == tenant.Id && s.IsActive)
            .Select(s => s.UserId)
            .Distinct()
            .CountAsync(cancellationToken);

        var existingAuditCount = await _context.SupportAuditLogs
            .IgnoreQueryFilters()
            .AsNoTracking()
            .CountAsync(l => l.SupportAccessGrantId == grant.Id, cancellationToken);

        var auditLog = new SupportAuditLog
        {
            Id = Guid.NewGuid(),
            TenantId = tenant.Id,
            SupportAccessGrantId = grant.Id,
            ActorUserId = _currentUser.UserId != Guid.Empty ? _currentUser.UserId : grant.TargetSupportUserId,
            Action = "VIEW_DIAGNOSTICS",
            ResourcePath = resourcePath.Length > 256 ? resourcePath[..256] : resourcePath,
            DetailsJson = JsonSerializer.Serialize(new
            {
                Scope = grant.Scope,
                AccessedAtUtc = now,
                PropertyCount = properties.Count,
                TotalRooms = rooms.Count
            }),
            IpAddress = _currentUser.IpAddress,
            CreatedAtUtc = now,
            UpdatedAtUtc = now
        };

        _context.SupportAuditLogs.Add(auditLog);
        await _context.SaveChangesAsync(cancellationToken);

        var roomsByProp = rooms.GroupBy(id => id).ToDictionary(g => g.Key, g => g.Count());
        var resByProp = activeReservations.GroupBy(id => id).ToDictionary(g => g.Key, g => g.Count());

        var branchDtos = properties.Select(p => new SupportDiagnosticBranchDto(
            p.Id,
            p.Name,
            p.Code,
            p.Status,
            p.IsPublished,
            roomsByProp.TryGetValue(p.Id, out var rc) ? rc : 0,
            resByProp.TryGetValue(p.Id, out var ac) ? ac : 0
        )).ToList();

        return new SupportDiagnosticSnapshotDto(
            grant.Id,
            tenant.Id,
            tenant.Name,
            tenant.Code,
            tenant.Status,
            grant.Scope,
            grant.ExpiresAtUtc,
            properties.Count,
            rooms.Count,
            activeStaffCount,
            existingAuditCount + 1,
            branchDtos);
    }
}
