using System;

namespace HotelSaas.Application.Guest.DTOs;

public sealed record GuestCapabilitiesDto(
    bool CanEditName,
    bool CanViewBookings
);

public sealed record GuestMeDto(
    Guid Id,
    string FullName,
    string Email,
    string? PhoneNumber,
    bool EmailVerified,
    GuestCapabilitiesDto Capabilities
);

public sealed record GuestPropertySummaryDto(
    Guid Id,
    string Name,
    string Slug,
    string? Address,
    string? City
);

public sealed record GuestBookingSummaryDto(
    Guid Id,
    string Reference,
    GuestPropertySummaryDto Property,
    string RoomTypeName,
    string RentalType,
    DateOnly CheckInDate,
    DateOnly CheckOutDate,
    string Status,
    decimal TotalAmount,
    string Currency = "VND",
    DateTime CreatedAtUtc = default
);

public sealed record GuestBookingDetailDto(
    Guid Id,
    string Reference,
    GuestPropertySummaryDto Property,
    string RoomTypeName,
    string? RoomNumber,
    string RentalType,
    DateOnly CheckInDate,
    DateOnly CheckOutDate,
    string Status,
    decimal TotalAmount,
    int NumberOfGuests,
    int PointsRedeemed,
    decimal PointsDiscountAmount,
    string? BuyerCompanyName,
    string? BuyerTaxCode,
    string? BuyerAddress,
    string Currency = "VND",
    DateTime CreatedAtUtc = default
);
