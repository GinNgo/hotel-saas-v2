using System;
using System.Collections.Generic;
using System.Globalization;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;

namespace HotelSaas.Application.Promotions.DTOs;

/// <summary>
/// Back-office DTO for managing tenant-scoped promotional codes and offers.
/// </summary>
public sealed record PromotionDto
{
    public Guid Id { get; init; }
    public Guid TenantId { get; init; }
    public string Code { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string? Description { get; init; }
    public PromotionType Type { get; init; }
    public string TypeName { get; init; } = string.Empty;
    public decimal Value { get; init; }
    public int MinNights { get; init; }
    public int? MaxUsage { get; init; }
    public int CurrentUsage { get; init; }
    public DateTime StartsAtUtc { get; init; }
    public DateTime EndsAtUtc { get; init; }
    public bool IsActive { get; init; }
    public DateTime CreatedAtUtc { get; init; }
    public DateTime UpdatedAtUtc { get; init; }
}

/// <summary>
/// Public promotional deal DTO displayed on guest discovery and deals pages.
/// </summary>
public sealed record PublicPromotionDealDto
{
    public Guid Id { get; init; }
    public string Code { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string Title { get; init; } = string.Empty;
    public string Description { get; init; } = string.Empty;
    public string DiscountBadge { get; init; } = string.Empty;
    public string DiscountType { get; init; } = "Percent";
    public PromotionType Type { get; init; }
    public decimal Value { get; init; }
    public decimal DiscountValue { get; init; }
    public int MinNights { get; init; }
    public int? MaxUsage { get; init; }
    public int CurrentUsage { get; init; }
    public DateTime StartsAtUtc { get; init; }
    public DateTime EndsAtUtc { get; init; }
    public string ExpiresAt { get; init; } = string.Empty;
    public string TenantName { get; init; } = string.Empty;
    public string? PropertySlug { get; init; }
    public IReadOnlyList<string> ApplicableDestinations { get; init; } = Array.Empty<string>();
}

internal static class PromotionMapper
{
    private static readonly CultureInfo ViCulture = CultureInfo.GetCultureInfo("vi-VN");

    public static DateTime NormalizeUtc(DateTime value)
    {
        return value.Kind switch
        {
            DateTimeKind.Utc => value,
            DateTimeKind.Local => value.ToUniversalTime(),
            _ => DateTime.SpecifyKind(value, DateTimeKind.Utc)
        };
    }

    public static PromotionDto ToDto(Promotion entity)
    {
        return new PromotionDto
        {
            Id = entity.Id,
            TenantId = entity.TenantId,
            Code = entity.Code,
            Name = entity.Name,
            Description = entity.Description,
            Type = entity.Type,
            TypeName = entity.Type.ToString(),
            Value = entity.Value,
            MinNights = entity.MinNights,
            MaxUsage = entity.MaxUsage,
            CurrentUsage = entity.CurrentUsage,
            StartsAtUtc = entity.StartsAtUtc,
            EndsAtUtc = entity.EndsAtUtc,
            IsActive = entity.IsActive,
            CreatedAtUtc = entity.CreatedAtUtc,
            UpdatedAtUtc = entity.UpdatedAtUtc
        };
    }

    public static PublicPromotionDealDto ToPublicDealDto(
        Promotion entity,
        string tenantName,
        string? propertySlug,
        IReadOnlyList<string> destinations)
    {
        var (discountType, discountBadge) = entity.Type switch
        {
            PromotionType.PercentDiscount => ("Percent", $"GIẢM {entity.Value:0.##}%"),
            PromotionType.FixedDiscount => ("Amount", $"-{entity.Value.ToString("N0", ViCulture)}₫"),
            PromotionType.FreeNight => ("FreeNight", $"TẶNG {(int)Math.Max(1m, Math.Floor(entity.Value))} ĐÊM"),
            _ => ("Percent", $"{entity.Value:0.##}")
        };

        return new PublicPromotionDealDto
        {
            Id = entity.Id,
            Code = entity.Code,
            Name = entity.Name,
            Title = entity.Name,
            Description = entity.Description ?? string.Empty,
            DiscountBadge = discountBadge,
            DiscountType = discountType,
            Type = entity.Type,
            Value = entity.Value,
            DiscountValue = entity.Value,
            MinNights = entity.MinNights,
            MaxUsage = entity.MaxUsage,
            CurrentUsage = entity.CurrentUsage,
            StartsAtUtc = entity.StartsAtUtc,
            EndsAtUtc = entity.EndsAtUtc,
            ExpiresAt = entity.EndsAtUtc.ToString("O"),
            TenantName = tenantName,
            PropertySlug = propertySlug,
            ApplicableDestinations = destinations
        };
    }
}
