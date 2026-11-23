using FluentValidation;

namespace HotelSaas.Application.Payments.Commands.ProcessVnpayIpn;

/// <summary>
/// Validates <see cref="ProcessVnpayIpnCommand"/> registration in the MediatR pipeline.
/// Checksum and parameter verification are delegated to <c>IVnpayPaymentService.VerifyCallback</c>
/// so invalid or tampered IPN requests return VNPay protocol <c>RspCode = "97"</c> / <c>"99"</c>
/// rather than HTTP 400 validation failures.
/// </summary>
public sealed class ProcessVnpayIpnCommandValidator : AbstractValidator<ProcessVnpayIpnCommand>
{
    /// <summary>
    /// Initializes validation rules for reservation VNPay IPN processing.
    /// </summary>
    public ProcessVnpayIpnCommandValidator()
    {
    }
}
