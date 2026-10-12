using System;
using FluentValidation;

namespace HotelSaas.Application.RoomTypes.Commands.CreateRoomTypeRate;

/// <summary>
/// Validator for CreateRoomTypeRateCommand ensuring valid price, package hours, and date intervals.
/// </summary>
public sealed class CreateRoomTypeRateCommandValidator : AbstractValidator<CreateRoomTypeRateCommand>
{
    public CreateRoomTypeRateCommandValidator()
    {
        RuleFor(x => x.RoomTypeId)
            .NotEmpty()
            .WithMessage("RoomTypeId không được để trống.");

        RuleFor(x => x.FirstHours)
            .GreaterThan(0)
            .WithMessage("Số giờ gói đầu tiên phải lớn hơn 0.");

        RuleFor(x => x.FirstHoursPrice)
            .GreaterThanOrEqualTo(0)
            .WithMessage("Giá gói giờ đầu không được âm.");

        RuleFor(x => x.AdditionalHourPrice)
            .GreaterThanOrEqualTo(0)
            .WithMessage("Giá mỗi giờ thêm không được âm.");

        RuleFor(x => x.NightlyPrice)
            .GreaterThanOrEqualTo(0)
            .WithMessage("Giá thuê qua đêm không được âm.");

        RuleFor(x => x.EffectiveTo)
            .GreaterThan(x => x.EffectiveFrom)
            .WithErrorCode("ERR_INVALID_DURATION")
            .WithMessage("Ngày kết thúc hiệu lực (EffectiveTo) phải lớn hơn ngày bắt đầu (EffectiveFrom).");
    }
}
