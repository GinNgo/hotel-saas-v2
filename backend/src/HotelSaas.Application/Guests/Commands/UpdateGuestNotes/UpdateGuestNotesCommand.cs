using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Reservations.DTOs;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Guests.Commands.UpdateGuestNotes;

public sealed record UpdateGuestNotesCommand : IRequest<bool>
{
    public string PhoneNumber { get; init; } = string.Empty;
    public string? Notes { get; init; }
    public bool? IsVip { get; init; }
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

        if (string.IsNullOrWhiteSpace(request.PhoneNumber))
        {
            return false;
        }

        var phone = request.PhoneNumber.Trim();
        var trimmedNotes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim();

        var recentBookings = await _context.Reservations
            .Where(r => r.TenantId == tenantId.Value && r.GuestPhone == phone)
            .OrderByDescending(r => r.CreatedAtUtc)
            .Take(5)
            .ToListAsync(cancellationToken);

        if (recentBookings.Count == 0)
        {
            return false;
        }

        foreach (var b in recentBookings)
        {
            var snapshot = ReservationSnapshotHelper.TryDeserialize(b.Notes);
            if (snapshot != null)
            {
                // Preserve LookupToken, RentalType, pricing breakdown, and TTL fields inside ReservationSnapshot JSON
                snapshot.CustomerNotes = trimmedNotes;
                b.Notes = ReservationSnapshotHelper.Serialize(snapshot);
            }
            else if (b.Notes == null || !b.Notes.TrimStart().StartsWith('{'))
            {
                // Legacy freeform reservation without JSON snapshot
                b.Notes = trimmedNotes;
            }
        }

        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }
}
