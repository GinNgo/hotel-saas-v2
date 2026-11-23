using FluentValidation;

namespace HotelSaas.Application.Public.Commands.CheckExpiredHolds;

/// <summary>
/// Validates <see cref="CheckExpiredHoldsCommand"/> before handler execution.
/// </summary>
public sealed class CheckExpiredHoldsCommandValidator : AbstractValidator<CheckExpiredHoldsCommand>
{
    /// <summary>
    /// Initializes validation rules for expired hold sweep execution.
    /// PropertyId is optional; null or empty triggers a tenant-wide sweep.
    /// </summary>
    public CheckExpiredHoldsCommandValidator()
    {
    }
}
