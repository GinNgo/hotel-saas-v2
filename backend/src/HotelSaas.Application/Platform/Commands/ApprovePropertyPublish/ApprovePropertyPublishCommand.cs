using System;
using System.Text.Json;
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

namespace HotelSaas.Application.Platform.Commands.ApprovePropertyPublish;

public sealed record ApprovePropertyPublishCommand(
    Guid PropertyId,
    bool IsPublished,
    string? Note = null
) : IRequest<ApprovePropertyPublishResultDto>;

public sealed class ApprovePropertyPublishCommandValidator : AbstractValidator<ApprovePropertyPublishCommand>
{
    public ApprovePropertyPublishCommandValidator()
    {
        RuleFor(x => x.PropertyId)
            .NotEmpty().WithMessage("Mã chi nhánh (PropertyId) là bắt buộc.");

        RuleFor(x => x.Note)
            .MaximumLength(500).WithMessage("Ghi chú phê duyệt không được vượt quá 500 ký tự.");
    }
}

public sealed class ApprovePropertyPublishCommandHandler
    : IRequestHandler<ApprovePropertyPublishCommand, ApprovePropertyPublishResultDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserContext _currentUser;
    private readonly IAuditLogService? _auditLogService;

    public ApprovePropertyPublishCommandHandler(
        IApplicationDbContext context,
        ICurrentUserContext currentUser,
        IAuditLogService? auditLogService = null)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _currentUser = currentUser ?? throw new ArgumentNullException(nameof(currentUser));
        _auditLogService = auditLogService;
    }

    public async Task<ApprovePropertyPublishResultDto> Handle(
        ApprovePropertyPublishCommand request,
        CancellationToken cancellationToken)
    {
        if (_currentUser.IsAuthenticated && _currentUser.GlobalRole != GlobalUserRole.SuperAdmin)
        {
            throw new ForbiddenException("ERR_FORBIDDEN", "Chỉ Quản trị viên Nền tảng (SuperAdmin) mới có quyền phê duyệt xuất bản chi nhánh.");
        }

        var property = await _context.Properties
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(p => p.Id == request.PropertyId, cancellationToken);

        if (property == null)
        {
            throw new NotFoundException(nameof(Property), request.PropertyId);
        }

        var previousPublished = property.IsPublished;
        var now = DateTime.UtcNow;
        property.IsPublished = request.IsPublished;
        property.UpdatedAtUtc = now;

        await _context.SaveChangesAsync(cancellationToken);

        try
        {
            var actorId = _currentUser.UserId != Guid.Empty ? (Guid?)_currentUser.UserId : null;
            var oldValues = new { IsPublished = previousPublished };
            var newValues = new { IsPublished = request.IsPublished, Note = request.Note?.Trim() };

            if (_auditLogService != null)
            {
                await _auditLogService.RecordActionExplicitAsync(
                    property.TenantId,
                    property.Id,
                    actorId,
                    AuditActions.Update,
                    "PropertyPublishApproval",
                    property.Id,
                    oldValues,
                    newValues,
                    _currentUser.IpAddress,
                    cancellationToken);
            }
            else
            {
                _context.AuditLogs.Add(new AuditLog
                {
                    Id = Guid.NewGuid(),
                    TenantId = property.TenantId,
                    PropertyId = property.Id,
                    UserId = actorId,
                    Action = AuditActions.Update,
                    EntityName = "PropertyPublishApproval",
                    EntityId = property.Id,
                    OldValues = JsonSerializer.Serialize(oldValues),
                    NewValues = JsonSerializer.Serialize(newValues),
                    IpAddress = _currentUser.IpAddress,
                    CreatedAtUtc = now
                });
                await _context.SaveChangesAsync(cancellationToken);
            }
        }
        catch (NotImplementedException)
        {
            // Optional AuditLogs DbSet in minimal test stubs
        }

        return new ApprovePropertyPublishResultDto(
            property.Id,
            property.TenantId,
            property.Name,
            property.IsPublished,
            now);
    }
}
