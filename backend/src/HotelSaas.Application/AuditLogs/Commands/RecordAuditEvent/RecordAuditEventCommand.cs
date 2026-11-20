using System;
using System.Threading;
using System.Threading.Tasks;
using FluentValidation;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Common.Models;
using HotelSaas.Domain.Enums;
using MediatR;

namespace HotelSaas.Application.AuditLogs.Commands.RecordAuditEvent;

/// <summary>
/// Command to explicitly record an administrative or user action across hotel branches for security and compliance.
/// </summary>
public sealed record RecordAuditEventCommand(
    string Action,
    string EntityName,
    Guid EntityId,
    Guid? PropertyId = null,
    object? OldValues = null,
    object? NewValues = null) : IRequest<ApiResponse<Guid>>;

public sealed class RecordAuditEventCommandValidator : AbstractValidator<RecordAuditEventCommand>
{
    public RecordAuditEventCommandValidator()
    {
        RuleFor(x => x.Action)
            .NotEmpty().WithMessage("Hành động kiểm toán (Action) không được để trống.")
            .MaximumLength(50).WithMessage("Action không được vượt quá 50 ký tự.");

        RuleFor(x => x.EntityName)
            .NotEmpty().WithMessage("Tên đối tượng (EntityName) không được để trống.")
            .MaximumLength(100).WithMessage("EntityName không được vượt quá 100 ký tự.");

        RuleFor(x => x.EntityId)
            .NotEmpty().WithMessage("EntityId không được để trống.");
    }
}

public sealed class RecordAuditEventCommandHandler : IRequestHandler<RecordAuditEventCommand, ApiResponse<Guid>>
{
    private readonly IAuditLogService _auditLogService;
    private readonly ICurrentUserContext? _userContext;

    public RecordAuditEventCommandHandler(
        IAuditLogService auditLogService,
        ICurrentUserContext? userContext = null)
    {
        _auditLogService = auditLogService ?? throw new ArgumentNullException(nameof(auditLogService));
        _userContext = userContext;
    }

    public async Task<ApiResponse<Guid>> Handle(
        RecordAuditEventCommand request,
        CancellationToken cancellationToken)
    {
        if (_userContext is { IsAuthenticated: true } &&
            _userContext.GlobalRole != GlobalUserRole.SuperAdmin &&
            _userContext.StaffRole is not (StaffRole.Owner or StaffRole.Manager))
        {
            throw new ForbiddenException(
                "ERR_FORBIDDEN",
                "Chỉ Chủ khách sạn (Owner) hoặc Quản lý (Manager) mới có quyền ghi nhận sự kiện kiểm toán.");
        }

        var log = await _auditLogService.RecordActionAsync(
            request.Action,
            request.EntityName,
            request.EntityId,
            request.OldValues,
            request.NewValues,
            request.PropertyId,
            cancellationToken);

        return ApiResponse.Ok(log.Id, "Ghi nhận nhật ký kiểm toán hành động thành công.");
    }
}
