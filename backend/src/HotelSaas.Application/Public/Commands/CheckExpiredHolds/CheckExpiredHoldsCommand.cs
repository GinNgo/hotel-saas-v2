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

    public CheckExpiredHoldsCommandHandler(
        IApplicationDbContext context,
        INotificationDispatcher? notificationDispatcher = null)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _notificationDispatcher = notificationDispatcher;
    }

    public async Task<int> Handle(CheckExpiredHoldsCommand request, CancellationToken cancellationToken)
    {
        await SweepLock.WaitAsync(cancellationToken);
        try
        {
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

            int count = 0;
            foreach (var r in candidates)
            {
                var snap = ReservationSnapshotHelper.TryDeserialize(r.Notes);
                if (snap != null &&
                    snap.HoldExpiresAtUtc.HasValue &&
                    snap.HoldExpiresAtUtc.Value <= nowUtc &&
                    !snap.HoldExpiredNotifiedAtUtc.HasValue)
                {
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
                        count++;
                    }
                }
            }

            if (count > 0)
            {
                await _context.SaveChangesAsync(cancellationToken);
            }

            return count;
        }
        finally
        {
            SweepLock.Release();
        }
    }
}
