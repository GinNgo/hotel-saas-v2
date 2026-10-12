using System;
using FluentValidation;
using HotelSaas.Domain.Enums;

namespace HotelSaas.Application.Reservations.Commands.CreateReservation;

/// <summary>
/// Validator for CreateReservationCommand enforcing input shape and time boundaries.
/// </summary>
public sealed class CreateReservationCommandValidator : AbstractValidator<CreateReservationCommand>
{
    public CreateReservationCommandValidator()
    {
        RuleFor(x => x.PropertyId)
            .NotEmpty()
            .WithMessage("Mã chi nhánh không được để trống.");

        RuleFor(x => x.RoomId)
            .NotEmpty()
            .WithMessage("Mã phòng không được để trống.");

        RuleFor(x => x.RentalType)
            .IsInEnum()
            .WithMessage("Hình thức thuê phòng không hợp lệ.");

        RuleFor(x => x.StartAtUtc)
            .NotEmpty()
            .WithMessage("Thời điểm bắt đầu không được để trống.");

        RuleFor(x => x.EndAtUtc)
            .NotEmpty()
            .WithMessage("Thời điểm kết thúc không được để trống.")
            .GreaterThan(x => x.StartAtUtc)
            .WithMessage("Thời điểm kết thúc phải sau thời điểm bắt đầu.");

        When(x => x.RentalType == RentalType.Hourly, () =>
        {
            RuleFor(x => x)
                .Must(x => (x.EndAtUtc - x.StartAtUtc).TotalHours >= 1.0)
                .WithMessage("Thời lượng thuê theo giờ tối thiểu là 1 giờ.")
                .Must(x => (x.EndAtUtc - x.StartAtUtc).TotalHours <= 24.0)
                .WithMessage("Thời lượng thuê theo giờ tối đa không vượt quá 24 giờ.");
        });

        When(x => x.RentalType == RentalType.Overnight && x.CheckInDate.HasValue && x.CheckOutDate.HasValue, () =>
        {
            RuleFor(x => x)
                .Must(x => x.CheckOutDate!.Value > x.CheckInDate!.Value)
                .WithMessage("Ngày trả phòng phải sau ngày nhận phòng.");
        });

        RuleFor(x => x.GuestName)
            .NotEmpty()
            .WithMessage("Tên khách hàng không được để trống.")
            .MaximumLength(200)
            .WithMessage("Tên khách hàng không vượt quá 200 ký tự.");

        RuleFor(x => x.GuestEmail)
            .NotEmpty()
            .WithMessage("Email khách hàng không được để trống.")
            .EmailAddress()
            .WithMessage("Email khách hàng không đúng định dạng.")
            .MaximumLength(255)
            .WithMessage("Email không vượt quá 255 ký tự.");

        RuleFor(x => x.NumberOfGuests)
            .GreaterThan(0)
            .WithMessage("Số lượng khách phải lớn hơn 0.")
            .LessThanOrEqualTo(20)
            .WithMessage("Số lượng khách tối đa là 20.");

        When(x => x.ExpectedTotalAmount.HasValue, () =>
        {
            RuleFor(x => x.ExpectedTotalAmount!.Value)
                .GreaterThanOrEqualTo(0)
                .WithMessage("Tổng tiền dự kiến không được âm.");
        });

        RuleFor(x => x.IdempotencyKey)
            .MaximumLength(100)
            .WithMessage("Khóa IdempotencyKey không vượt quá 100 ký tự.");
    }
}
