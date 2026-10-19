namespace HotelSaas.Application.Public.DTOs;

/// <summary>
/// Data transfer object representing a dynamic AI or proximity-guided filter chip
/// (e.g. "📍 Gần Bãi Sau (< 1km)", "💰 Dưới 300k", "⭐ Đánh giá tốt (4.0+)").
/// </summary>
public sealed class SuggestedFilterChipDto
{
    public string Id { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty; // "nearby" | "price" | "rating" | "rentalType" | "amenity"
    public string FilterKey { get; set; } = string.Empty;
    public object? FilterValue { get; set; }
    public int? Count { get; set; }
    public bool IsActive { get; set; }
}
