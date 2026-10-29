using System;
using HotelSaas.Domain.Enums;

namespace HotelSaas.Application.Reviews.DTOs;

/// <summary>
/// Data transfer object representing a verified guest review.
/// </summary>
public sealed class GuestReviewDto
{
    public Guid Id { get; set; }
    public Guid PropertyId { get; set; }
    public string PropertyName { get; set; } = string.Empty;
    public string GuestName { get; set; } = string.Empty;
    public int Rating { get; set; }
    public int? CleanlinessRating { get; set; }
    public int? LocationRating { get; set; }
    public int? ServiceRating { get; set; }
    public int? ValueRating { get; set; }
    public string? Comment { get; set; }
    public string? OwnerReply { get; set; }
    public DateTime? RepliedAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public string RentalType { get; set; } = "Daily";
    public string? RoomTypeName { get; set; }
}
