using System;
using FluentValidation;

namespace HotelSaas.Application.AuditLogs.Queries.GetAuditLogById;

/// <summary>
/// Validator for <see cref="GetAuditLogByIdQuery"/>.
/// </summary>
public sealed class GetAuditLogByIdQueryValidator : AbstractValidator<GetAuditLogByIdQuery>
{
    public GetAuditLogByIdQueryValidator()
    {
        RuleFor(x => x.Id)
            .NotEmpty()
            .WithMessage("Mã bản ghi nhật ký kiểm toán (id) không được để trống.");
    }
}

