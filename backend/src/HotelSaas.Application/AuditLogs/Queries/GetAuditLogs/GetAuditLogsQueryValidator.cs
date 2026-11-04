using System;
using FluentValidation;
using HotelSaas.Domain.Entities;

namespace HotelSaas.Application.AuditLogs.Queries.GetAuditLogs;

/// <summary>
/// Validator for <see cref="GetAuditLogsQuery"/> enforcing pagination bounds, valid action filters, and date interval ordering.
/// </summary>
public sealed class GetAuditLogsQueryValidator : AbstractValidator<GetAuditLogsQuery>
{
    public GetAuditLogsQueryValidator()
    {
        RuleFor(x => x.Page)
            .GreaterThanOrEqualTo(1)
            .WithMessage("Số trang (page) phải lớn hơn hoặc bằng 1.");

        RuleFor(x => x.PageSize)
            .InclusiveBetween(1, 100)
            .WithMessage("Kích thước trang (pageSize) phải nằm trong khoảng từ 1 đến 100.");

        RuleFor(x => x.Action)
            .Must(BeValidActionOrEmpty)
            .WithMessage("Hành động lọc (action) chỉ chấp nhận Create, Update hoặc Delete.");

        RuleFor(x => x.EntityName)
            .MaximumLength(128)
            .When(x => !string.IsNullOrWhiteSpace(x.EntityName))
            .WithMessage("Tên thực thể (entityName) không được vượt quá 128 ký tự.");

        RuleFor(x => x)
            .Must(x => !x.FromUtc.HasValue || !x.ToUtc.HasValue || NormalizeUtc(x.FromUtc.Value) <= NormalizeUtc(x.ToUtc.Value))
            .WithMessage("Thời gian bắt đầu (fromUtc) không được lớn hơn thời gian kết thúc (toUtc).");
    }

    private static bool BeValidActionOrEmpty(string? action)
    {
        if (string.IsNullOrWhiteSpace(action))
        {
            return true;
        }

        var trimmed = action.Trim();
        return string.Equals(trimmed, AuditActions.Create, StringComparison.OrdinalIgnoreCase) ||
               string.Equals(trimmed, AuditActions.Update, StringComparison.OrdinalIgnoreCase) ||
               string.Equals(trimmed, AuditActions.Delete, StringComparison.OrdinalIgnoreCase);
    }

    private static DateTime NormalizeUtc(DateTime dt)
    {
        return dt.Kind switch
        {
            DateTimeKind.Utc => dt,
            DateTimeKind.Local => dt.ToUniversalTime(),
            _ => DateTime.SpecifyKind(dt, DateTimeKind.Utc)
        };
    }
}

