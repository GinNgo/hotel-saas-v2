using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Reservations.DTOs;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace HotelSaas.Application.Public.Commands.CheckExpiredHolds;

/// <summary>
/// Authoritative sweep command that detects expired 15-minute online booking holds on the server
/// and dispatches HoldExpired SignalR events to hotel staff using a two-phase claim-commit-before-emit workflow.
/// Guarantees database persistence succeeds before SignalR emission and bounds retries across failures.
/// </summary>
public sealed record CheckExpiredHoldsCommand(Guid? PropertyId = null) : IRequest<int>;

public sealed class CheckExpiredHoldsCommandHandler : IRequestHandler<CheckExpiredHoldsCommand, int>
{
    public const int DefaultMaxDispatchAttempts = 5;
    public static readonly TimeSpan DefaultDispatchLeaseDuration = TimeSpan.FromSeconds(30);

    private static readonly SemaphoreSlim SweepLock = new(1, 1);
    private readonly IApplicationDbContext _context;
    private readonly INotificationDispatcher? _notificationDispatcher;
    private readonly ICurrentTenantService? _currentTenantService;
    private readonly ICurrentPropertyService? _currentPropertyService;
    private readonly ILogger<CheckExpiredHoldsCommandHandler>? _logger;
    private readonly bool _useInMemoryLock;
    private readonly int _maxDispatchAttempts;
    private readonly TimeSpan _dispatchLeaseDuration;

    public CheckExpiredHoldsCommandHandler(
        IApplicationDbContext context,
        INotificationDispatcher? notificationDispatcher = null,
        bool useInMemoryLock = true,
        ICurrentTenantService? currentTenantService = null,
        ICurrentPropertyService? currentPropertyService = null,
        ILogger<CheckExpiredHoldsCommandHandler>? logger = null,
        int maxDispatchAttempts = DefaultMaxDispatchAttempts,
        TimeSpan? dispatchLeaseDuration = null)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _notificationDispatcher = notificationDispatcher;
        _useInMemoryLock = useInMemoryLock;
        _currentTenantService = currentTenantService;
        _currentPropertyService = currentPropertyService;
        _logger = logger;
        _maxDispatchAttempts = Math.Max(1, maxDispatchAttempts);
        _dispatchLeaseDuration = dispatchLeaseDuration ?? DefaultDispatchLeaseDuration;
    }

    public async Task<int> Handle(CheckExpiredHoldsCommand request, CancellationToken cancellationToken)
    {
        var scopedTenantId = ValidateScopeAndResolveTenantId(request.PropertyId);
        if (scopedTenantId.HasValue && request.PropertyId.HasValue && request.PropertyId.Value != Guid.Empty)
        {
            await EnsurePropertyBelongsToTenantAsync(request.PropertyId.Value, scopedTenantId.Value, cancellationToken);
        }

        var claimOwner = $"{Environment.MachineName}:{Guid.NewGuid():N}";
        var (pendingDispatches, directCommittedCount) = await ClaimExpiredHoldsAsync(
            request,
            scopedTenantId,
            claimOwner,
            cancellationToken);

        if (_notificationDispatcher == null)
        {
            return directCommittedCount;
        }

        if (pendingDispatches.Count == 0)
        {
            return 0;
        }

        var dispatchResults = await DispatchPostCommitAsync(pendingDispatches, claimOwner, cancellationToken);
        return await FinalizeClaimsAsync(dispatchResults, claimOwner, cancellationToken);
    }

    private Guid? ValidateScopeAndResolveTenantId(Guid? requestedPropertyId)
    {
        var scopedTenantId = _currentTenantService?.TenantId;
        if (_currentTenantService != null && (!scopedTenantId.HasValue || scopedTenantId.Value == Guid.Empty))
        {
            throw new ForbiddenException(
                "ERR_TENANT_REQUIRED",
                "Không thể xử lý giữ phòng hết hạn khi thiếu Tenant context.");
        }

        if (requestedPropertyId.HasValue && requestedPropertyId.Value != Guid.Empty &&
            _currentPropertyService != null && !_currentPropertyService.IsTenantWide)
        {
            if (!_currentPropertyService.PropertyId.HasValue ||
                _currentPropertyService.PropertyId.Value == Guid.Empty ||
                _currentPropertyService.PropertyId.Value != requestedPropertyId.Value)
            {
                throw new ForbiddenException(
                    "ERR_CROSS_PROPERTY_MUTATION",
                    "Không được phép quét giữ phòng của chi nhánh khác.");
            }
        }

        if (_currentPropertyService?.HeaderPropertyId is Guid headerPropId &&
            headerPropId != Guid.Empty &&
            requestedPropertyId.HasValue &&
            requestedPropertyId.Value != Guid.Empty &&
            headerPropId != requestedPropertyId.Value)
        {
            throw new BadRequestException(
                "ERR_CONTEXT_MISMATCH",
                "Chi nhánh yêu cầu không khớp với header X-Property-Id.");
        }

        if (requestedPropertyId.HasValue && requestedPropertyId.Value != Guid.Empty &&
            _currentPropertyService != null &&
            _currentPropertyService.ExcludedPropertyIds.Contains(requestedPropertyId.Value))
        {
            throw new ForbiddenException(
                "ERR_MEMBERSHIP_REVOKED",
                "Quyền nhân sự tại chi nhánh này đã bị đình chỉ.");
        }

        return scopedTenantId;
    }

    private async Task EnsurePropertyBelongsToTenantAsync(
        Guid propertyId,
        Guid expectedTenantId,
        CancellationToken cancellationToken)
    {
        var propertyTenantId = await _context.Properties
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(p => p.Id == propertyId)
            .Select(p => (Guid?)p.TenantId)
            .FirstOrDefaultAsync(cancellationToken);

        if (propertyTenantId.HasValue && propertyTenantId.Value != expectedTenantId)
        {
            throw new ForbiddenException(
                "ERR_CROSS_TENANT_ACCESS",
                "Không được phép quét giữ phòng thuộc Tenant khác.");
        }
    }

    private async Task<(List<ClaimedHoldItem> PendingDispatches, int DirectCommittedCount)> ClaimExpiredHoldsAsync(
        CheckExpiredHoldsCommand request,
        Guid? scopedTenantId,
        string claimOwner,
        CancellationToken cancellationToken)
    {
        if (_useInMemoryLock)
        {
            await SweepLock.WaitAsync(cancellationToken);
        }

        try
        {
            await using var tx = await _context.BeginTransactionAsync(cancellationToken);
            if (tx != null)
            {
                var lockScopeId = request.PropertyId.HasValue && request.PropertyId.Value != Guid.Empty
                    ? request.PropertyId.Value
                    : scopedTenantId ?? Guid.Empty;
                await _context.LockIdempotencyKeyAsync(lockScopeId, "expired_hold_sweep_distributed_lock", cancellationToken);
            }

            var nowUtc = DateTime.UtcNow;
            var query = BuildScopedCandidateQuery(request.PropertyId, scopedTenantId);
            var candidates = await query.OrderBy(r => r.CreatedAtUtc).ToListAsync(cancellationToken);

            var pendingDispatches = new List<ClaimedHoldItem>();
            int directCommittedCount = 0;
            bool hasDeadLetterCleanup = false;

            foreach (var r in candidates)
            {
                var initialSnap = ReservationSnapshotHelper.TryDeserialize(r.Notes);
                if (!IsEligibleForClaim(initialSnap, nowUtc) && !NeedsAbandonedMaxAttemptDeadLetter(initialSnap, nowUtc))
                {
                    continue;
                }

                if (tx != null)
                {
                    await _context.LockReservationRowAsync(r.Id, r.TenantId, r.PropertyId, cancellationToken);
                }

                // Re-read authoritative committed row state after acquiring FOR UPDATE lock
                var authoritativeState = await _context.Reservations
                    .IgnoreQueryFilters()
                    .AsNoTracking()
                    .Where(x => x.Id == r.Id)
                    .Select(x => new { x.Status, x.Notes, x.ConfirmationCode, x.PropertyId, x.TenantId })
                    .FirstOrDefaultAsync(cancellationToken);

                if (authoritativeState == null || authoritativeState.Status != ReservationStatus.PendingPayment)
                {
                    continue;
                }

                var snap = ReservationSnapshotHelper.TryDeserialize(authoritativeState.Notes);
                if (NeedsAbandonedMaxAttemptDeadLetter(snap, nowUtc) && snap != null)
                {
                    snap.HoldExpiredDispatchLeaseUntilUtc = null;
                    snap.HoldExpiredDeadLetteredAtUtc ??= nowUtc;
                    snap.HoldExpiredLastError ??= "Dispatch attempts exhausted before finalization.";
                    r.Notes = ReservationSnapshotHelper.Serialize(snap);
                    hasDeadLetterCleanup = true;
                    continue;
                }

                if (!IsEligibleForClaim(snap, nowUtc) || snap == null)
                {
                    continue;
                }

                var eventId = string.IsNullOrWhiteSpace(snap.HoldExpiredEventId)
                    ? $"evt-holdexp-{authoritativeState.ConfirmationCode}"
                    : snap.HoldExpiredEventId;

                snap.HoldExpiredEventId = eventId;
                snap.HoldExpiredClaimedAtUtc = nowUtc;
                snap.HoldExpiredClaimOwner = claimOwner;
                snap.HoldExpiredLastAttemptAtUtc = nowUtc;
                snap.HoldExpiredDispatchAttemptCount += 1;

                var roomTypeName = string.IsNullOrWhiteSpace(snap.RoomTypeName)
                    ? "Phòng tiêu chuẩn"
                    : snap.RoomTypeName;

                if (_notificationDispatcher == null)
                {
                    snap.HoldExpiredDispatchLeaseUntilUtc = null;
                    snap.HoldExpiredNotifiedAtUtc = nowUtc;
                    snap.HoldExpiredLastError = null;
                    directCommittedCount++;
                }
                else
                {
                    snap.HoldExpiredDispatchLeaseUntilUtc = nowUtc.Add(_dispatchLeaseDuration);
                    pendingDispatches.Add(new ClaimedHoldItem(
                        r.Id,
                        authoritativeState.TenantId,
                        authoritativeState.PropertyId,
                        authoritativeState.ConfirmationCode,
                        roomTypeName,
                        eventId));
                }

                r.Notes = ReservationSnapshotHelper.Serialize(snap);
            }

            if (pendingDispatches.Count > 0 || directCommittedCount > 0 || hasDeadLetterCleanup)
            {
                await _context.SaveChangesAsync(cancellationToken);
            }

            if (tx != null)
            {
                await tx.CommitAsync(cancellationToken);
            }

            return (pendingDispatches, directCommittedCount);
        }
        finally
        {
            if (_useInMemoryLock)
            {
                SweepLock.Release();
            }
        }
    }

    private IQueryable<Domain.Entities.Reservation> BuildScopedCandidateQuery(Guid? requestedPropertyId, Guid? scopedTenantId)
    {
        var query = _context.Reservations
            .IgnoreQueryFilters()
            .Where(r => r.Status == ReservationStatus.PendingPayment &&
                        r.Notes != null &&
                        r.Notes.Contains("HoldExpiresAtUtc"));

        if (scopedTenantId.HasValue)
        {
            query = query.Where(r => r.TenantId == scopedTenantId.Value);
        }

        if (requestedPropertyId.HasValue && requestedPropertyId.Value != Guid.Empty)
        {
            query = query.Where(r => r.PropertyId == requestedPropertyId.Value);
        }
        else if (_currentPropertyService != null && !_currentPropertyService.IsTenantWide)
        {
            if (!_currentPropertyService.PropertyId.HasValue || _currentPropertyService.PropertyId.Value == Guid.Empty)
            {
                throw new ForbiddenException(
                    "ERR_PROPERTY_REQUIRED",
                    "Bắt buộc chỉ định PropertyId khi không có quyền toàn Tenant.");
            }

            var branchId = _currentPropertyService.PropertyId.Value;
            query = query.Where(r => r.PropertyId == branchId);
        }
        else if (_currentPropertyService != null && _currentPropertyService.ExcludedPropertyIds.Count > 0)
        {
            var excluded = _currentPropertyService.ExcludedPropertyIds;
            query = query.Where(r => !excluded.Contains(r.PropertyId));
        }

        return query;
    }

    private bool IsEligibleForClaim(ReservationSnapshot? snap, DateTime nowUtc)
    {
        if (snap == null || !snap.HoldExpiresAtUtc.HasValue || snap.HoldExpiresAtUtc.Value > nowUtc)
        {
            return false;
        }

        if (snap.HoldExpiredNotifiedAtUtc.HasValue || snap.HoldExpiredDeadLetteredAtUtc.HasValue)
        {
            return false;
        }

        if (snap.HoldExpiredDispatchAttemptCount >= _maxDispatchAttempts)
        {
            return false;
        }

        if (snap.HoldExpiredDispatchLeaseUntilUtc.HasValue && snap.HoldExpiredDispatchLeaseUntilUtc.Value > nowUtc)
        {
            return false;
        }

        return true;
    }

    private bool NeedsAbandonedMaxAttemptDeadLetter(ReservationSnapshot? snap, DateTime nowUtc)
    {
        if (snap == null || !snap.HoldExpiresAtUtc.HasValue || snap.HoldExpiresAtUtc.Value > nowUtc)
        {
            return false;
        }

        if (snap.HoldExpiredNotifiedAtUtc.HasValue || snap.HoldExpiredDeadLetteredAtUtc.HasValue)
        {
            return false;
        }

        if (snap.HoldExpiredDispatchAttemptCount < _maxDispatchAttempts)
        {
            return false;
        }

        return !snap.HoldExpiredDispatchLeaseUntilUtc.HasValue || snap.HoldExpiredDispatchLeaseUntilUtc.Value <= nowUtc;
    }

    private async Task<List<ClaimDispatchOutcome>> DispatchPostCommitAsync(
        IReadOnlyList<ClaimedHoldItem> pendingDispatches,
        string claimOwner,
        CancellationToken cancellationToken)
    {
        var outcomes = new List<ClaimDispatchOutcome>(pendingDispatches.Count);

        foreach (var item in pendingDispatches)
        {
            // Verify reservation is still PendingPayment AND this worker still holds an active unexpired claim lease
            var currentState = await _context.Reservations
                .IgnoreQueryFilters()
                .AsNoTracking()
                .Where(x => x.Id == item.ReservationId)
                .Select(x => new { x.Status, x.Notes })
                .FirstOrDefaultAsync(cancellationToken);

            if (currentState == null || currentState.Status != ReservationStatus.PendingPayment)
            {
                outcomes.Add(new ClaimDispatchOutcome(item, Dispatched: false, AbortedDueToStatusTransition: true, SkippedDueToFencing: false, Error: null));
                continue;
            }

            var currentSnap = ReservationSnapshotHelper.TryDeserialize(currentState.Notes);
            if (currentSnap == null ||
                currentSnap.HoldExpiredNotifiedAtUtc.HasValue ||
                currentSnap.HoldExpiredDeadLetteredAtUtc.HasValue ||
                !string.Equals(currentSnap.HoldExpiredClaimOwner, claimOwner, StringComparison.Ordinal))
            {
                outcomes.Add(new ClaimDispatchOutcome(item, Dispatched: false, AbortedDueToStatusTransition: false, SkippedDueToFencing: true, Error: null));
                continue;
            }

            if (!currentSnap.HoldExpiredDispatchLeaseUntilUtc.HasValue ||
                currentSnap.HoldExpiredDispatchLeaseUntilUtc.Value <= DateTime.UtcNow)
            {
                outcomes.Add(new ClaimDispatchOutcome(
                    item,
                    Dispatched: false,
                    AbortedDueToStatusTransition: false,
                    SkippedDueToFencing: false,
                    Error: "Dispatch aborted because claim lease expired before execution."));
                continue;
            }

            bool dispatched = false;
            string? error = null;
            try
            {
                dispatched = await _notificationDispatcher!.NotifyHoldExpiredAsync(
                    item.PropertyId.ToString(),
                    item.ReservationId.ToString(),
                    item.ConfirmationCode,
                    item.RoomTypeName,
                    cancellationToken);

                if (!dispatched)
                {
                    error = "SignalR dispatcher returned false.";
                }
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception ex)
            {
                dispatched = false;
                error = ex.Message.Length > 256 ? ex.Message[..256] : ex.Message;
                _logger?.LogWarning(ex,
                    "Post-commit HoldExpired dispatch failed for reservation {ReservationId} ({Code})",
                    item.ReservationId, item.ConfirmationCode);
            }

            outcomes.Add(new ClaimDispatchOutcome(item, dispatched, AbortedDueToStatusTransition: false, SkippedDueToFencing: false, error));
        }

        return outcomes;
    }

    private async Task<int> FinalizeClaimsAsync(
        IReadOnlyList<ClaimDispatchOutcome> outcomes,
        string claimOwner,
        CancellationToken cancellationToken)
    {
        if (outcomes.Count == 0)
        {
            return 0;
        }

        int finalizedCount = 0;
        bool anyModified = false;
        await using var tx2 = await _context.BeginTransactionAsync(cancellationToken);

        foreach (var outcome in outcomes)
        {
            if (outcome.SkippedDueToFencing)
            {
                continue;
            }

            if (tx2 != null)
            {
                await _context.LockReservationRowAsync(
                    outcome.Item.ReservationId,
                    outcome.Item.TenantId,
                    outcome.Item.PropertyId,
                    cancellationToken);
            }

            var dbState = await _context.Reservations
                .IgnoreQueryFilters()
                .AsNoTracking()
                .Where(x => x.Id == outcome.Item.ReservationId)
                .Select(x => new { x.Status, x.Notes })
                .FirstOrDefaultAsync(cancellationToken);

            var trackedRes = await _context.Reservations
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(x => x.Id == outcome.Item.ReservationId, cancellationToken);

            if (dbState == null || trackedRes == null)
            {
                continue;
            }

            var snap = ReservationSnapshotHelper.TryDeserialize(dbState.Notes);
            if (snap == null || !string.Equals(snap.HoldExpiredClaimOwner, claimOwner, StringComparison.Ordinal))
            {
                continue;
            }

            snap.HoldExpiredDispatchLeaseUntilUtc = null;

            if (outcome.AbortedDueToStatusTransition || dbState.Status != ReservationStatus.PendingPayment)
            {
                snap.HoldExpiredLastError = null;
            }
            else if (outcome.Dispatched)
            {
                snap.HoldExpiredNotifiedAtUtc ??= DateTime.UtcNow;
                snap.HoldExpiredLastError = null;
                finalizedCount++;
            }
            else
            {
                snap.HoldExpiredLastError = outcome.Error;
                if (snap.HoldExpiredDispatchAttemptCount >= _maxDispatchAttempts)
                {
                    snap.HoldExpiredDeadLetteredAtUtc ??= DateTime.UtcNow;
                }
            }

            trackedRes.Notes = ReservationSnapshotHelper.Serialize(snap);
            anyModified = true;
        }

        if (anyModified)
        {
            await _context.SaveChangesAsync(cancellationToken);
        }

        if (tx2 != null)
        {
            await tx2.CommitAsync(cancellationToken);
        }

        return finalizedCount;
    }

    private sealed record ClaimedHoldItem(
        Guid ReservationId,
        Guid TenantId,
        Guid PropertyId,
        string ConfirmationCode,
        string RoomTypeName,
        string EventId);

    private sealed record ClaimDispatchOutcome(
        ClaimedHoldItem Item,
        bool Dispatched,
        bool AbortedDueToStatusTransition,
        bool SkippedDueToFencing,
        string? Error);
}
