using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Reservations.DTOs;
using HotelSaas.Application.Subscriptions.Commands.ConfirmSubscriptionPayment;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace HotelSaas.Application.Payments.Commands.ProcessSepayWebhook;

/// <summary>
/// Result returned after processing an incoming SePay bank transfer webhook notification.
/// </summary>
public sealed record ProcessSepayWebhookResult(
    string Status,
    string Message,
    Guid? PaymentId = null,
    Guid? ReservationId = null,
    Guid? SubscriptionPaymentId = null);

/// <summary>
/// Processes an authenticated SePay bank transfer webhook event for either a hotel reservation (<c>RES*</c>)
/// or a tenant SaaS subscription upgrade (<c>SUB*</c>) with idempotency, row locking, and fail-closed guards.
/// </summary>
public sealed record ProcessSepayWebhookCommand(
    long Id,
    string? Gateway,
    string? TransactionDate,
    string? AccountNumber,
    string? SubAccount,
    string? Code,
    string? Content,
    string? TransferType,
    string? Description,
    decimal TransferAmount,
    decimal? Accumulated,
    string? ReferenceCode,
    string? ExpectedPlatformAccountNumber = null,
    bool? RequireBankAccountMatch = null,
    string? ProvidedApiKey = null,
    bool IsGlobalApiKeyMatched = true,
    Guid? RoutePropertyId = null
) : IRequest<ProcessSepayWebhookResult>;

public sealed class ProcessSepayWebhookCommandHandler
    : IRequestHandler<ProcessSepayWebhookCommand, ProcessSepayWebhookResult>
{
    private const decimal RoundingToleranceVnd = 100m;

    // Matches RES-ABC123, RES_ABC123, RES ABC123, RESABC123 without falsely matching longer words like RESERVATION.
    private static readonly Regex ReservationCodeRegex = new(
        @"RES[-_\s]?([A-Z0-9]{6})(?![A-Z0-9])",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    // Matches SUB_2_1_A1B2C3D4E5, SUB21A1B2C3D4E5, SUB-2-1-A1B2C3D4E5, SUB 21A1B2C3D4E5.
    private static readonly Regex SubscriptionCodeRegex = new(
        @"SUB[-_\s]?([A-Z0-9_-]{6,32})",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private readonly IApplicationDbContext _context;
    private readonly ICurrentTenantService? _tenantService;
    private readonly ICurrentPropertyService? _propertyService;
    private readonly INotificationDispatcher? _notificationDispatcher;
    private readonly ILogger<ProcessSepayWebhookCommandHandler>? _logger;
    private readonly ISystemMetricsRecorder? _metricsRecorder;

    public ProcessSepayWebhookCommandHandler(
        IApplicationDbContext context,
        ICurrentTenantService? tenantService = null,
        ICurrentPropertyService? propertyService = null,
        INotificationDispatcher? notificationDispatcher = null,
        ILogger<ProcessSepayWebhookCommandHandler>? logger = null,
        ISystemMetricsRecorder? metricsRecorder = null)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _tenantService = tenantService;
        _propertyService = propertyService;
        _notificationDispatcher = notificationDispatcher;
        _logger = logger;
        _metricsRecorder = metricsRecorder;
    }

    public async Task<ProcessSepayWebhookResult> Handle(
        ProcessSepayWebhookCommand request,
        CancellationToken cancellationToken)
    {
        var result = await HandleCoreAsync(request, cancellationToken);
        if (!string.Equals(result.Status, "unauthorized", StringComparison.OrdinalIgnoreCase))
        {
            _metricsRecorder?.RecordSepayWebhook(result.Status);
        }

        return result;
    }

    private async Task<ProcessSepayWebhookResult> HandleCoreAsync(
        ProcessSepayWebhookCommand request,
        CancellationToken cancellationToken)
    {
        if (!string.Equals(request.TransferType?.Trim(), "in", StringComparison.OrdinalIgnoreCase))
        {
            return await EnsureAuthorizedOrIgnoreAsync(request, "Ignored non-incoming bank transfer.", cancellationToken);
        }

        if (request.TransferAmount <= 0m)
        {
            return await EnsureAuthorizedOrIgnoreAsync(request, "Ignored non-positive transfer amount.", cancellationToken);
        }

        if (request.Id <= 0)
        {
            return await EnsureAuthorizedOrIgnoreAsync(request, "Ignored webhook with invalid SePay transaction id.", cancellationToken);
        }

        var reservationCodes = ExtractReservationCodes(request.Code, request.Content, request.Description);
        var subscriptionRefs = ExtractSubscriptionRefs(request.Code, request.Content, request.Description);

        if (reservationCodes.Count == 0 && subscriptionRefs.Count == 0)
        {
            return await EnsureAuthorizedOrIgnoreAsync(request, "No recognizable reservation (RES) or subscription (SUB) code found.", cancellationToken);
        }

        // 1. Attempt reservation match first when RES* token(s) are present
        if (reservationCodes.Count > 0)
        {
            var lookupCodes = reservationCodes
                .SelectMany(code => new[] { code, code.Replace("-", string.Empty, StringComparison.Ordinal) })
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .Select(c => c.ToUpperInvariant())
                .ToList();

            var resHeader = await _context.Reservations
                .IgnoreQueryFilters()
                .AsNoTracking()
                .Where(r => r.ConfirmationCode != null && lookupCodes.Contains(r.ConfirmationCode.ToUpper()))
                .Select(r => new ReservationHeader(r.Id, r.TenantId, r.PropertyId, r.RoomId, r.ConfirmationCode))
                .FirstOrDefaultAsync(cancellationToken);

            if (resHeader != null)
            {
                return await HandleReservationTransferAsync(request, resHeader, cancellationToken);
            }
        }

        // 2. Attempt subscription upgrade match when SUB* token(s) are present
        if (subscriptionRefs.Count > 0)
        {
            if (!request.IsGlobalApiKeyMatched)
            {
                return new ProcessSepayWebhookResult("unauthorized", "Invalid platform SePay API key.");
            }

            var subPaymentHeader = await FindMatchingSubscriptionPaymentAsync(subscriptionRefs, cancellationToken);
            if (subPaymentHeader != null)
            {
                return await HandleSubscriptionTransferAsync(request, subPaymentHeader, cancellationToken);
            }
        }

        return await EnsureAuthorizedOrIgnoreAsync(request, "No matching reservation or subscription payment found for transfer memo.", cancellationToken);
    }

    private async Task<ProcessSepayWebhookResult> HandleReservationTransferAsync(
        ProcessSepayWebhookCommand request,
        ReservationHeader resHeader,
        CancellationToken cancellationToken)
    {
        // Validate destination bank account against configured property/tenant PrintTemplateConfig when present
        var configs = await _context.PrintTemplateConfigs
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(c => c.TenantId == resHeader.TenantId &&
                        (c.PropertyId == resHeader.PropertyId || c.PropertyId == null))
            .ToListAsync(cancellationToken);

        var bankConfig = configs.FirstOrDefault(c => c.PropertyId == resHeader.PropertyId)
            ?? configs.FirstOrDefault(c => c.PropertyId == null);

        if (!request.IsGlobalApiKeyMatched)
        {
            if (string.IsNullOrWhiteSpace(bankConfig?.SepayApiKey) ||
                !ConstantTimeEquals(request.ProvidedApiKey, bankConfig.SepayApiKey))
            {
                return new ProcessSepayWebhookResult("unauthorized", "Invalid SePay API key for property.");
            }
        }

        if (request.RoutePropertyId.HasValue &&
            request.RoutePropertyId.Value != Guid.Empty &&
            resHeader.PropertyId != request.RoutePropertyId.Value)
        {
            _logger?.LogWarning(
                "SePay webhook {SepayId} ignored: reservation {ConfirmationCode} (PropertyId={ReservationPropertyId}) does not belong to route PropertyId={RoutePropertyId}.",
                request.Id,
                resHeader.ConfirmationCode,
                resHeader.PropertyId,
                request.RoutePropertyId.Value);

            return new ProcessSepayWebhookResult("ignored", "Reservation does not belong to the webhook route propertyId.");
        }

        var configuredBankAccount = bankConfig?.BankAccountNumber;
        var hasConfiguredBankAccount = !string.IsNullOrWhiteSpace(configuredBankAccount) &&
                                       !string.IsNullOrEmpty(ExtractDigitsOnly(configuredBankAccount));

        if (!hasConfiguredBankAccount)
        {
            if (ShouldRequireConfiguredBankAccount(request))
            {
                _logger?.LogWarning(
                    "SePay webhook {SepayId} rejected (fail-closed): no destination bank account configured in PrintTemplateConfig for reservation {ConfirmationCode} (TenantId={TenantId}, PropertyId={PropertyId}).",
                    request.Id,
                    resHeader.ConfirmationCode,
                    resHeader.TenantId,
                    resHeader.PropertyId);

                await TryWriteBankConfigAuditWarningAsync(
                    tenantId: resHeader.TenantId,
                    propertyId: resHeader.PropertyId,
                    entityId: resHeader.Id,
                    targetType: "Reservation",
                    reference: resHeader.ConfirmationCode,
                    request: request,
                    reason: "Destination bank account is not configured in PrintTemplateConfig.",
                    cancellationToken: cancellationToken);

                return new ProcessSepayWebhookResult(
                    "rejected_unconfigured_bank_account",
                    "Destination bank account is not configured; webhook rejected (fail-closed).",
                    ReservationId: resHeader.Id);
            }
        }
        else if (!IsAccountNumberMatch(configuredBankAccount!, request.AccountNumber, request.SubAccount))
        {
            _logger?.LogWarning(
                "SePay webhook {SepayId} ignored: bank account mismatch for reservation {ConfirmationCode}.",
                request.Id,
                resHeader.ConfirmationCode);

            return new ProcessSepayWebhookResult("ignored", "Destination bank account number mismatch.");
        }

        var sepayKey = $"SEPAY-{request.Id}";
        var sepayPrefix = sepayKey + "|";

        await using var tx = await _context.BeginTransactionAsync(cancellationToken);

        // Establish tenant and property context for interceptors and change tracking
        if (_tenantService != null)
        {
            _tenantService.TenantId = resHeader.TenantId;
        }

        if (_propertyService != null)
        {
            _propertyService.PropertyId = resHeader.PropertyId;
            _propertyService.IsTenantWide = false;
            _propertyService.HeaderPropertyId = null;
        }

        // Serialize concurrent retries for the same SePay transaction id
        await _context.LockIdempotencyKeyAsync(resHeader.PropertyId, sepayKey, cancellationToken);

        var alreadyProcessed = await _context.Payments
            .IgnoreQueryFilters()
            .AnyAsync(p => p.TransactionRef != null &&
                           (p.TransactionRef == sepayKey || p.TransactionRef.StartsWith(sepayPrefix)),
                      cancellationToken);

        if (alreadyProcessed)
        {
            await tx.CommitAsync(cancellationToken);
            return new ProcessSepayWebhookResult(
                "duplicate",
                $"SePay transaction {sepayKey} was already processed.",
                ReservationId: resHeader.Id);
        }

        // Acquire Room lock first, then Reservation lock (matches CreatePaymentCommandHandler hierarchy to avoid deadlocks)
        if (resHeader.RoomId != Guid.Empty)
        {
            await _context.LockRoomRowAsync(resHeader.RoomId, resHeader.TenantId, resHeader.PropertyId, cancellationToken);
        }

        await _context.LockReservationRowAsync(resHeader.Id, resHeader.TenantId, resHeader.PropertyId, cancellationToken);

        var reservation = await _context.Reservations
            .IgnoreQueryFilters()
            .Include(r => r.Payments)
            .FirstOrDefaultAsync(r => r.Id == resHeader.Id, cancellationToken);

        if (reservation == null)
        {
            await tx.CommitAsync(cancellationToken);
            return new ProcessSepayWebhookResult("ignored", "Reservation not found under lock.");
        }

        // Re-check idempotency under reservation lock
        if (reservation.Payments.Any(p => p.TransactionRef != null &&
            (p.TransactionRef.Equals(sepayKey, StringComparison.Ordinal) ||
             p.TransactionRef.StartsWith(sepayPrefix, StringComparison.Ordinal))))
        {
            await tx.CommitAsync(cancellationToken);
            return new ProcessSepayWebhookResult(
                "duplicate",
                $"SePay transaction {sepayKey} was already processed.",
                ReservationId: reservation.Id);
        }

        var nowUtc = DateTime.UtcNow;
        var snapshot = ReservationSnapshotHelper.TryDeserialize(reservation.Notes);

        var isTerminalStatus = reservation.Status is ReservationStatus.Cancelled
            or ReservationStatus.NoShow
            or ReservationStatus.CheckedOut;

        var isExpiredHold = reservation.Status == ReservationStatus.PendingPayment &&
            snapshot != null &&
            (snapshot.IsOnlineHold
                ? (!snapshot.HoldExpiresAtUtc.HasValue || snapshot.HoldExpiresAtUtc.Value <= nowUtc)
                : (snapshot.HoldExpiresAtUtc.HasValue && snapshot.HoldExpiresAtUtc.Value <= nowUtc));

        if (isTerminalStatus || isExpiredHold)
        {
            _logger?.LogWarning(
                "SePay late transfer alert: {SepayKey} received {Amount} VND for reservation {ConfirmationCode} (Status={Status}, ExpiredHold={IsExpiredHold}). Room was NOT revived.",
                sepayKey,
                request.TransferAmount,
                reservation.ConfirmationCode,
                reservation.Status,
                isExpiredHold);

            try
            {
                _context.AuditLogs.Add(new AuditLog
                {
                    Id = Guid.NewGuid(),
                    TenantId = reservation.TenantId,
                    PropertyId = reservation.PropertyId,
                    UserId = null,
                    Action = AuditActions.Create,
                    EntityName = "SepayExpiredHoldAlert",
                    EntityId = reservation.Id,
                    NewValues = JsonSerializer.Serialize(new
                    {
                        SepayKey = sepayKey,
                        ReferenceCode = request.ReferenceCode,
                        Gateway = request.Gateway,
                        Amount = request.TransferAmount,
                        ConfirmationCode = reservation.ConfirmationCode,
                        ReservationStatus = reservation.Status.ToString(),
                        IsExpiredHold = isExpiredHold,
                        Content = request.Content
                    }),
                    CreatedAtUtc = nowUtc
                });

                await _context.SaveChangesAsync(cancellationToken);
            }
            catch (NotImplementedException)
            {
                // Optional DbSet in isolated unit test fakes
            }

            await tx.CommitAsync(cancellationToken);
            return new ProcessSepayWebhookResult(
                "expired_hold_alert",
                $"Received transfer for inactive or expired reservation {reservation.ConfirmationCode}. Room was not revived; staff review required.",
                ReservationId: reservation.Id);
        }

        // Compute existing completed non-refund paid amount directly from Payments DbSet
        var existingPayments = await _context.Payments
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(p => p.ReservationId == reservation.Id && p.Status == PaymentStatus.Completed)
            .ToListAsync(cancellationToken);

        var existingPaid = existingPayments
            .Where(p => p.TransactionRef == null ||
                        !p.TransactionRef.Contains("REFUND", StringComparison.OrdinalIgnoreCase))
            .Sum(p => p.Amount);

        var totalPaid = existingPaid + request.TransferAmount;

        var payment = new Payment
        {
            Id = Guid.NewGuid(),
            TenantId = reservation.TenantId,
            PropertyId = reservation.PropertyId,
            ReservationId = reservation.Id,
            Amount = request.TransferAmount,
            Method = PaymentMethod.BankTransfer,
            Status = PaymentStatus.Completed,
            TransactionRef = BuildSepayTransactionRef(sepayKey, request.ReferenceCode, request.Gateway, request.Content, request.Id),
            PaidAtUtc = nowUtc,
            CreatedAtUtc = nowUtc,
            UpdatedAtUtc = nowUtc
        };

        _context.Payments.Add(payment);

        var requiredAmount = snapshot?.DepositRequired is > 0m
            ? snapshot.DepositRequired.Value
            : reservation.TotalAmount;

        if (totalPaid < requiredAmount - RoundingToleranceVnd)
        {
            await _context.SaveChangesAsync(cancellationToken);
            await tx.CommitAsync(cancellationToken);

            return new ProcessSepayWebhookResult(
                "partial",
                $"Partial transfer of {request.TransferAmount:N0} VND recorded ({totalPaid:N0}/{requiredAmount:N0} VND required).",
                PaymentId: payment.Id,
                ReservationId: reservation.Id);
        }

        var newlyConfirmed = false;
        if (reservation.Status == ReservationStatus.PendingPayment)
        {
            reservation.Status = ReservationStatus.Confirmed;
            newlyConfirmed = true;

            if (string.IsNullOrWhiteSpace(reservation.SmartLockPin))
            {
                reservation.SmartLockPin = RandomNumberGenerator.GetInt32(100000, 1000000).ToString(CultureInfo.InvariantCulture);
            }

            reservation.SmartLockStatus = "Active";
            reservation.SmartLockActivatedAtUtc = nowUtc;
            reservation.UpdatedAtUtc = nowUtc;
        }

        await _context.SaveChangesAsync(cancellationToken);
        await tx.CommitAsync(cancellationToken);

        if (_notificationDispatcher != null)
        {
            try
            {
                if (newlyConfirmed)
                {
                    var roomTypeName = !string.IsNullOrWhiteSpace(snapshot?.RoomTypeName)
                        ? snapshot!.RoomTypeName
                        : "Phòng nghỉ dưỡng";

                    await _notificationDispatcher.NotifyNewReservationConfirmedAsync(
                        reservation.PropertyId.ToString(),
                        reservation.Id.ToString(),
                        reservation.ConfirmationCode,
                        reservation.GuestName,
                        roomTypeName,
                        reservation.TotalAmount,
                        totalPaid,
                        cancellationToken);
                }

                await _notificationDispatcher.NotifyBookingPaymentConfirmedAsync(
                    reservation.PropertyId.ToString(),
                    reservation.Id.ToString(),
                    reservation.ConfirmationCode,
                    reservation.GuestName,
                    reservation.TotalAmount,
                    request.TransferAmount,
                    "SepayVietQR",
                    cancellationToken);
            }
            catch (Exception ex)
            {
                // Fail-safe: SignalR dispatch failure never rolls back settled payment
                _logger?.LogWarning(ex, "SignalR notification failed after SePay confirmation for reservation {ReservationId}.", reservation.Id);
            }
        }

        return new ProcessSepayWebhookResult(
            "confirmed",
            $"Reservation {reservation.ConfirmationCode} confirmed via SePay.",
            PaymentId: payment.Id,
            ReservationId: reservation.Id);
    }

    private async Task<ProcessSepayWebhookResult> HandleSubscriptionTransferAsync(
        ProcessSepayWebhookCommand request,
        SubscriptionPayment subPaymentHeader,
        CancellationToken cancellationToken)
    {
        if (!request.IsGlobalApiKeyMatched)
        {
            return new ProcessSepayWebhookResult("unauthorized", "Invalid platform SePay API key.");
        }

        var hasConfiguredPlatformAccount = !string.IsNullOrWhiteSpace(request.ExpectedPlatformAccountNumber) &&
                                           !string.IsNullOrEmpty(ExtractDigitsOnly(request.ExpectedPlatformAccountNumber));

        if (!hasConfiguredPlatformAccount)
        {
            if (ShouldRequireConfiguredBankAccount(request))
            {
                _logger?.LogWarning(
                    "SePay webhook {SepayId} rejected (fail-closed): expected platform bank account is not configured for subscription payment {PaymentId} (TenantId={TenantId}).",
                    request.Id,
                    subPaymentHeader.Id,
                    subPaymentHeader.TenantId);

                await TryWriteBankConfigAuditWarningAsync(
                    tenantId: subPaymentHeader.TenantId,
                    propertyId: null,
                    entityId: subPaymentHeader.Id,
                    targetType: "SubscriptionPayment",
                    reference: subPaymentHeader.TransactionRef ?? subPaymentHeader.Id.ToString(),
                    request: request,
                    reason: "Expected platform bank account is not configured.",
                    cancellationToken: cancellationToken);

                return new ProcessSepayWebhookResult(
                    "rejected_unconfigured_bank_account",
                    "Platform bank account is not configured; webhook rejected (fail-closed).",
                    SubscriptionPaymentId: subPaymentHeader.Id);
            }
        }
        else if (!IsAccountNumberMatch(request.ExpectedPlatformAccountNumber!, request.AccountNumber, request.SubAccount))
        {
            _logger?.LogWarning(
                "SePay webhook {SepayId} ignored: platform bank account mismatch for subscription payment {PaymentId}.",
                request.Id,
                subPaymentHeader.Id);

            return new ProcessSepayWebhookResult("ignored", "Platform bank account number mismatch.");
        }

        var sepayKey = $"SEPAY-{request.Id}";
        var sepayTag = $"|{sepayKey}|";

        await using var tx = await _context.BeginTransactionAsync(cancellationToken);

        if (_tenantService != null)
        {
            _tenantService.TenantId = subPaymentHeader.TenantId;
        }

        await _context.LockIdempotencyKeyAsync(subPaymentHeader.TenantId, sepayKey, cancellationToken);

        var duplicateBySepayId = await _context.SubscriptionPayments
            .IgnoreQueryFilters()
            .AnyAsync(p => p.TransactionRef != null && p.TransactionRef.Contains(sepayTag), cancellationToken);

        if (duplicateBySepayId)
        {
            await tx.CommitAsync(cancellationToken);
            return new ProcessSepayWebhookResult(
                "duplicate",
                $"SePay transaction {sepayKey} was already applied to a subscription payment.",
                SubscriptionPaymentId: subPaymentHeader.Id);
        }

        var payment = await _context.SubscriptionPayments
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(p => p.Id == subPaymentHeader.Id, cancellationToken);

        if (payment == null)
        {
            await tx.CommitAsync(cancellationToken);
            return new ProcessSepayWebhookResult("ignored", "Subscription payment not found under lock.");
        }

        if (payment.Status == PaymentStatus.Completed)
        {
            await tx.CommitAsync(cancellationToken);
            return new ProcessSepayWebhookResult(
                "duplicate",
                "Subscription payment was already completed.",
                SubscriptionPaymentId: payment.Id);
        }

        if (payment.Status != PaymentStatus.Pending)
        {
            await tx.CommitAsync(cancellationToken);
            return new ProcessSepayWebhookResult(
                "ignored",
                $"Subscription payment is in non-pending state ({payment.Status}).",
                SubscriptionPaymentId: payment.Id);
        }

        if (request.TransferAmount < payment.Amount - RoundingToleranceVnd)
        {
            _logger?.LogWarning(
                "SePay webhook {SepayId} partial amount {Amount} VND for subscription payment {PaymentId} requiring {Required} VND.",
                request.Id,
                request.TransferAmount,
                payment.Id,
                payment.Amount);

            await tx.CommitAsync(cancellationToken);
            return new ProcessSepayWebhookResult(
                "partial",
                $"Transfer amount ({request.TransferAmount:N0} VND) is below required subscription amount ({payment.Amount:N0} VND).",
                SubscriptionPaymentId: payment.Id);
        }

        payment.Method = PaymentMethod.BankTransfer;
        if (!string.IsNullOrWhiteSpace(payment.TransactionRef) &&
            !payment.TransactionRef.Contains(sepayTag, StringComparison.Ordinal))
        {
            payment.TransactionRef = $"{payment.TransactionRef}{sepayTag}";
        }

        var refPart = !string.IsNullOrWhiteSpace(request.ReferenceCode)
            ? request.ReferenceCode.Trim()
            : request.Id.ToString(CultureInfo.InvariantCulture);

        var activation = await ConfirmSubscriptionPaymentCommandHandler.ActivatePaymentAndUpgradeAsync(
            _context,
            _tenantService,
            actorUserId: null,
            ipAddress: null,
            payment,
            externalTxnNo: $"{sepayKey}|{refPart}",
            cancellationToken);

        await tx.CommitAsync(cancellationToken);

        return new ProcessSepayWebhookResult(
            "confirmed",
            $"Subscription upgraded to {activation.NewTierName} via SePay.",
            SubscriptionPaymentId: payment.Id);
    }

    private async Task<SubscriptionPayment?> FindMatchingSubscriptionPaymentAsync(
        IReadOnlyList<string> normalizedRefs,
        CancellationToken cancellationToken)
    {
        foreach (var candidate in normalizedRefs)
        {
            var matches = await _context.SubscriptionPayments
                .IgnoreQueryFilters()
                .AsNoTracking()
                .Where(p => p.TransactionRef != null &&
                            p.TransactionRef.Replace("-", string.Empty).Replace("_", string.Empty).ToUpper().StartsWith(candidate))
                .OrderByDescending(p => p.CreatedAtUtc)
                .Take(10)
                .ToListAsync(cancellationToken);

            var exact = matches.FirstOrDefault(p =>
                string.Equals(NormalizeSubscriptionRef(p.TransactionRef), candidate, StringComparison.OrdinalIgnoreCase));

            if (exact != null)
            {
                return exact;
            }
        }

        return null;
    }

    internal static List<string> ExtractReservationCodes(params string?[] sources)
    {
        var results = new List<string>();
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var source in sources)
        {
            if (string.IsNullOrWhiteSpace(source)) continue;

            foreach (Match match in ReservationCodeRegex.Matches(source))
            {
                if (!match.Success || match.Groups.Count < 2) continue;

                var normalized = $"RES-{match.Groups[1].Value.ToUpperInvariant()}";
                if (seen.Add(normalized))
                {
                    results.Add(normalized);
                }
            }
        }

        return results;
    }

    internal static List<string> ExtractSubscriptionRefs(params string?[] sources)
    {
        var results = new List<string>();
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var source in sources)
        {
            if (string.IsNullOrWhiteSpace(source)) continue;

            foreach (Match match in SubscriptionCodeRegex.Matches(source))
            {
                if (!match.Success || match.Groups.Count < 2) continue;

                var strippedSuffix = match.Groups[1].Value
                    .Replace("-", string.Empty, StringComparison.Ordinal)
                    .Replace("_", string.Empty, StringComparison.Ordinal)
                    .Trim()
                    .ToUpperInvariant();

                if (strippedSuffix.Length < 6) continue;

                var normalized = $"SUB{strippedSuffix}";
                if (seen.Add(normalized))
                {
                    results.Add(normalized);
                }
            }
        }

        return results;
    }

    internal static string NormalizeSubscriptionRef(string? transactionRef)
    {
        if (string.IsNullOrWhiteSpace(transactionRef))
        {
            return string.Empty;
        }

        var baseRef = transactionRef.Split('|')[0];
        return baseRef
            .Replace("-", string.Empty, StringComparison.Ordinal)
            .Replace("_", string.Empty, StringComparison.Ordinal)
            .Replace(" ", string.Empty, StringComparison.Ordinal)
            .Trim()
            .ToUpperInvariant();
    }

    private static bool ShouldRequireConfiguredBankAccount(ProcessSepayWebhookCommand request)
    {
        if (request.RequireBankAccountMatch.HasValue)
        {
            return request.RequireBankAccountMatch.Value;
        }

        var envName = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT")
            ?? Environment.GetEnvironmentVariable("DOTNET_ENVIRONMENT");

        if (string.IsNullOrWhiteSpace(envName))
        {
            return false;
        }

        return !string.Equals(envName, "Development", StringComparison.OrdinalIgnoreCase) &&
               !string.Equals(envName, "Testing", StringComparison.OrdinalIgnoreCase);
    }

    private async Task TryWriteBankConfigAuditWarningAsync(
        Guid tenantId,
        Guid? propertyId,
        Guid entityId,
        string targetType,
        string reference,
        ProcessSepayWebhookCommand request,
        string reason,
        CancellationToken cancellationToken)
    {
        try
        {
            if (_tenantService != null)
            {
                _tenantService.TenantId = tenantId;
            }

            if (_propertyService != null)
            {
                _propertyService.PropertyId = propertyId;
                _propertyService.IsTenantWide = !propertyId.HasValue;
                _propertyService.HeaderPropertyId = null;
            }

            _context.AuditLogs.Add(new AuditLog
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                PropertyId = propertyId,
                UserId = null,
                Action = AuditActions.Create,
                EntityName = "SepayBankAccountConfigWarning",
                EntityId = entityId,
                NewValues = JsonSerializer.Serialize(new
                {
                    SepayKey = $"SEPAY-{request.Id}",
                    TargetType = targetType,
                    Reference = reference,
                    IncomingAccountNumber = request.AccountNumber,
                    IncomingSubAccount = request.SubAccount,
                    Amount = request.TransferAmount,
                    Gateway = request.Gateway,
                    Reason = reason
                }),
                CreatedAtUtc = DateTime.UtcNow
            });

            await _context.SaveChangesAsync(cancellationToken);
        }
        catch (NotImplementedException)
        {
            // Optional DbSet in isolated unit test fakes
        }
        catch (Exception ex)
        {
            _logger?.LogWarning(
                ex,
                "Unable to persist SepayBankAccountConfigWarning audit entry for SePay webhook {SepayId}.",
                request.Id);
        }
    }

    private async Task<ProcessSepayWebhookResult> EnsureAuthorizedOrIgnoreAsync(
        ProcessSepayWebhookCommand request,
        string ignoreMessage,
        CancellationToken cancellationToken)
    {
        if (request.IsGlobalApiKeyMatched)
        {
            return new ProcessSepayWebhookResult("ignored", ignoreMessage);
        }

        if (string.IsNullOrWhiteSpace(request.ProvidedApiKey))
        {
            return new ProcessSepayWebhookResult("unauthorized", "Unauthorized SePay API key.");
        }

        var query = _context.PrintTemplateConfigs
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(c => c.SepayApiKey != null && c.SepayApiKey != string.Empty);

        if (request.RoutePropertyId.HasValue && request.RoutePropertyId.Value != Guid.Empty)
        {
            var routePropId = request.RoutePropertyId.Value;
            query = query.Where(c => c.PropertyId == routePropId);
        }

        var configuredKeys = await query
            .Select(c => c.SepayApiKey)
            .ToListAsync(cancellationToken);

        var hasMatch = configuredKeys.Any(k => !string.IsNullOrWhiteSpace(k) && ConstantTimeEquals(request.ProvidedApiKey, k));
        if (!hasMatch)
        {
            return new ProcessSepayWebhookResult("unauthorized", "Unauthorized SePay API key.");
        }

        return new ProcessSepayWebhookResult("ignored", ignoreMessage);
    }

    private static bool ConstantTimeEquals(string? providedKey, string? expectedKey)
    {
        if (string.IsNullOrWhiteSpace(providedKey) || string.IsNullOrWhiteSpace(expectedKey))
        {
            return false;
        }

        var expectedBytes = Encoding.UTF8.GetBytes(expectedKey.Trim());
        var providedBytes = Encoding.UTF8.GetBytes(providedKey.Trim());

        return expectedBytes.Length == providedBytes.Length &&
               CryptographicOperations.FixedTimeEquals(expectedBytes, providedBytes);
    }

    private static bool IsAccountNumberMatch(string configuredAccount, string? incomingAccount, string? incomingSubAccount)
    {
        var expectedDigits = ExtractDigitsOnly(configuredAccount);
        if (string.IsNullOrEmpty(expectedDigits))
        {
            return false;
        }

        var actualDigits = ExtractDigitsOnly(incomingAccount);
        if (string.Equals(expectedDigits, actualDigits, StringComparison.Ordinal))
        {
            return true;
        }

        var subDigits = ExtractDigitsOnly(incomingSubAccount);
        return !string.IsNullOrEmpty(subDigits) &&
               string.Equals(expectedDigits, subDigits, StringComparison.Ordinal);
    }

    private static string ExtractDigitsOnly(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return string.Empty;
        }

        return new string(value.Where(char.IsDigit).ToArray());
    }

    private static string BuildSepayTransactionRef(
        string sepayKey,
        string? referenceCode,
        string? gateway,
        string? content,
        long sepayId)
    {
        var refPart = !string.IsNullOrWhiteSpace(referenceCode)
            ? referenceCode.Trim()
            : sepayId.ToString(CultureInfo.InvariantCulture);

        var primary = $"{sepayKey}|{refPart}";
        var gatewayPart = !string.IsNullOrWhiteSpace(gateway) ? $"|[SEPAY:{gateway.Trim()}]" : string.Empty;
        var contentPart = !string.IsNullOrWhiteSpace(content) ? $" {content.Trim()}" : string.Empty;
        var full = $"{primary}{gatewayPart}{contentPart}";

        return full.Length <= 400 ? full : full[..400];
    }

    private sealed record ReservationHeader(
        Guid Id,
        Guid TenantId,
        Guid PropertyId,
        Guid RoomId,
        string ConfirmationCode);
}
