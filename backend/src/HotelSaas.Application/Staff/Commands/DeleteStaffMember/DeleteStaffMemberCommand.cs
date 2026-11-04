using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Staff.Commands.DeleteStaffMember;

public sealed record DeleteStaffMemberCommand(Guid Id) : IRequest<bool>;

public sealed class DeleteStaffMemberCommandHandler : IRequestHandler<DeleteStaffMemberCommand, bool>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentTenantService _currentTenantService;

    public DeleteStaffMemberCommandHandler(
        IApplicationDbContext context,
        ICurrentTenantService currentTenantService)
    {
        _context = context;
        _currentTenantService = currentTenantService;
    }

    public async Task<bool> Handle(
        DeleteStaffMemberCommand request,
        CancellationToken cancellationToken)
    {
        var tenantId = _currentTenantService.TenantId;
        if (!tenantId.HasValue || tenantId.Value == Guid.Empty)
        {
            throw new UnauthorizedAccessException("Không xác định được tổ chức lưu trú (Tenant).");
        }

        var staff = await _context.TenantStaffMembers
            .FirstOrDefaultAsync(s => s.Id == request.Id && s.TenantId == tenantId.Value, cancellationToken);

        if (staff == null)
        {
            throw new NotFoundException(nameof(TenantStaff), request.Id);
        }

        // Prevent deleting the only Owner of the tenant
        if (staff.StaffRole == StaffRole.Owner)
        {
            var otherOwners = await _context.TenantStaffMembers
                .CountAsync(s => s.TenantId == tenantId.Value && s.StaffRole == StaffRole.Owner && s.Id != request.Id && s.IsActive, cancellationToken);

            if (otherOwners == 0)
            {
                throw new InvalidOperationException("Không thể xóa chủ cơ sở (Owner) duy nhất của hệ thống.");
            }
        }

        _context.TenantStaffMembers.Remove(staff);
        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }
}
