using System;
using System.Collections.Generic;
using System.Text.Json;
using HotelSaas.Application.Quotes.DTOs;
using HotelSaas.Application.Reservations.Services;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;

namespace HotelSaas.Application.Reservations.DTOs;

/// <summary>
/// Helper for serializing and deserializing the immutable reservation snapshot stored in Reservation.Notes.
/// Provides safe fallback when notes contain legacy freeform text.
/// </summary>
public static class ReservationSnapshotHelper
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        WriteIndented = false
    };

    public static string Serialize(ReservationSnapshot snapshot)
    {
        return JsonSerializer.Serialize(snapshot, JsonOptions);
    }

    public static ReservationSnapshot? TryDeserialize(string? notes)
    {
        if (string.IsNullOrWhiteSpace(notes))
            return null;

        var trimmed = notes.Trim();
        if (!trimmed.StartsWith('{') || !trimmed.EndsWith('}'))
            return null;

        try
        {
            return JsonSerializer.Deserialize<ReservationSnapshot>(trimmed, JsonOptions);
        }
        catch (JsonException)
        {
            return null;
        }
    }

    public static ReservationDetailDto MapToDetailDto(Reservation r, Property property)
    {
        var snapshot = TryDeserialize(r.Notes);
        var (startUtc, endUtc) = ReservationTimeHelper.GetEffectiveStayUtcInterval(r, property);
        var rentalType = snapshot?.RentalType ?? RentalType.Overnight;

        var breakdown = snapshot?.Breakdown ?? new List<QuoteBreakdownItemDto>
        {
            new()
            {
                Description = "Tiền phòng",
                UnitPrice = r.TotalAmount,
                Quantity = 1,
                Amount = r.TotalAmount
            }
        };

        var policies = snapshot?.AppliedPolicies ?? new AppliedPoliciesDto
        {
            MaxHourlyHours = 12,
            BufferMinutes = Math.Max(30, property.BufferMinutes),
            CheckInTime = property.CheckInTime != default ? property.CheckInTime : new TimeOnly(12, 0),
            CheckOutTime = property.CheckOutTime != default ? property.CheckOutTime : new TimeOnly(12, 0)
        };

        return new ReservationDetailDto
        {
            Id = r.Id,
            TenantId = r.TenantId,
            PropertyId = r.PropertyId,
            RoomId = r.RoomId,
            RoomNumber = r.Room?.RoomNumber ?? string.Empty,
            RoomTypeId = r.Room?.RoomTypeId ?? Guid.Empty,
            RoomTypeName = r.Room?.RoomType?.Name ?? snapshot?.RoomTypeName ?? string.Empty,
            RentalType = rentalType,
            StartAtUtc = startUtc,
            EndAtUtc = endUtc,
            CheckInDate = r.CheckInDate,
            CheckOutDate = r.CheckOutDate,
            GuestName = r.GuestName,
            GuestEmail = r.GuestEmail,
            GuestPhone = r.GuestPhone,
            NumberOfGuests = r.NumberOfGuests,
            TotalAmount = r.TotalAmount,
            Currency = snapshot?.Currency ?? "VND",
            Status = r.Status,
            ConfirmationCode = r.ConfirmationCode,
            Notes = snapshot?.CustomerNotes ?? r.Notes,
            SmartLockPin = r.SmartLockPin,
            SmartLockStatus = r.SmartLockStatus,
            CreatedAtUtc = r.CreatedAtUtc,
            Breakdown = breakdown,
            AppliedPolicies = policies,
            CancelledAtUtc = r.CancelledAtUtc,
            CancellationReason = r.CancellationReason
        };
    }
}
