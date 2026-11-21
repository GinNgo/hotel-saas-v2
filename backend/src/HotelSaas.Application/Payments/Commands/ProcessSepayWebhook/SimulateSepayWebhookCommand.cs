using System;
using System.Globalization;
using System.Linq;
using System.Security.Cryptography;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Reservations.DTOs;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Payments.Commands.ProcessSepayWebhook;

/// <summary>
/// Development-only helper command that constructs a synthetic incoming SePay bank transfer payload
/// from persisted bank configuration and dispatches <see cref="ProcessSepayWebhookCommand"/> for local demos.
/// </summary>
public sealed record SimulateSepayWebhookCommand(
    string? ConfirmationCode,
    string? SubscriptionRef,
    decimal? Amount,
    string? ReferenceCode,
    string? ConfiguredPlatformBankName,
    string? ConfiguredPlatformAccountNumber
) : IRequest<ProcessSepayWebhookResult>;

public sealed class SimulateSepayWebhookCommandHandler
    : IRequestHandler<SimulateSepayWebhookCommand, ProcessSepayWebhookResult>
{
    private readonly IApplicationDbContext _context;
    private readonly ISender _sender;

    public SimulateSepayWebhookCommandHandler(IApplicationDbContext context, ISender sender)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _sender = sender ?? throw new ArgumentNullException(nameof(sender));
    }

    public async Task<ProcessSepayWebhookResult> Handle(
        SimulateSepayWebhookCommand request,
        CancellationToken cancellationToken)
    {
        var syntheticId = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() * 1000L +
                          RandomNumberGenerator.GetInt32(1, 1000);
        var referenceCode = !string.IsNullOrWhiteSpace(request.ReferenceCode)
            ? request.ReferenceCode.Trim()
            : $"SIM{Guid.NewGuid():N}"[..14].ToUpperInvariant();
        var txDate = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture);

        if (!string.IsNullOrWhiteSpace(request.ConfirmationCode))
        {
            var rawCode = request.ConfirmationCode.Trim();
            var extracted = ProcessSepayWebhookCommandHandler.ExtractReservationCodes(rawCode);
            var lookupCodes = extracted
                .Append(rawCode.ToUpperInvariant())
                .SelectMany(c => new[] { c, c.Replace("-", string.Empty, StringComparison.Ordinal) })
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .Select(c => c.ToUpperInvariant())
                .ToList();

            var reservation = await _context.Reservations
                .IgnoreQueryFilters()
                .AsNoTracking()
                .FirstOrDefaultAsync(
                    r => r.ConfirmationCode != null && lookupCodes.Contains(r.ConfirmationCode.ToUpper()),
                    cancellationToken);

            PrintTemplateConfig? bankConfig = null;
            decimal effectiveAmount = request.Amount is > 0m ? request.Amount.Value : 0m;
            var codeForMemo = rawCode.Replace("-", string.Empty, StringComparison.Ordinal)
                                     .Replace(" ", string.Empty, StringComparison.Ordinal)
                                     .ToUpperInvariant();

            if (reservation != null)
            {
                codeForMemo = reservation.ConfirmationCode
                    .Replace("-", string.Empty, StringComparison.Ordinal)
                    .Replace(" ", string.Empty, StringComparison.Ordinal)
                    .ToUpperInvariant();

                var configs = await _context.PrintTemplateConfigs
                    .IgnoreQueryFilters()
                    .AsNoTracking()
                    .Where(c => c.TenantId == reservation.TenantId &&
                                (c.PropertyId == reservation.PropertyId || c.PropertyId == null))
                    .ToListAsync(cancellationToken);

                bankConfig = configs.FirstOrDefault(c => c.PropertyId == reservation.PropertyId)
                    ?? configs.FirstOrDefault(c => c.PropertyId == null);

                if (effectiveAmount <= 0m)
                {
                    var snapshot = ReservationSnapshotHelper.TryDeserialize(reservation.Notes);
                    var required = snapshot?.DepositRequired is > 0m
                        ? snapshot.DepositRequired.Value
                        : reservation.TotalAmount;

                    var existingCompleted = await _context.Payments
                        .IgnoreQueryFilters()
                        .AsNoTracking()
                        .Where(p => p.ReservationId == reservation.Id && p.Status == PaymentStatus.Completed)
                        .ToListAsync(cancellationToken);

                    var existingPaid = existingCompleted
                        .Where(p => p.TransactionRef == null ||
                                    !p.TransactionRef.Contains("REFUND", StringComparison.OrdinalIgnoreCase))
                        .Sum(p => p.Amount);

                    var remaining = required - existingPaid;
                    effectiveAmount = remaining > 0m ? remaining : reservation.TotalAmount;
                }
            }

            var webhookCmd = new ProcessSepayWebhookCommand(
                Id: syntheticId,
                Gateway: !string.IsNullOrWhiteSpace(bankConfig?.BankName) ? bankConfig!.BankName.Trim() : "MBBank",
                TransactionDate: txDate,
                AccountNumber: !string.IsNullOrWhiteSpace(bankConfig?.BankAccountNumber) ? bankConfig!.BankAccountNumber.Trim() : "0999888777",
                SubAccount: null,
                Code: codeForMemo,
                Content: $"DATPHONG {codeForMemo}",
                TransferType: "in",
                Description: $"Simulated SePay webhook for {codeForMemo}",
                TransferAmount: effectiveAmount,
                Accumulated: null,
                ReferenceCode: referenceCode,
                ExpectedPlatformAccountNumber: request.ConfiguredPlatformAccountNumber);

            return await _sender.Send(webhookCmd, cancellationToken);
        }

        if (!string.IsNullOrWhiteSpace(request.SubscriptionRef))
        {
            var rawSubRef = request.SubscriptionRef.Trim();
            SubscriptionPayment? subPayment = null;

            if (Guid.TryParse(rawSubRef, out var parsedPaymentId))
            {
                subPayment = await _context.SubscriptionPayments
                    .IgnoreQueryFilters()
                    .AsNoTracking()
                    .FirstOrDefaultAsync(p => p.Id == parsedPaymentId, cancellationToken);
            }
            else
            {
                var normalizedLookup = ProcessSepayWebhookCommandHandler.NormalizeSubscriptionRef(rawSubRef);
                if (!string.IsNullOrWhiteSpace(normalizedLookup))
                {
                    var candidates = await _context.SubscriptionPayments
                        .IgnoreQueryFilters()
                        .AsNoTracking()
                        .Where(p => p.TransactionRef != null &&
                                    p.TransactionRef.Replace("-", string.Empty).Replace("_", string.Empty).ToUpper().StartsWith(normalizedLookup))
                        .OrderByDescending(p => p.CreatedAtUtc)
                        .Take(10)
                        .ToListAsync(cancellationToken);

                    subPayment = candidates.FirstOrDefault(p =>
                        string.Equals(ProcessSepayWebhookCommandHandler.NormalizeSubscriptionRef(p.TransactionRef),
                                      normalizedLookup,
                                      StringComparison.OrdinalIgnoreCase));
                }
            }

            var normalizedSub = ProcessSepayWebhookCommandHandler.NormalizeSubscriptionRef(
                subPayment?.TransactionRef ?? rawSubRef);
            var effectiveAmount = request.Amount is > 0m
                ? request.Amount.Value
                : (subPayment?.Amount ?? 0m);
            var accountNumber = !string.IsNullOrWhiteSpace(request.ConfiguredPlatformAccountNumber)
                ? request.ConfiguredPlatformAccountNumber.Trim()
                : "0999888777";
            var bankName = !string.IsNullOrWhiteSpace(request.ConfiguredPlatformBankName)
                ? request.ConfiguredPlatformBankName.Trim()
                : "MBBank";

            var webhookCmd = new ProcessSepayWebhookCommand(
                Id: syntheticId,
                Gateway: bankName,
                TransactionDate: txDate,
                AccountNumber: accountNumber,
                SubAccount: null,
                Code: normalizedSub,
                Content: $"NANGCAP {normalizedSub}",
                TransferType: "in",
                Description: $"Simulated SePay subscription webhook for {normalizedSub}",
                TransferAmount: effectiveAmount,
                Accumulated: null,
                ReferenceCode: referenceCode,
                ExpectedPlatformAccountNumber: request.ConfiguredPlatformAccountNumber);

            return await _sender.Send(webhookCmd, cancellationToken);
        }

        return new ProcessSepayWebhookResult("ignored", "Either confirmationCode or subscriptionRef must be provided.");
    }
}
