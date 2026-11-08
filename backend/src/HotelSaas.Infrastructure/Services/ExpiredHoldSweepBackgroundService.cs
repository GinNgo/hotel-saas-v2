using System;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Public.Commands.CheckExpiredHolds;
using MediatR;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace HotelSaas.Infrastructure.Services;

/// <summary>
/// Background worker that periodically sweeps expired 15-minute online booking holds
/// and dispatches HoldExpired SignalR events to the owning branch without requiring
/// manual API triggers, page refreshes, or an open guest countdown tab (Task Week 05 T02).
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
        await using var scope = _scopeFactory.CreateAsyncScope();
        var sender = scope.ServiceProvider.GetRequiredService<ISender>();
        return await sender.Send(new CheckExpiredHoldsCommand(PropertyId: null), cancellationToken);
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
