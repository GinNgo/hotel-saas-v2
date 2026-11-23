using FluentValidation;

namespace HotelSaas.Application.Subscriptions.Commands.ConfirmSubscriptionPayment;

/// <summary>
/// Validates <see cref="ProcessSubscriptionVnpayIpnCommand"/> registration in the MediatR pipeline.
/// Checksum and parameter verification are delegated to <c>IVnpayPaymentService.VerifyCallback</c>
/// so invalid or tampered IPN requests return VNPay protocol <c>RspCode = "97"</c> / <c>"99"</c>
/// rather than HTTP 400 validation failures.
/// </summary>
public sealed class ProcessSubscriptionVnpayIpnCommandValidator
    : AbstractValidator<ProcessSubscriptionVnpayIpnCommand>
{
    /// <summary>
    /// Initializes validation rules for subscription VNPay IPN processing.
    /// </summary>
    public ProcessSubscriptionVnpayIpnCommandValidator()
    {
    }
}
