using System;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using FluentValidation;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.SupportGrants.Commands.CreateSupportGrant;
using HotelSaas.Application.SupportGrants.DTOs;
using HotelSaas.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.SupportGrants.Commands.RevokeSupportGrant;

public sealed record RevokeSupportGrantCommand(
    Guid GrantId,
    string? Reason = null
) : IRequest<SupportAccessGrantDto>;

public sealed class RevokeSupportGrantCommandValidator : AbstractValidator<RevokeSupportGrantCommand>
{
    public RevokeSupportGrantCommandValidator()
    {
        RuleFor(x => x.GrantId)
            .NotEmpty().WithMessage("Mã quyền hỗ trợ (GrantId) là bắt buộc.");

        RuleFor(x => x.Reason)
            .MaximumLength(500).WithMessage("Lý do thu hồi không được vượt quá 500 ký tự.");
    }
}

public sealed class RevokeSupportGrantCommandHandler
    : IRequestHandler<RevokeSupportGrantCommand, SupportAccessGrantDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentTenantService _tenantService;
    private readonly ICurrentUserContext _currentUser;

    public RevokeSupportGrantCommandHandler(
        IApplicationDbContext context,
        ICurrentTenantService tenantService,
        ICurrentUserContext currentUser)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _tenantService = tenantService ?? throw new ArgumentNullException(nameof(tenantService));
        _currentUser = currentUser ?? throw new ArgumentNullException(nameof(currentUser));
    }

    public async Task<SupportAccessGrantDto> Handle(
        RevokeSupportGrantCommand request,
        CancellationToken cancellationToken)
    {
        SupportGrantRules.EnsureTenantOwnerAccess(_currentUser, _tenantService, out var tenantId);

        var grant = await _context.SupportAccessGrants
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(g => g.Id == request.GrantId && g.TenantId == tenantId, cancellationToken);

        if (grant == null)
        {
            throw new NotFoundException(nameof(SupportAccessGrant), request.GrantId);
        }

        var now = DateTime.UtcNow;
        if (!grant.RevokedAtUtc.HasValue)
        {
            grant.RevokedAtUtc = now;
            grant.RevokedByUserId = _currentUser.UserId;
            grant.UpdatedAtUtc = now;

            _context.SupportAuditLogs.Add(new SupportAuditLog
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                SupportAccessGrantId = grant.Id,
                ActorUserId = _currentUser.UserId,
                Action = "GRANT_REVOKED",
                ResourcePath = $"/api/tenants/current/support-grants/{grant.Id}/revoke",
                DetailsJson = JsonSerializer.Serialize(new
                {
                    RevokedAtUtc = now,
                    Reason = string.IsNullOrWhiteSpace(request.Reason) ? "Revoked by tenant owner" : request.Reason.Trim()
                }),
                IpAddress = _currentUser.IpAddress,
                CreatedAtUtc = now,
                UpdatedAtUtc = now
            });

            await _context.SaveChangesAsync(cancellationToken);
        }

        var tenantName = await _context.Tenants
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(t => t.Id == tenantId)
            .Select(t => t.Name)
            .FirstOrDefaultAsync(cancellationToken) ?? string.Empty;

        var users = await _context.Users
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(u => u.Id == grant.GrantedByUserId || u.Id == grant.TargetSupportUserId)
            .Select(u => new { u.Id, u.Email, u.FullName })
            .ToListAsync(cancellationToken);

        var grantedBy = users.FirstOrDefault(u => u.Id == grant.GrantedByUserId);
        var target = users.FirstOrDefault(u => u.Id == grant.TargetSupportUserId);

        return SupportGrantRules.MapToDto(
            grant,
            tenantName,
            grantedBy?.Email ?? _currentUser.Email,
            target?.Email ?? string.Empty,
            target?.FullName ?? "Support Staff",
            now);
    }
}
