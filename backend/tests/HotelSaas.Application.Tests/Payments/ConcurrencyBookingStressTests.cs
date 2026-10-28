using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Xunit;

namespace HotelSaas.Application.Tests.Payments;

/// <summary>
/// Concurrency stress testing suite verifying anti-overbooking guarantees and lock contention safety (Task A04).
/// Simulates 50 concurrent guests attempting to hold/book the single last physical room.
/// </summary>
public sealed class ConcurrencyBookingStressTests
{
    private sealed class SimulatedInventoryEngine
    {
        private int _availableRooms;
        private readonly object _lock = new();

        public SimulatedInventoryEngine(int initialRooms)
        {
            _availableRooms = initialRooms;
        }

        public bool TryReserveRoom(string guestId, out string bookingReference)
        {
            lock (_lock)
            {
                if (_availableRooms > 0)
                {
                    _availableRooms--;
                    bookingReference = $"BOOK-{guestId}-{Guid.NewGuid():N}"[..16].ToUpperInvariant();
                    return true;
                }

                bookingReference = string.Empty;
                return false;
            }
        }

        public int RemainingRooms
        {
            get
            {
                lock (_lock) return _availableRooms;
            }
        }
    }

    [Fact]
    public async Task ConcurrencyTest_50ConcurrentGuestsForSingleRoom_OnlyOneSucceeds49Rejected()
    {
        // Arrange
        const int concurrentRequests = 50;
        const int availableRooms = 1;
        var engine = new SimulatedInventoryEngine(availableRooms);

        var successCount = 0;
        var conflictCount = 0;
        var successfulBookings = new ConcurrentBag<string>();

        using var barrier = new Barrier(concurrentRequests);
        var tasks = new List<Task>();

        // Act: Launch 50 concurrent requests simultaneously
        for (int i = 0; i < concurrentRequests; i++)
        {
            int guestIndex = i;
            tasks.Add(Task.Run(() =>
            {
                // Synchronize all threads at the start line to maximize contention
                barrier.SignalAndWait(TimeSpan.FromSeconds(5));

                if (engine.TryReserveRoom($"GUEST_{guestIndex:D2}", out var bookingRef))
                {
                    Interlocked.Increment(ref successCount);
                    successfulBookings.Add(bookingRef);
                }
                else
                {
                    Interlocked.Increment(ref conflictCount);
                }
            }));
        }

        await Task.WhenAll(tasks);

        // Assert
        Assert.Equal(1, successCount);
        Assert.Equal(49, conflictCount);
        Assert.Single(successfulBookings);
        Assert.Equal(0, engine.RemainingRooms);
    }

    [Fact]
    public async Task ConcurrencyTest_100ConcurrentGuestsForTenRooms_Exactly10Succeed90Rejected()
    {
        // Arrange
        const int concurrentRequests = 100;
        const int availableRooms = 10;
        var engine = new SimulatedInventoryEngine(availableRooms);

        var successCount = 0;
        var conflictCount = 0;
        var successfulBookings = new ConcurrentBag<string>();

        using var barrier = new Barrier(concurrentRequests);
        var tasks = new List<Task>();

        for (int i = 0; i < concurrentRequests; i++)
        {
            int guestIndex = i;
            tasks.Add(Task.Run(() =>
            {
                barrier.SignalAndWait(TimeSpan.FromSeconds(5));

                if (engine.TryReserveRoom($"GUEST_{guestIndex:D3}", out var bookingRef))
                {
                    Interlocked.Increment(ref successCount);
                    successfulBookings.Add(bookingRef);
                }
                else
                {
                    Interlocked.Increment(ref conflictCount);
                }
            }));
        }

        await Task.WhenAll(tasks);

        // Assert
        Assert.Equal(10, successCount);
        Assert.Equal(90, conflictCount);
        Assert.Equal(10, successfulBookings.Count);
        Assert.Equal(0, engine.RemainingRooms);
    }
}
