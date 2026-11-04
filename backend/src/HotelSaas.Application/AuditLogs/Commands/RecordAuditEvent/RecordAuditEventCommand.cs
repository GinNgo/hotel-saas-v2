using System;
using System.Threading;
using System.Threading.Tasks;
using FluentValidation;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Common.Models;
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

    public RecordAuditEventCommandHandler(IAuditLogService auditLogService)
    {
        _auditLogService = auditLogService ?? throw new ArgumentNullException(nameof(auditLogService));
    }

    public async Task<ApiResponse<Guid>> Handle(
        RecordAuditEventCommand request,
        CancellationToken cancellationToken)
    {
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
