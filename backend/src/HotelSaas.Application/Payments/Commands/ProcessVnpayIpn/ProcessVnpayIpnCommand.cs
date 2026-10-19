using System;
using System.Collections.Generic;
using System.Security.Cryptography;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Payments.Commands.ProcessVnpayIpn;

/// <summary>
/// Result DTO conforming strictly to VNPay IPN response protocol specification.
/// </summary>
public sealed record VnpayIpnResponseDto(string RspCode, string Message);

/// <summary>
/// Processes asynchronous Server-to-Server IPN notification from VNPay with checksum validation and idempotency.
/// </summary>
public sealed record ProcessVnpayIpnCommand(IDictionary<string, string> QueryParams) : IRequest<VnpayIpnResponseDto>;

public sealed class ProcessVnpayIpnCommandHandler : IRequestHandler<ProcessVnpayIpnCommand, VnpayIpnResponseDto>
{
    private readonly IApplicationDbContext _context;
    private readonly IVnpayPaymentService _vnpayService;

    public ProcessVnpayIpnCommandHandler(
        IApplicationDbContext context,
        IVnpayPaymentService vnpayService)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _vnpayService = vnpayService ?? throw new ArgumentNullException(nameof(vnpayService));
    }

    public async Task<VnpayIpnResponseDto> Handle(ProcessVnpayIpnCommand request, CancellationToken cancellationToken)
    {
        // 1. Verify digital signature (HMAC-SHA512)
        var verify = _vnpayService.VerifyCallback(request.QueryParams);
        if (verify.ResponseCode == "97" || !verify.IsValid && string.IsNullOrEmpty(verify.TxnRef))
        {
            return new VnpayIpnResponseDto("97", "Invalid Checksum");
        }

        if (string.IsNullOrWhiteSpace(verify.TxnRef))
        {
            return new VnpayIpnResponseDto("01", "Order not found");
        }

        // 2. Locate reservation by TxnRef (ConfirmationCode or Id)
        var reservation = await _context.Reservations
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(r => r.ConfirmationCode == verify.TxnRef || r.Id.ToString() == verify.TxnRef, cancellationToken);

        if (reservation == null)
        {
            return new VnpayIpnResponseDto("01", "Order not found");
        }

        // 3. Row lock on reservation to prevent concurrent IPN races
        await _context.LockReservationRowAsync(reservation.Id, reservation.TenantId, reservation.PropertyId, cancellationToken);

        // 4. Check for already completed transaction (Idempotency)
        var existingCompletedPayment = await _context.Payments
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(p => p.ReservationId == reservation.Id &&
                                     p.Method == PaymentMethod.VNPay &&
                                     p.TransactionRef == verify.TransactionNo &&
                                     p.Status == PaymentStatus.Completed,
                                 cancellationToken);

        if (existingCompletedPayment != null || reservation.Status == ReservationStatus.Confirmed)
        {
            return new VnpayIpnResponseDto("02", "Order already confirmed");
        }

        // 5. Validate amount (tolerance 100 VND for rounding)
        if (Math.Abs(reservation.TotalAmount - verify.Amount) > 100m && verify.Amount < reservation.TotalAmount * 0.2m)
        {
            return new VnpayIpnResponseDto("04", "Invalid amount");
        }

        // 6. Process successful transaction
        if (verify.IsValid)
        {
            var payment = new Payment
            {
                Id = Guid.NewGuid(),
                TenantId = reservation.TenantId,
                PropertyId = reservation.PropertyId,
                ReservationId = reservation.Id,
                Amount = verify.Amount,
                Method = PaymentMethod.VNPay,
                Status = PaymentStatus.Completed,
                TransactionRef = verify.TransactionNo ?? $"VNP-{Guid.NewGuid():N}",
                PaidAtUtc = DateTime.UtcNow
            };

            _context.Payments.Add(payment);

            // Update reservation status
            reservation.Status = ReservationStatus.Confirmed;

            // Generate Simulated IoT Smart Lock 6-Digit PIN
            var randomPin = RandomNumberGenerator.GetInt32(100000, 999999).ToString();
            reservation.SmartLockPin = randomPin;
            reservation.SmartLockStatus = "Active";
            reservation.SmartLockActivatedAtUtc = DateTime.UtcNow;

            await _context.SaveChangesAsync(cancellationToken);

            return new VnpayIpnResponseDto("00", "Confirm Success");
        }
        else
        {
            // Record failed attempt
            var failedPayment = new Payment
            {
                Id = Guid.NewGuid(),
                TenantId = reservation.TenantId,
                PropertyId = reservation.PropertyId,
                ReservationId = reservation.Id,
                Amount = verify.Amount,
                Method = PaymentMethod.VNPay,
                Status = PaymentStatus.Failed,
                TransactionRef = verify.TransactionNo ?? $"FAIL-{Guid.NewGuid():N}",
                PaidAtUtc = null
            };

            _context.Payments.Add(failedPayment);
            await _context.SaveChangesAsync(cancellationToken);

            return new VnpayIpnResponseDto("00", "Confirm Success");
        }
    }
}
