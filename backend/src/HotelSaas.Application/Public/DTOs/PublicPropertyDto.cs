using System;

namespace HotelSaas.Application.Public.DTOs;

/// <summary>
/// Public view of an active hotel property for unauthenticated guest discovery.
/// </summary>
public sealed class PublicPropertyDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public TimeOnly CheckInTime { get; set; }
    public TimeOnly CheckOutTime { get; set; }
    public int BufferMinutes { get; set; }
    public int MaxHourlyHours { get; set; }
    public string? ImageUrl { get; set; }
}
