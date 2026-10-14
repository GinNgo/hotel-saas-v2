using System;
using System.Linq;
using FluentValidation;
using HotelSaas.Domain.Enums;

namespace HotelSaas.Application.Properties.Commands.UpdatePropertyPolicies;

/// <summary>
/// Validator for branch policy configuration updates enforcing buffer and hourly duration constraints.
/// </summary>
public sealed class UpdatePropertyPoliciesCommandValidator : AbstractValidator<UpdatePropertyPoliciesCommand>
{
    public UpdatePropertyPoliciesCommandValidator()
    {
        RuleFor(x => x.PropertyId)
            .NotEmpty()
            .WithMessage("PropertyId không được để trống.");

        When(x => x.BufferMinutes.HasValue, () =>
        {
            RuleFor(x => x.BufferMinutes!.Value)
                .GreaterThanOrEqualTo(30)
                .WithErrorCode("ERR_BUFFER_TOO_SHORT")
                .WithMessage("Thời gian dọn phòng (turnover buffer) tối thiểu phải từ 30 phút trở lên.");
        });

        When(x => x.MaxHourlyHours.HasValue, () =>
        {
            RuleFor(x => x.MaxHourlyHours!.Value)
                .InclusiveBetween(1, 24)
                .WithErrorCode("ERR_INVALID_HOURLY_LIMIT")
                .WithMessage("Giới hạn thời gian thuê theo giờ phải từ 1 đến 24 giờ.");
        });

        When(x => x.Surcharges != null && x.Surcharges.Count > 0, () =>
        {
            RuleForEach(x => x.Surcharges).SetValidator(new UpdateSurchargeItemValidator());

            RuleFor(x => x.Surcharges!)
                .Custom((surcharges, context) =>
                {
                    // Check for overlapping intervals per SurchargeType
                    var activeItems = surcharges.Where(s => s.IsActive).ToList();
                    var groups = activeItems.GroupBy(s => s.SurchargeType);

                    foreach (var group in groups)
                    {
                        var list = group.OrderBy(s => s.FromTime).ToList();
                        for (int i = 0; i < list.Count - 1; i++)
                        {
                            var current = list[i];
                            var next = list[i + 1];

                            if (current.ToTime > next.FromTime)
                            {
                                context.AddFailure("Surcharges",
                                    $"Khung giờ phụ thu {current.SurchargeType} ({current.FromTime}-{current.ToTime}) bị chồng lấn với ({next.FromTime}-{next.ToTime}).");
                            }
                        }
                    }
                });
        });
    }
}

public sealed class UpdateSurchargeItemValidator : AbstractValidator<UpdateSurchargeItemCommand>
{
    public UpdateSurchargeItemValidator()
    {
        RuleFor(x => x.ToTime)
            .GreaterThan(x => x.FromTime)
            .WithMessage("Giờ kết thúc phụ thu phải lớn hơn giờ bắt đầu.");

        When(x => x.CalculationMethod == SurchargeCalculationMethod.PercentageOfNightly, () =>
        {
            RuleFor(x => x.Percentage)
                .NotNull()
                .GreaterThan(0)
                .LessThanOrEqualTo(100)
                .WithErrorCode("ERR_INVALID_SURCHARGE_VALUE")
                .WithMessage("Phụ thu theo phần trăm phải lớn hơn 0% và không vượt quá 100%.");
        });

        When(x => x.CalculationMethod == SurchargeCalculationMethod.FlatAmount, () =>
        {
            RuleFor(x => x.FlatAmount)
                .NotNull()
                .GreaterThanOrEqualTo(0)
                .WithErrorCode("ERR_INVALID_SURCHARGE_VALUE")
                .WithMessage("Số tiền phụ thu cố định không được âm.");
        });
    }
}
