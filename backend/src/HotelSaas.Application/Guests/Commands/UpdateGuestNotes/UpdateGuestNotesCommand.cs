using HotelSaas.Application.Common.Interfaces;
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

        var phone = request.PhoneNumber.Trim();

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
            b.GuestNotes = request.Notes;
        }

        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }
}
