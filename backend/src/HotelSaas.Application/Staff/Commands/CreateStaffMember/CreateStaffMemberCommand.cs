using FluentValidation;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Staff.DTOs;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Staff.Commands.CreateStaffMember;

public sealed record CreateStaffMemberCommand : IRequest<StaffMemberDto>
{
    public string FullName { get; init; } = string.Empty;
    public string Email { get; init; } = string.Empty;
    public string? PhoneNumber { get; init; }
    public string? Password { get; init; }
    public Guid? PropertyId { get; init; }
    public Guid? RoleId { get; init; }
    public StaffRole StaffRole { get; init; } = StaffRole.Receptionist;
}

public sealed class CreateStaffMemberCommandValidator : AbstractValidator<CreateStaffMemberCommand>
{
    public CreateStaffMemberCommandValidator()
    {
        RuleFor(x => x.FullName).NotEmpty().MaximumLength(150);
        RuleFor(x => x.Email).NotEmpty().EmailAddress().MaximumLength(200);
        RuleFor(x => x.PhoneNumber).MaximumLength(20);
    }
}

public sealed class CreateStaffMemberCommandHandler : IRequestHandler<CreateStaffMemberCommand, StaffMemberDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentTenantService _currentTenantService;
    private readonly IPasswordHasher _passwordHasher;

    public CreateStaffMemberCommandHandler(
        IApplicationDbContext context,
        ICurrentTenantService currentTenantService,
        IPasswordHasher passwordHasher)
    {
        _context = context;
        _currentTenantService = currentTenantService;
        _passwordHasher = passwordHasher;
    }

    public async Task<StaffMemberDto> Handle(
        CreateStaffMemberCommand request,
        CancellationToken cancellationToken)
    {
        var tenantId = _currentTenantService.TenantId;
        if (!tenantId.HasValue || tenantId.Value == Guid.Empty)
        {
            throw new UnauthorizedAccessException("Không xác định được tổ chức lưu trú (Tenant).");
        }

        var normalizedEmail = request.Email.Trim().ToLowerInvariant();

        // Find or create user
        var user = await _context.Users
            .FirstOrDefaultAsync(u => u.Email.ToLower() == normalizedEmail, cancellationToken);

        if (user == null)
        {
            var rawPassword = !string.IsNullOrWhiteSpace(request.Password) ? request.Password : "Staff@123456";
            user = new User
            {
                Id = Guid.NewGuid(),
                Username = normalizedEmail,
                Email = normalizedEmail,
                FullName = request.FullName.Trim(),
                PhoneNumber = request.PhoneNumber?.Trim(),
                PasswordHash = _passwordHasher.Hash(rawPassword),
                GlobalRole = GlobalUserRole.Staff,
                TenantId = tenantId.Value,
                IsActive = true,
                CreatedAtUtc = DateTime.UtcNow
            };
            _context.Users.Add(user);
        }
        else
        {
            // Update phone / name if missing
            if (!string.IsNullOrWhiteSpace(request.PhoneNumber) && string.IsNullOrWhiteSpace(user.PhoneNumber))
            {
                user.PhoneNumber = request.PhoneNumber.Trim();
            }
        }

        // Check if staff already exists in this tenant
        var existingStaff = await _context.TenantStaffMembers
            .FirstOrDefaultAsync(s => s.TenantId == tenantId.Value && s.UserId == user.Id, cancellationToken);

        if (existingStaff != null)
        {
            throw new InvalidOperationException($"Nhân viên với email {request.Email} đã thuộc tổ chức này.");
        }

        // Determine RoleId
        Guid roleId;
        AccessRole? role = null;
        if (request.RoleId.HasValue && request.RoleId.Value != Guid.Empty)
        {
            role = await _context.AccessRoles.FirstOrDefaultAsync(r => r.Id == request.RoleId.Value, cancellationToken);
            if (role == null)
            {
                throw new NotFoundException(nameof(AccessRole), request.RoleId.Value);
            }
            roleId = role.Id;
        }
        else
        {
            var targetCode = request.StaffRole.ToString().ToUpperInvariant();
            role = await _context.AccessRoles.FirstOrDefaultAsync(r => r.Code == targetCode, cancellationToken)
                ?? await _context.AccessRoles.FirstOrDefaultAsync(r => r.IsSystemRole, cancellationToken);
            roleId = role?.Id ?? Guid.Empty;
        }

        // Verify property exists if property scoped
        string? propertyName = null;
        if (request.PropertyId.HasValue && request.PropertyId.Value != Guid.Empty)
        {
            var property = await _context.Properties
                .FirstOrDefaultAsync(p => p.Id == request.PropertyId.Value && p.TenantId == tenantId.Value, cancellationToken);
            if (property == null)
            {
                throw new NotFoundException(nameof(Property), request.PropertyId.Value);
            }
            propertyName = property.Name;
        }

        var staff = new TenantStaff
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId.Value,
            PropertyId = request.PropertyId,
            UserId = user.Id,
            RoleId = roleId,
            StaffRole = request.StaffRole,
            IsActive = true,
            CreatedAtUtc = DateTime.UtcNow
        };

        _context.TenantStaffMembers.Add(staff);
        await _context.SaveChangesAsync(cancellationToken);

        return new StaffMemberDto
        {
            Id = staff.Id,
            UserId = user.Id,
            FullName = user.FullName,
            Email = user.Email,
            PhoneNumber = user.PhoneNumber,
            PropertyId = staff.PropertyId,
            PropertyName = propertyName,
            IsTenantWide = staff.PropertyId == null,
            RoleId = roleId,
            RoleCode = role?.Code ?? staff.StaffRole.ToString().ToUpperInvariant(),
            RoleName = role?.Name ?? staff.StaffRole.ToString(),
            StaffRole = staff.StaffRole,
            StaffRoleName = staff.StaffRole.ToString(),
            IsActive = staff.IsActive,
            CreatedAtUtc = staff.CreatedAtUtc
        };
    }
}
