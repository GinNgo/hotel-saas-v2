using System;
using System.Threading;
using System.Threading.Tasks;
using FluentValidation;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Platform.DTOs;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Platform.Commands.ToggleTenantStatus;

public sealed record ToggleTenantStatusCommand(
    Guid TenantId,
    TenantStatus? TargetStatus = null,
    string? Reason = null
) : IRequest<ToggleTenantStatusResultDto>;

public sealed class ToggleTenantStatusCommandValidator : AbstractValidator<ToggleTenantStatusCommand>
{
    public ToggleTenantStatusCommandValidator()
    {
        RuleFor(x => x.TenantId)
            .NotEmpty().WithMessage("Mã Tenant là bắt buộc.");

        When(x => x.TargetStatus.HasValue, () =>
        {
            RuleFor(x => x.TargetStatus!.Value)
                .IsInEnum().WithMessage("Trạng thái Tenant không hợp lệ.");
        });

        RuleFor(x => x.Reason)
            .MaximumLength(500).WithMessage("Lý do thay đổi trạng thái không được vượt quá 500 ký tự.");
    }
}

public sealed class ToggleTenantStatusCommandHandler
    : IRequestHandler<ToggleTenantStatusCommand, ToggleTenantStatusResultDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserContext _currentUser;
    private readonly IAuditLogService? _auditLogService;

    public ToggleTenantStatusCommandHandler(
        IApplicationDbContext context,
        ICurrentUserContext currentUser,
        IAuditLogService? auditLogService = null)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _currentUser = currentUser ?? throw new ArgumentNullException(nameof(currentUser));
        _auditLogService = auditLogService;
    }

    public async Task<ToggleTenantStatusResultDto> Handle(
        ToggleTenantStatusCommand request,
        CancellationToken cancellationToken)
    {
        if (_currentUser.IsAuthenticated && _currentUser.GlobalRole != GlobalUserRole.SuperAdmin)
        {
            throw new ForbiddenException("ERR_FORBIDDEN", "Chỉ Quản trị viên Nền tảng (SuperAdmin) mới có quyền thay đổi trạng thái Tenant.");
        }

        var tenant = await _context.Tenants
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(t => t.Id == request.TenantId, cancellationToken);

        if (tenant == null)
        {
            throw new NotFoundException(nameof(Tenant), request.TenantId);
        }

        var previousStatus = tenant.Status;
        var nextStatus = request.TargetStatus ?? (previousStatus == TenantStatus.Active
            ? TenantStatus.Suspended
            : TenantStatus.Active);

        var now = DateTime.UtcNow;
        tenant.Status = nextStatus;
        tenant.UpdatedAtUtc = now;

        await _context.SaveChangesAsync(cancellationToken);

        await TryWriteAuditLogAsync(
            tenant.Id,
            AuditActions.StatusToggle,
            "TenantStatus",
            tenant.Id,
            new { Status = previousStatus.ToString() },
            new { Status = nextStatus.ToString(), Reason = request.Reason?.Trim() },
            cancellationToken);

        return new ToggleTenantStatusResultDto(
            tenant.Id,
            tenant.Name,
            tenant.Status,
            tenant.Status.ToString(),
            now);
    }

    private async Task TryWriteAuditLogAsync(
        Guid tenantId,
        string action,
        string entityName,
        Guid entityId,
        object oldValues,
        object newValues,
        CancellationToken cancellationToken)
    {
        try
        {
            var actorId = _currentUser.UserId != Guid.Empty ? (Guid?)_currentUser.UserId : null;
            if (_auditLogService != null)
            {
                await _auditLogService.RecordActionExplicitAsync(
                    tenantId,
                    null,
                    actorId,
                    action,
                    entityName,
                    entityId,
                    oldValues,
                    newValues,
                    _currentUser.IpAddress,
                    cancellationToken);
                return;
            }

            _context.AuditLogs.Add(new AuditLog
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                PropertyId = null,
                UserId = actorId,
                Action = action,
                EntityName = entityName,
                EntityId = entityId,
                OldValues = System.Text.Json.JsonSerializer.Serialize(oldValues),
                NewValues = System.Text.Json.JsonSerializer.Serialize(newValues),
                IpAddress = _currentUser.IpAddress,
                CreatedAtUtc = DateTime.UtcNow
            });
            await _context.SaveChangesAsync(cancellationToken);
        }
        catch (NotImplementedException)
        {
            // Optional DbSet in isolated minimal test fakes
        }
    }
}
