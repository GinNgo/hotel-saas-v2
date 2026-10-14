using System;
using HotelSaas.Application.Reservations.DTOs;
using HotelSaas.Domain.Entities;

namespace HotelSaas.Application.Reservations.Services;

/// <summary>
/// Operational time and interval calculation utilities for reservations and availability checking.
/// Enforces Asia/Ho_Chi_Minh timezone conversion (Decision D11), turnover buffer >= 30m (Decision D07),
/// and standard check-in/out boundaries (Decision D06).
/// </summary>
public static class ReservationTimeHelper
{
    public const int MinimumTurnoverBufferMinutes = 30;

    public static TimeZoneInfo GetVietnamTimeZone()
    {
        if (TimeZoneInfo.TryFindSystemTimeZoneById("Asia/Ho_Chi_Minh", out var tz)) return tz;
        if (TimeZoneInfo.TryFindSystemTimeZoneById("SE Asia Standard Time", out tz)) return tz;
        return TimeZoneInfo.CreateCustomTimeZone("Asia/Ho_Chi_Minh", TimeSpan.FromHours(7), "ICT", "ICT");
    }

    public static (DateTime StartAtUtc, DateTime EndAtUtc) GetOvernightUtcInterval(
        DateOnly checkInDate,
        DateOnly checkOutDate,
        TimeOnly checkInTime,
        TimeOnly checkOutTime)
    {
        var tz = GetVietnamTimeZone();
        var startLocal = checkInDate.ToDateTime(checkInTime);
        var endLocal = checkOutDate.ToDateTime(checkOutTime);
        var startUtc = TimeZoneInfo.ConvertTimeToUtc(startLocal, tz);
        var endUtc = TimeZoneInfo.ConvertTimeToUtc(endLocal, tz);
        return (startUtc, endUtc);
    }

    public static (DateOnly CheckInDate, DateOnly CheckOutDate) GetHourlyLocalDates(
        DateTime startAtUtc,
        DateTime endAtUtc)
    {
        var tz = GetVietnamTimeZone();
        var startLocal = TimeZoneInfo.ConvertTimeFromUtc(startAtUtc, tz);
        var endLocal = TimeZoneInfo.ConvertTimeFromUtc(endAtUtc, tz);
        return (DateOnly.FromDateTime(startLocal), DateOnly.FromDateTime(endLocal));
    }

    /// <summary>
    /// Extracts the effective UTC stay interval [StartAtUtc, EndAtUtc) from a reservation.
    /// Prefers the immutable JSON snapshot in Notes if present, otherwise computes from CheckInDate/CheckOutDate.
    /// </summary>
    public static (DateTime StartAtUtc, DateTime EndAtUtc) GetEffectiveStayUtcInterval(
        Reservation reservation,
        Property property)
    {
        var snapshot = ReservationSnapshotHelper.TryDeserialize(reservation.Notes);
        if (snapshot != null)
        {
            return (snapshot.StartAtUtc, snapshot.EndAtUtc);
        }

        // Fallback for overnight reservations or records created before snapshot format
        var checkInTime = property.CheckInTime;
        var checkOutTime = property.CheckOutTime;
        return GetOvernightUtcInterval(reservation.CheckInDate, reservation.CheckOutDate, checkInTime, checkOutTime);
    }

    /// <summary>
    /// Evaluates whether two stays on the same physical room conflict, accounting for the required turnover buffer.
    /// Conflict exists iff: startA &lt; endB + Buffer AND startB &lt; endA + Buffer.
    /// </summary>
    public static bool HasOverlap(
        DateTime startA, DateTime endA,
        DateTime startB, DateTime endB,
        int bufferMinutes)
    {
        var effectiveBuffer = TimeSpan.FromMinutes(Math.Max(MinimumTurnoverBufferMinutes, bufferMinutes));
        return startA < endB + effectiveBuffer && startB < endA + effectiveBuffer;
    }

    /// <summary>
    /// Checks whether an existing reservation currently blocks the room inventory.
    /// In accordance with Decision D03, online holds (PendingPayment with HoldExpiresAtUtc)
    /// expire after 15 minutes and immediately release inventory, even before cleanup runs.
    /// </summary>
    public static bool IsBlockingReservation(Reservation reservation, DateTime nowUtc)
    {
        if (reservation.Status == Domain.Enums.ReservationStatus.Cancelled ||
            reservation.Status == Domain.Enums.ReservationStatus.CheckedOut)
        {
            return false;
        }

        if (reservation.Status == Domain.Enums.ReservationStatus.PendingPayment)
        {
            var snapshot = ReservationSnapshotHelper.TryDeserialize(reservation.Notes);
            if (snapshot?.HoldExpiresAtUtc.HasValue == true && snapshot.HoldExpiresAtUtc.Value <= nowUtc)
            {
                // Expired online hold no longer blocks inventory (Decision D03)
                return false;
            }
        }

        return true;
    }
}
