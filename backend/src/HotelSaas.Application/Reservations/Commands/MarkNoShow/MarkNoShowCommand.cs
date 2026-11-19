using System;
using FluentValidation;
using HotelSaas.Application.Reservations.DTOs;
using MediatR;

namespace HotelSaas.Application.Reservations.Commands.MarkNoShow;

/// <summary>
/// Marks a Confirmed reservation as NoShow, revoking SmartLock access and recording an audit trail.
/// </summary>
public sealed record MarkNoShowCommand(
    Guid ReservationId,
    Guid PropertyId,
    string? Reason = null
) : IRequest<ReservationDetailDto>;

public sealed class MarkNoShowCommandValidator : AbstractValidator<MarkNoShowCommand>
{
    public MarkNoShowCommandValidator()
    {
        RuleFor(x => x.ReservationId)
            .NotEmpty()
            .WithMessage("Mã đặt phòng là bắt buộc.");

        RuleFor(x => x.PropertyId)
            .NotEmpty()
            .WithMessage("Chi nhánh là bắt buộc.");

        RuleFor(x => x.Reason)
            .MaximumLength(500)
            .WithMessage("Lý do tối đa 500 ký tự.");
    }
}
