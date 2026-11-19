using FluentValidation;

namespace HotelSaas.Application.Ai.Commands.ApplyDynamicPricing;

public sealed class ApplyDynamicPricingCommandValidator : AbstractValidator<ApplyDynamicPricingCommand>
{
    public ApplyDynamicPricingCommandValidator()
    {
        RuleFor(x => x.RoomTypeId)
            .NotEmpty()
            .WithMessage("Vui lòng chọn hạng phòng hợp lệ để áp dụng giá AI.");

        RuleFor(x => x.NightlyPrice)
            .GreaterThan(0)
            .WithMessage("Giá đêm đề xuất phải lớn hơn 0.");

        RuleFor(x => x.EffectiveTo)
            .GreaterThan(x => x.EffectiveFrom!.Value)
            .When(x => x.EffectiveFrom.HasValue && x.EffectiveTo.HasValue)
            .WithMessage("Ngày kết thúc hiệu lực phải lớn hơn ngày bắt đầu.");

        RuleFor(x => x.Currency)
            .MaximumLength(10)
            .When(x => x.Currency != null);

        RuleFor(x => x.ChangeReason)
            .MaximumLength(500)
            .When(x => x.ChangeReason != null);
    }
}
