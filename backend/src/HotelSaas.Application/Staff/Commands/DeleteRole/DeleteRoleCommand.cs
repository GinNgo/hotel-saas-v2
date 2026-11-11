using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Staff.Commands.DeleteRole;

public sealed record DeleteRoleCommand(Guid Id) : IRequest<bool>;

public sealed class DeleteRoleCommandHandler : IRequestHandler<DeleteRoleCommand, bool>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentTenantService _currentTenantService;

    public DeleteRoleCommandHandler(
        IApplicationDbContext context,
        ICurrentTenantService currentTenantService)
    {
        _context = context;
        _currentTenantService = currentTenantService;
    }

    public async Task<bool> Handle(
        DeleteRoleCommand request,
        CancellationToken cancellationToken)
    {
        var tenantId = _currentTenantService.TenantId;

        var role = await _context.AccessRoles
            .Include(r => r.Permissions)
            .FirstOrDefaultAsync(r => r.Id == request.Id, cancellationToken);

        if (role == null)
        {
            throw new NotFoundException(nameof(AccessRole), request.Id);
        }

        if (role.IsSystemRole)
        {
            throw new InvalidOperationException("Không thể xóa chức vụ mặc định của hệ thống.");
        }

        if (tenantId.HasValue && role.TenantId.HasValue && role.TenantId.Value != tenantId.Value)
        {
            throw new UnauthorizedAccessException("Bạn không có quyền xóa chức vụ của tổ chức khác.");
        }

        // Check if any active staff members are assigned to this role
        var hasStaff = await _context.TenantStaffMembers
            .AnyAsync(s => s.RoleId == role.Id, cancellationToken);

        if (hasStaff)
        {
            throw new InvalidOperationException("Không thể xóa chức vụ đang được gán cho nhân viên. Hãy phân công lại vai trò cho nhân viên trước.");
        }

        _context.RolePermissions.RemoveRange(role.Permissions);
        _context.AccessRoles.Remove(role);
        await _context.SaveChangesAsync(cancellationToken);

        return true;
    }
}
