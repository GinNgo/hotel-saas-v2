using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Reservations.DTOs;
using HotelSaas.Application.Reservations.Services;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace HotelSaas.Infrastructure.Services;

/// <summary>
/// Night Audit background worker that periodically scans past-cutoff Confirmed bookings
/// (CheckInDate &lt; today in VN timezone, or stay already elapsed past CheckOutTime) and marks them NoShow.
/// </summary>
public sealed class NightAuditBackgroundService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<NightAuditBackgroundService> _logger;
    private readonly TimeSpan _auditInterval;

    public NightAuditBackgroundService(
        IServiceScopeFactory scopeFactory,
        ILogger<NightAuditBackgroundService> logger,
        TimeSpan? auditInterval = null)
    {
        _scopeFactory = scopeFactory ?? throw new ArgumentNullException(nameof(scopeFactory));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        _auditInterval = auditInterval ?? TimeSpan.FromMinutes(15);
    }

    public async Task<int> ExecuteNightAuditIterationAsync(CancellationToken cancellationToken)
    {
        await using var scope = _scopeFactory.CreateAsyncScope();
        var context = scope.ServiceProvider.GetRequiredService<IApplicationDbContext>();
        var tenantService = scope.ServiceProvider.GetService<ICurrentTenantService>();
        var propertyService = scope.ServiceProvider.GetService<ICurrentPropertyService>();
        var dispatcher = scope.ServiceProvider.GetService<INotificationDispatcher>();

        var originalTenantId = tenantService?.TenantId;
        var originalPropertyId = propertyService?.PropertyId;
        var originalIsTenantWide = propertyService?.IsTenantWide ?? false;

        var utcNow = DateTime.UtcNow;
        var vnTz = ReservationTimeHelper.GetVietnamTimeZone();
        var nowLocal = TimeZoneInfo.ConvertTimeFromUtc(utcNow, vnTz);
        var todayLocal = DateOnly.FromDateTime(nowLocal);
        var nowLocalTime = TimeOnly.FromDateTime(nowLocal);

        try
        {
            var confirmedCandidates = await context.Reservations
                .IgnoreQueryFilters()
                .Where(r => r.Status == ReservationStatus.Confirmed && r.CheckInDate <= todayLocal)
                .ToListAsync(cancellationToken);

            if (confirmedCandidates.Count == 0)
            {
                return 0;
            }

            var propertyIds = confirmedCandidates.Select(r => r.PropertyId).Distinct().ToList();
            var properties = await context.Properties
                .IgnoreQueryFilters()
                .AsNoTracking()
                .Where(p => propertyIds.Contains(p.Id))
                .ToDictionaryAsync(p => p.Id, cancellationToken);

            var expiredConfirmed = new List<Reservation>();
            foreach (var r in confirmedCandidates)
            {
                properties.TryGetValue(r.PropertyId, out var property);
                var snapshot = ReservationSnapshotHelper.TryDeserialize(r.Notes);
                var isHourly = snapshot?.RentalType == RentalType.Hourly || r.CheckInDate == r.CheckOutDate;
                var checkOutTime = property != null && property.CheckOutTime != default
                    ? property.CheckOutTime
                    : new TimeOnly(12, 0);

                bool pastCutoff;
                if (isHourly)
                {
                    if (property != null)
                    {
                        var (_, endAtUtc) = ReservationTimeHelper.GetEffectiveStayUtcInterval(r, property);
                        pastCutoff = utcNow > endAtUtc;
                    }
                    else
                    {
                        pastCutoff = r.CheckInDate < todayLocal ||
                                     (r.CheckOutDate == todayLocal && nowLocalTime > checkOutTime);
                    }
                }
                else
                {
                    pastCutoff = r.CheckInDate < todayLocal ||
                                 r.CheckOutDate < todayLocal ||
                                 (r.CheckOutDate == todayLocal && nowLocalTime > checkOutTime);
                }

                if (pastCutoff)
                {
                    expiredConfirmed.Add(r);
                }
            }

            if (expiredConfirmed.Count == 0)
            {
                return 0;
            }

            var updatedCount = 0;
            var changedReservations = new List<Reservation>();

            foreach (var group in expiredConfirmed.GroupBy(r => new { r.TenantId, r.PropertyId }))
            {
                if (tenantService != null)
                {
                    tenantService.TenantId = group.Key.TenantId;
                }

                if (propertyService != null)
                {
                    propertyService.PropertyId = group.Key.PropertyId;
                    propertyService.IsTenantWide = false;
                }

                await using var tx = await context.BeginTransactionAsync(cancellationToken);

                foreach (var r in group)
                {
                    r.Status = ReservationStatus.NoShow;
                    r.SmartLockStatus = "Revoked";
                    r.UpdatedAtUtc = utcNow;
                    updatedCount++;
                    changedReservations.Add(r);

                    try
                    {
                        context.AuditLogs.Add(new AuditLog
                        {
                            Id = Guid.NewGuid(),
                            TenantId = r.TenantId,
                            PropertyId = r.PropertyId,
                            UserId = null,
                            Action = "NightAuditAutoNoShow",
                            EntityName = nameof(Reservation),
                            EntityId = r.Id,
                            OldValues = JsonSerializer.Serialize(new { Status = nameof(ReservationStatus.Confirmed) }),
                            NewValues = JsonSerializer.Serialize(new
                            {
                                Status = nameof(ReservationStatus.NoShow),
                                SmartLockStatus = "Revoked",
                                AuditedAtUtc = utcNow
                            }),
                            CreatedAtUtc = utcNow
                        });
                    }
                    catch (NotImplementedException)
                    {
                        // Guard for test doubles without AuditLogs DbSet
                    }
                }

                await context.SaveChangesAsync(cancellationToken);
                if (tx != null)
                {
                    await tx.CommitAsync(cancellationToken);
                }
            }

            if (dispatcher != null)
            {
                foreach (var r in changedReservations)
                {
                    try
                    {
                        await dispatcher.NotifyReservationStatusChangedAsync(
                            r.PropertyId.ToString(),
                            r.Id.ToString(),
                            r.ConfirmationCode,
                            ReservationStatus.Confirmed.ToString(),
                            ReservationStatus.NoShow.ToString(),
                            cancellationToken);
                    }
                    catch
                    {
                        // Real-time dispatch failure must not undo persisted NoShow transitions
                    }
                }
            }

            return updatedCount;
        }
        finally
        {
            if (tenantService != null)
            {
                tenantService.TenantId = originalTenantId;
            }

            if (propertyService != null)
            {
                propertyService.PropertyId = originalPropertyId;
                propertyService.IsTenantWide = originalIsTenantWide;
            }
        }
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var updated = await ExecuteNightAuditIterationAsync(stoppingToken);
                if (updated > 0)
                {
                    _logger.LogInformation("Night audit automatically marked {Count} past-cutoff reservation(s) as NoShow.", updated);
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Unhandled exception while executing night audit iteration.");
            }

            try
            {
                await Task.Delay(_auditInterval, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
        }
    }
}
