using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Staff.DTOs;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Staff.Commands.UpdateStaffMember;

public sealed record UpdateStaffMemberCommand : IRequest<StaffMemberDto>
{
    public Guid Id { get; init; }
    public Guid? PropertyId { get; init; }
    public Guid? RoleId { get; init; }
    public StaffRole? StaffRole { get; init; }
    public bool? IsActive { get; init; }
}

public sealed class UpdateStaffMemberCommandHandler : IRequestHandler<UpdateStaffMemberCommand, StaffMemberDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentTenantService _currentTenantService;

    public UpdateStaffMemberCommandHandler(
        IApplicationDbContext context,
        ICurrentTenantService currentTenantService)
    {
        _context = context;
        _currentTenantService = currentTenantService;
    }

    public async Task<StaffMemberDto> Handle(
        UpdateStaffMemberCommand request,
        CancellationToken cancellationToken)
    {
        var tenantId = _currentTenantService.TenantId;
        if (!tenantId.HasValue || tenantId.Value == Guid.Empty)
        {
            throw new UnauthorizedAccessException("Không xác định được tổ chức lưu trú (Tenant).");
        }

        var staff = await _context.TenantStaffMembers
            .Include(s => s.User)
            .Include(s => s.Property)
            .Include(s => s.Role)
            .FirstOrDefaultAsync(s => s.Id == request.Id && s.TenantId == tenantId.Value, cancellationToken);

        if (staff == null)
        {
            throw new NotFoundException(nameof(TenantStaff), request.Id);
        }

        if (request.PropertyId.HasValue)
        {
            if (request.PropertyId.Value == Guid.Empty)
            {
                staff.PropertyId = null;
            }
            else
            {
                var exists = await _context.Properties
                    .AnyAsync(p => p.Id == request.PropertyId.Value && p.TenantId == tenantId.Value, cancellationToken);
                if (!exists)
                {
                    throw new NotFoundException(nameof(Property), request.PropertyId.Value);
                }
                staff.PropertyId = request.PropertyId.Value;
            }
        }

        if (request.RoleId.HasValue && request.RoleId.Value != Guid.Empty)
        {
            var roleExists = await _context.AccessRoles
                .AnyAsync(r => r.Id == request.RoleId.Value, cancellationToken);
            if (!roleExists)
            {
                throw new NotFoundException(nameof(AccessRole), request.RoleId.Value);
            }
            staff.RoleId = request.RoleId.Value;
        }

        if (request.StaffRole.HasValue)
        {
            staff.StaffRole = request.StaffRole.Value;
        }

        if (request.IsActive.HasValue)
        {
            staff.IsActive = request.IsActive.Value;
        }

        await _context.SaveChangesAsync(cancellationToken);

        // Reload fresh property and role
        var property = staff.PropertyId.HasValue
            ? await _context.Properties.AsNoTracking().FirstOrDefaultAsync(p => p.Id == staff.PropertyId.Value, cancellationToken)
            : null;

        var role = await _context.AccessRoles.AsNoTracking().FirstOrDefaultAsync(r => r.Id == staff.RoleId, cancellationToken);

        return new StaffMemberDto
        {
            Id = staff.Id,
            UserId = staff.UserId,
            FullName = staff.User != null ? staff.User.FullName : "—",
            Email = staff.User != null ? staff.User.Email : string.Empty,
            PhoneNumber = staff.User?.PhoneNumber,
            PropertyId = staff.PropertyId,
            PropertyName = property?.Name,
            IsTenantWide = staff.PropertyId == null,
            RoleId = staff.RoleId,
            RoleCode = role?.Code ?? staff.StaffRole.ToString().ToUpperInvariant(),
            RoleName = role?.Name ?? staff.StaffRole.ToString(),
            StaffRole = staff.StaffRole,
            StaffRoleName = staff.StaffRole.ToString(),
            IsActive = staff.IsActive,
            CreatedAtUtc = staff.CreatedAtUtc
        };
    }
}
