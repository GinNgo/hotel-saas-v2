using System;
using HotelSaas.Application.Reservations.DTOs;
using HotelSaas.Domain.Enums;
using MediatR;

namespace HotelSaas.Application.Reservations.Commands.CreateReservation;

/// <summary>
/// Command to create a confirmed internal booking for a specific physical room.
/// Integrates Quote Engine calculation, enforces row-level locking on Room,
/// validates non-overlapping availability with turnover buffer >= 30m, and records an immutable snapshot.
/// </summary>
public sealed record CreateReservationCommand(
    Guid PropertyId,
    Guid RoomId,
    RentalType RentalType,
    DateTime StartAtUtc,
    DateTime EndAtUtc,
    DateOnly? CheckInDate,
    DateOnly? CheckOutDate,
    string GuestName,
    string GuestEmail,
    string? GuestPhone,
    int NumberOfGuests = 1,
    string? CustomerNotes = null,
    decimal? ExpectedTotalAmount = null,
    string? IdempotencyKey = null
) : IRequest<ReservationDetailDto>;
