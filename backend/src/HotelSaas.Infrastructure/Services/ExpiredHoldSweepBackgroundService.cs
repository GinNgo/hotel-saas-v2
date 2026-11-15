using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Public.Commands.CheckExpiredHolds;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace HotelSaas.Infrastructure.Services;

/// <summary>
/// Background worker that periodically sweeps expired 15-minute online booking holds
/// and dispatches HoldExpired SignalR events to the owning branch without requiring
/// manual API triggers, page refreshes, or an open guest countdown tab (Task Week 05 T02).
/// Discovers candidate (TenantId, PropertyId) scopes from system data and runs each in an isolated tenant/property scope.
/// </summary>
public sealed class ExpiredHoldSweepBackgroundService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<ExpiredHoldSweepBackgroundService> _logger;
    private readonly TimeSpan _sweepInterval;

    public ExpiredHoldSweepBackgroundService(
        IServiceScopeFactory scopeFactory,
        ILogger<ExpiredHoldSweepBackgroundService> logger,
        TimeSpan? sweepInterval = null)
    {
        _scopeFactory = scopeFactory ?? throw new ArgumentNullException(nameof(scopeFactory));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        _sweepInterval = sweepInterval ?? TimeSpan.FromSeconds(15);
    }

    public async Task<int> ExecuteSweepIterationAsync(CancellationToken cancellationToken)
    {
        var targetScopes = await DiscoverCandidateScopesAsync(cancellationToken);
        if (targetScopes.Count == 0)
        {
            return 0;
        }

        int totalSwept = 0;
        foreach (var targetScope in targetScopes)
        {
            if (cancellationToken.IsCancellationRequested)
            {
                break;
            }

            try
            {
                await using var scope = _scopeFactory.CreateAsyncScope();
                var tenantService = scope.ServiceProvider.GetRequiredService<ICurrentTenantService>();
                var propertyService = scope.ServiceProvider.GetRequiredService<ICurrentPropertyService>();
                var sender = scope.ServiceProvider.GetRequiredService<ISender>();

                tenantService.TenantId = targetScope.TenantId;
                propertyService.PropertyId = targetScope.PropertyId;
                propertyService.IsTenantWide = false;
                propertyService.ExcludedPropertyIds = Array.Empty<Guid>();
                propertyService.HeaderPropertyId = null;
                propertyService.TokenPropertyId = null;

                var swept = await sender.Send(new CheckExpiredHoldsCommand(PropertyId: targetScope.PropertyId), cancellationToken);
                totalSwept += swept;
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex,
                    "ExpiredHoldSweepBackgroundService failed sweeping Tenant {TenantId} / Property {PropertyId}.",
                    targetScope.TenantId, targetScope.PropertyId);
            }
        }

        return totalSwept;
    }

    private async Task<List<(Guid TenantId, Guid PropertyId)>> DiscoverCandidateScopesAsync(CancellationToken cancellationToken)
    {
        await using var discoveryScope = _scopeFactory.CreateAsyncScope();
        var context = discoveryScope.ServiceProvider.GetRequiredService<IApplicationDbContext>();

        var rows = await (
            from r in context.Reservations.IgnoreQueryFilters().AsNoTracking()
            join p in context.Properties.IgnoreQueryFilters().AsNoTracking()
                on new { r.PropertyId, r.TenantId } equals new { PropertyId = p.Id, p.TenantId }
            join t in context.Tenants.IgnoreQueryFilters().AsNoTracking()
                on p.TenantId equals t.Id
            where r.Status == ReservationStatus.PendingPayment
                  && r.Notes != null
                  && r.Notes.Contains("HoldExpiresAtUtc")
                  && p.Status == PropertyStatus.Active
                  && t.Status == TenantStatus.Active
            select new { r.TenantId, r.PropertyId })
            .Distinct()
            .OrderBy(x => x.TenantId)
            .ThenBy(x => x.PropertyId)
            .ToListAsync(cancellationToken);

        return rows.Select(x => (x.TenantId, x.PropertyId)).ToList();
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(_sweepInterval);
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var swept = await ExecuteSweepIterationAsync(stoppingToken);
                if (swept > 0)
                {
                    _logger.LogInformation("ExpiredHoldSweepBackgroundService swept {Count} expired holds.", swept);
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "ExpiredHoldSweepBackgroundService iteration encountered a transient error.");
            }

            try
            {
                if (!await timer.WaitForNextTickAsync(stoppingToken))
                {
                    break;
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
        }
    }
}
