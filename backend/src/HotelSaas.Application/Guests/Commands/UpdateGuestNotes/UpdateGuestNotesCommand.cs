using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Reservations.DTOs;
using HotelSaas.Application.Reservations.Services;
using HotelSaas.Application.Common.Exceptions;
using System.Text.Json;
using System.Text.Json.Nodes;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Guests.Commands.UpdateGuestNotes;

public sealed record UpdateGuestNotesCommand : IRequest<bool>
{
    public string PhoneNumber { get; init; } = string.Empty;
    public string? GuestKey { get; init; }
    public string? Notes { get; init; }
    public bool? IsVip { get; init; }
    public bool? IsBlacklisted { get; init; }
}

public sealed class UpdateGuestNotesCommandHandler : IRequestHandler<UpdateGuestNotesCommand, bool>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentTenantService _currentTenantService;

    public UpdateGuestNotesCommandHandler(
        IApplicationDbContext context,
        ICurrentTenantService currentTenantService)
    {
        _context = context;
        _currentTenantService = currentTenantService;
    }

    public async Task<bool> Handle(
        UpdateGuestNotesCommand request,
        CancellationToken cancellationToken)
    {
        var tenantId = _currentTenantService.TenantId;
        if (!tenantId.HasValue || tenantId.Value == Guid.Empty)
        {
            throw new UnauthorizedAccessException("Không xác định được tổ chức lưu trú (Tenant).");
        }

        if (string.IsNullOrWhiteSpace(request.PhoneNumber) && string.IsNullOrWhiteSpace(request.GuestKey))
        {
            return false;
        }

        var phone = request.PhoneNumber?.Trim() ?? string.Empty;
        var trimmedNotes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim();

        var recentBookings = await GuestIdentity.ForGuest(_context.Reservations
            .Include(r => r.Property)
            .Where(r => r.TenantId == tenantId.Value), request.GuestKey, phone)
            .OrderByDescending(r => r.CreatedAtUtc)
            .ToListAsync(cancellationToken);

        if (recentBookings.Count == 0)
        {
            return false;
        }

        foreach (var b in recentBookings)
        {
            JsonObject document;
            if (b.Notes?.TrimStart().StartsWith('{') == true)
            {
                try
                {
                    document = JsonNode.Parse(b.Notes) as JsonObject
                        ?? throw new JsonException();
                }
                catch (JsonException)
                {
                    throw new ConflictException("ERR_INVALID_SNAPSHOT", "Dữ liệu đặt phòng không hợp lệ; không thể cập nhật hồ sơ.");
                }
            }
            else
            {
                // Convert legacy notes without changing the effective stay interval.
                var property = b.Property ?? throw new ConflictException("ERR_PROPERTY_REQUIRED", "Thiếu dữ liệu chi nhánh của đặt phòng.");
                var interval = ReservationTimeHelper.GetEffectiveStayUtcInterval(b, property);
                document = JsonSerializer.SerializeToNode(new ReservationSnapshot
                {
                    RentalType = Domain.Enums.RentalType.Overnight,
                    StartAtUtc = interval.StartAtUtc,
                    EndAtUtc = interval.EndAtUtc,
                    BufferMinutes = property.BufferMinutes,
                    TotalAmount = b.TotalAmount
                })!.AsObject();
            }
            // Retain unknown snapshot fields as well as tokens, pricing and hold metadata.
            SetField(document, nameof(ReservationSnapshot.CustomerNotes), JsonValue.Create(trimmedNotes));
            SetField(document, nameof(ReservationSnapshot.IsVip), JsonValue.Create(request.IsVip));
            if (request.IsBlacklisted.HasValue)
                SetField(document, nameof(ReservationSnapshot.IsBlacklisted), JsonValue.Create(request.IsBlacklisted.Value));
            b.Notes = document.ToJsonString();
        }

        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }

    private static void SetField(JsonObject document, string name, JsonNode? value)
    {
        foreach (var key in document.Select(x => x.Key).Where(x => string.Equals(x, name, StringComparison.OrdinalIgnoreCase)).ToArray())
            document.Remove(key);
        document[name] = value;
    }
}
