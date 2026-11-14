using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Reservations.DTOs;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Public.Commands.CheckExpiredHolds;

/// <summary>
/// Authoritative sweep command that detects expired 15-minute online booking holds on the server
/// and dispatches HoldExpired SignalR events to hotel staff (Task Week 05 T02).
/// Idempotent: guarantees no duplicate notifications using HoldExpiredNotifiedAtUtc.
/// </summary>
public sealed record CheckExpiredHoldsCommand(Guid? PropertyId = null) : IRequest<int>;

public sealed class CheckExpiredHoldsCommandHandler : IRequestHandler<CheckExpiredHoldsCommand, int>
{
    private static readonly SemaphoreSlim SweepLock = new(1, 1);
    private readonly IApplicationDbContext _context;
    private readonly INotificationDispatcher? _notificationDispatcher;
    private readonly ICurrentTenantService? _currentTenantService;
    private readonly ICurrentPropertyService? _currentPropertyService;
    private readonly bool _useInMemoryLock;

    public CheckExpiredHoldsCommandHandler(
        IApplicationDbContext context,
        INotificationDispatcher? notificationDispatcher = null,
        bool useInMemoryLock = true,
        ICurrentTenantService? currentTenantService = null,
        ICurrentPropertyService? currentPropertyService = null)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _notificationDispatcher = notificationDispatcher;
        _useInMemoryLock = useInMemoryLock;
        _currentTenantService = currentTenantService;
        _currentPropertyService = currentPropertyService;
    }

    public async Task<int> Handle(CheckExpiredHoldsCommand request, CancellationToken cancellationToken)
    {
        if (_useInMemoryLock)
        {
            await SweepLock.WaitAsync(cancellationToken);
        }

        var originalTenantId = _currentTenantService?.TenantId;
        var originalPropertyId = _currentPropertyService?.PropertyId;
        var originalIsTenantWide = _currentPropertyService?.IsTenantWide ?? false;

        try
        {
            // Distributed multi-backend synchronization via PostgreSQL transaction-scoped advisory lock (pg_advisory_xact_lock)
            await using var tx = await _context.BeginTransactionAsync(cancellationToken);
            if (tx != null)
            {
                var lockScopeId = request.PropertyId.HasValue && request.PropertyId.Value != Guid.Empty
                    ? request.PropertyId.Value
                    : Guid.Empty;
                await _context.LockIdempotencyKeyAsync(lockScopeId, "expired_hold_sweep_distributed_lock", cancellationToken);
            }

            var nowUtc = DateTime.UtcNow;

            var query = _context.Reservations
                .IgnoreQueryFilters()
                .Where(r => r.Status == ReservationStatus.PendingPayment &&
                            r.Notes != null &&
                            r.Notes.Contains("HoldExpiresAtUtc"));

            if (request.PropertyId.HasValue && request.PropertyId.Value != Guid.Empty)
            {
                query = query.Where(r => r.PropertyId == request.PropertyId.Value);
            }

            var candidates = await query.ToListAsync(cancellationToken);

            var expiredItems = new List<(Domain.Entities.Reservation Reservation, ReservationSnapshot Snapshot)>();
            foreach (var r in candidates)
            {
                var snap = ReservationSnapshotHelper.TryDeserialize(r.Notes);
                if (snap != null &&
                    snap.HoldExpiresAtUtc.HasValue &&
                    snap.HoldExpiresAtUtc.Value <= nowUtc &&
                    !snap.HoldExpiredNotifiedAtUtc.HasValue)
                {
                    expiredItems.Add((r, snap));
                }
            }

            int count = 0;
            foreach (var group in expiredItems.GroupBy(x => new { x.Reservation.TenantId, x.Reservation.PropertyId }))
            {
                if (_currentTenantService != null)
                {
                    _currentTenantService.TenantId = group.Key.TenantId;
                }

                if (_currentPropertyService != null)
                {
                    _currentPropertyService.PropertyId = group.Key.PropertyId;
                    _currentPropertyService.IsTenantWide = false;
                }

                int groupModified = 0;
                foreach (var item in group)
                {
                    var r = item.Reservation;
                    var snap = item.Snapshot;

                    bool dispatched = true;
                    if (_notificationDispatcher != null)
                    {
                        try
                        {
                            dispatched = await _notificationDispatcher.NotifyHoldExpiredAsync(
                                r.PropertyId.ToString(),
                                r.Id.ToString(),
                                r.ConfirmationCode,
                                string.IsNullOrWhiteSpace(snap.RoomTypeName) ? "Phòng tiêu chuẩn" : snap.RoomTypeName,
                                cancellationToken);
                        }
                        catch
                        {
                            dispatched = false;
                        }
                    }

                    // Reliability Guard: Only mark as notified if dispatch succeeded
                    // If WebSocket publish failed, leave unmarked so subsequent sweeps retry without losing events
                    if (dispatched)
                    {
                        snap.HoldExpiredNotifiedAtUtc = nowUtc;
                        r.Notes = ReservationSnapshotHelper.Serialize(snap);
                        groupModified++;
                        count++;
                    }
                }

                if (groupModified > 0)
                {
                    await _context.SaveChangesAsync(cancellationToken);
                }
            }

            if (tx != null)
            {
                await tx.CommitAsync(cancellationToken);
            }

            return count;
        }
        finally
        {
            if (_currentTenantService != null)
            {
                _currentTenantService.TenantId = originalTenantId;
            }

            if (_currentPropertyService != null)
            {
                _currentPropertyService.PropertyId = originalPropertyId;
                _currentPropertyService.IsTenantWide = originalIsTenantWide;
            }

            if (_useInMemoryLock)
            {
                SweepLock.Release();
            }
        }
    }
}
