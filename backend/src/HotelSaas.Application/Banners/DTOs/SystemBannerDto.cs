using System;

namespace HotelSaas.Application.Banners.DTOs;

public sealed record SystemBannerDto(
    Guid Id,
    string Title,
    string ImageUrl,
    string? TargetUrl,
    string? TargetPlanCode,
    DateTime? ValidFromUtc,
    DateTime? ValidToUtc,
    bool IsActive,
    DateTime CreatedAtUtc,
    DateTime UpdatedAtUtc
);
