using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Quotes.DTOs;
using HotelSaas.Application.Reservations.DTOs;
using HotelSaas.Application.Reservations.Services;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Reservations.Commands.CheckOutReservation;

internal static class StaySurchargeCalculator
{
    public static async Task<(decimal Amount, string Description)> CalculateSurchargeAsync(
        IApplicationDbContext context,
        Guid tenantId,
        Property property,
        Reservation reservation,
        Room? room,
        SurchargeType surchargeType,
        DateTime utcNow,
        CancellationToken cancellationToken)
    {
        var vnTz = ReservationTimeHelper.GetVietnamTimeZone();
        var nowLocal = TimeZoneInfo.ConvertTimeFromUtc(utcNow, vnTz);
        var nowLocalDate = DateOnly.FromDateTime(nowLocal);
        var nowLocalTime = TimeOnly.FromDateTime(nowLocal);

        var snapshot = ReservationSnapshotHelper.TryDeserialize(reservation.Notes);
        var nightlyRate = ResolveNightlyBaseRate(reservation, room, snapshot);
        if (nightlyRate <= 0m)
        {
            return (0m, string.Empty);
        }

        if (surchargeType == SurchargeType.LateCheckOut)
        {
            var isLate = nowLocalDate > reservation.CheckOutDate ||
                         (nowLocalDate == reservation.CheckOutDate && nowLocalTime > property.CheckOutTime);
            if (!isLate)
            {
                return (0m, string.Empty);
            }
        }
        else
        {
            var isEarly = nowLocalDate < reservation.CheckInDate ||
                          (nowLocalDate == reservation.CheckInDate && nowLocalTime < property.CheckInTime);
            if (!isEarly)
            {
                return (0m, string.Empty);
            }
        }

        List<PropertySurchargePolicy> policies;
        try
        {
            policies = await context.PropertySurchargePolicies
                .AsNoTracking()
                .Where(sp => sp.TenantId == tenantId &&
                             sp.PropertyId == property.Id &&
                             sp.SurchargeType == surchargeType &&
                             sp.IsActive)
                .ToListAsync(cancellationToken);
        }
        catch (NotImplementedException)
        {
            policies = new List<PropertySurchargePolicy>();
        }

        PropertySurchargePolicy? matchingPolicy = policies
            .FirstOrDefault(sp => sp.FromTime <= nowLocalTime && nowLocalTime <= sp.ToTime);

        if (matchingPolicy == null && surchargeType == SurchargeType.LateCheckOut && nowLocalDate > reservation.CheckOutDate)
        {
            matchingPolicy = policies
                .OrderByDescending(sp => sp.ToTime)
                .FirstOrDefault();
        }

        if (matchingPolicy != null)
        {
            var amount = matchingPolicy.CalculationMethod == SurchargeCalculationMethod.PercentageOfNightly
                ? Math.Round(nightlyRate * ((matchingPolicy.Percentage ?? 0m) / 100m), 0, MidpointRounding.AwayFromZero)
                : Math.Round(matchingPolicy.FlatAmount ?? 0m, 0, MidpointRounding.AwayFromZero);

            var label = surchargeType == SurchargeType.LateCheckOut
                ? $"Phụ thu trả phòng muộn ({matchingPolicy.FromTime:HH\\:mm} - {matchingPolicy.ToTime:HH\\:mm})"
                : $"Phụ thu nhận phòng sớm ({matchingPolicy.FromTime:HH\\:mm} - {matchingPolicy.ToTime:HH\\:mm})";

            return (Math.Max(0m, amount), label);
        }

        if (policies.Count == 0 && surchargeType == SurchargeType.LateCheckOut)
        {
            var fallbackPct = nowLocalDate > reservation.CheckOutDate || nowLocalTime >= new TimeOnly(18, 0)
                ? 1.00m
                : 0.50m;
            var fallbackAmount = Math.Round(nightlyRate * fallbackPct, 0, MidpointRounding.AwayFromZero);
            var label = nowLocalDate > reservation.CheckOutDate
                ? "Phụ thu trả phòng quá ngày (100%)"
                : $"Phụ thu trả phòng muộn ({nowLocalTime:HH\\:mm})";
            return (fallbackAmount, label);
        }

        return (0m, string.Empty);
    }

    public static void RecalculateInvoiceBreakdown(Invoice invoice)
    {
        var denominator = 1m + invoice.TaxRate + invoice.ServiceFeeRate;
        if (invoice.TaxRate > 0m || invoice.ServiceFeeRate > 0m)
        {
            var netBase = Math.Round(invoice.GrandTotal / denominator, 0, MidpointRounding.AwayFromZero);
            invoice.TaxAmount = Math.Round(netBase * invoice.TaxRate, 0, MidpointRounding.AwayFromZero);
            invoice.ServiceFeeAmount = Math.Round(netBase * invoice.ServiceFeeRate, 0, MidpointRounding.AwayFromZero);
            invoice.Subtotal = Math.Max(0m, invoice.GrandTotal + invoice.DiscountAmount - invoice.TaxAmount - invoice.ServiceFeeAmount);
        }
        else
        {
            invoice.TaxAmount = 0m;
            invoice.ServiceFeeAmount = 0m;
            invoice.Subtotal = Math.Max(0m, invoice.GrandTotal + invoice.DiscountAmount);
        }

        invoice.Balance = Math.Max(0m, invoice.GrandTotal - invoice.PaidAmount);
    }

    public static ReservationSnapshot AppendSurchargeToSnapshot(
        Reservation reservation,
        Property property,
        Room? room,
        decimal amount,
        string description,
        DateTime utcNow)
    {
        var snapshot = ReservationSnapshotHelper.TryDeserialize(reservation.Notes);
        var (startUtc, endUtc) = ReservationTimeHelper.GetEffectiveStayUtcInterval(reservation, property);
        if (snapshot == null)
        {
            var rentalType = reservation.CheckInDate == reservation.CheckOutDate
                ? RentalType.Hourly
                : RentalType.Overnight;
            snapshot = new ReservationSnapshot
            {
                RentalType = rentalType,
                StartAtUtc = startUtc,
                EndAtUtc = endUtc,
                BufferMinutes = Math.Max(30, property.BufferMinutes),
                RoomTypeId = room?.RoomTypeId ?? Guid.Empty,
                RoomTypeName = room?.RoomType?.Name ?? string.Empty,
                TotalAmount = reservation.TotalAmount,
                Currency = "VND",
                CustomerNotes = reservation.Notes,
                Breakdown = new[]
                {
                    new QuoteBreakdownItemDto
                    {
                        Description = $"Tiền phòng {room?.RoomType?.Name ?? string.Empty}".Trim(),
                        UnitPrice = reservation.TotalAmount,
                        Quantity = 1,
                        Amount = reservation.TotalAmount,
                        Category = "RoomCharge"
                    }
                },
                AppliedPolicies = new AppliedPoliciesDto
                {
                    MaxHourlyHours = property.MaxHourlyHours > 0 ? property.MaxHourlyHours : 12,
                    BufferMinutes = Math.Max(30, property.BufferMinutes),
                    CheckInTime = property.CheckInTime != default ? property.CheckInTime : new TimeOnly(12, 0),
                    CheckOutTime = property.CheckOutTime != default ? property.CheckOutTime : new TimeOnly(12, 0)
                }
            };
        }

        var breakdown = snapshot.Breakdown?.ToList() ?? new List<QuoteBreakdownItemDto>();
        breakdown.Add(new QuoteBreakdownItemDto
        {
            Description = description,
            UnitPrice = amount,
            Quantity = 1,
            Amount = amount,
            Category = "Surcharge"
        });

        snapshot.Breakdown = breakdown;
        snapshot.TotalAmount = reservation.TotalAmount + amount;
        reservation.TotalAmount += amount;
        reservation.UpdatedAtUtc = utcNow;
        reservation.Notes = ReservationSnapshotHelper.Serialize(snapshot);
        return snapshot;
    }

    private static decimal ResolveNightlyBaseRate(Reservation reservation, Room? room, ReservationSnapshot? snapshot)
    {
        var roomBreakdown = snapshot?.Breakdown?
            .LastOrDefault(b => string.Equals(b.Category, "RoomCharge", StringComparison.OrdinalIgnoreCase) && b.UnitPrice > 0m);
        if (roomBreakdown != null)
        {
            return roomBreakdown.UnitPrice;
        }

        if (room?.RoomType != null && room.RoomType.BasePrice > 0m)
        {
            return room.RoomType.BasePrice;
        }

        var nights = Math.Max(1, reservation.CheckOutDate.DayNumber - reservation.CheckInDate.DayNumber);
        return Math.Round(reservation.TotalAmount / nights, 0, MidpointRounding.AwayFromZero);
    }
}
