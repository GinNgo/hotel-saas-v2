using FluentValidation;

namespace HotelSaas.Application.Auth.Commands.SwitchContext;

/// <summary>
/// Validates <see cref="SwitchContextCommand"/> registration in the MediatR pipeline.
/// </summary>
public sealed class SwitchContextCommandValidator : AbstractValidator<SwitchContextCommand>
{
    /// <summary>
    /// Initializes validation rules for context switching.
    /// PropertyId is optional; null or empty switches to Tenant-Wide HQ scope.
    /// </summary>
    public SwitchContextCommandValidator()
    {
    }
}
