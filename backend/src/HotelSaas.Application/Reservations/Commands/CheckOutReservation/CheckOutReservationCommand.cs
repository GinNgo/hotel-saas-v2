using System;
using FluentValidation;
using HotelSaas.Application.Reservations.DTOs;
using MediatR;

namespace HotelSaas.Application.Reservations.Commands.CheckOutReservation;

/// <summary>
/// Command to check out a guest from an active reservation, transitioning the reservation to CheckedOut
/// and atomically locking and transitioning the physical room to Dirty.
/// </summary>
/// <param name="ReservationId">The unique identifier of the reservation.</param>
/// <param name="PropertyId">The branch/property identifier.</param>
/// <param name="ApplyLateSurcharge">Whether to evaluate and apply applicable late check-out surcharge.</param>
/// <param name="OverrideLateSurchargeAmount">Manager/Owner override surcharge amount (VND, >= 0).</param>
/// <param name="LateSurchargeOverrideReason">Optional reason recorded in audit logs when overriding late surcharge.</param>
public sealed record CheckOutReservationCommand(
    Guid ReservationId,
    Guid PropertyId,
    bool ApplyLateSurcharge = false,
    decimal? OverrideLateSurchargeAmount = null,
    string? LateSurchargeOverrideReason = null
) : IRequest<ReservationDetailDto>;

public sealed class CheckOutReservationCommandValidator : AbstractValidator<CheckOutReservationCommand>
{
    public CheckOutReservationCommandValidator()
    {
        RuleFor(x => x.ReservationId)
            .NotEmpty()
            .WithMessage("Mã đặt phòng là bắt buộc.");

        RuleFor(x => x.PropertyId)
            .NotEmpty()
            .WithMessage("Chi nhánh là bắt buộc.");

        When(x => x.OverrideLateSurchargeAmount.HasValue, () =>
        {
            RuleFor(x => x.OverrideLateSurchargeAmount!.Value)
                .GreaterThanOrEqualTo(0m)
                .WithMessage("Phụ thu điều chỉnh không được âm.");
        });
    }
}
