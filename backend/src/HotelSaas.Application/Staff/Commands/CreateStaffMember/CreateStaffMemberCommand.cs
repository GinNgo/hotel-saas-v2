using System.Security.Cryptography;
using FluentValidation;
using HotelSaas.Application.Auth.Commands.ForgotPassword;
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
    public bool ConfirmCustomerPromotion { get; init; } = false;
    public string? AppUrl { get; init; }
}

public sealed class CreateStaffMemberCommandValidator : AbstractValidator<CreateStaffMemberCommand>
{
    public CreateStaffMemberCommandValidator()
    {
        RuleFor(x => x.FullName).NotEmpty().MaximumLength(150);
        RuleFor(x => x.Email).NotEmpty().EmailAddress().MaximumLength(200);
        RuleFor(x => x.PhoneNumber).MaximumLength(20);
        RuleFor(x => x.Password)
            .MinimumLength(8).WithMessage("Mật khẩu phải có ít nhất 8 ký tự.")
            .MaximumLength(100).WithMessage("Mật khẩu không được vượt quá 100 ký tự.")
            .When(x => !string.IsNullOrWhiteSpace(x.Password));
    }
}

public sealed class CreateStaffMemberCommandHandler : IRequestHandler<CreateStaffMemberCommand, StaffMemberDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentTenantService _currentTenantService;
    private readonly IPasswordHasher _passwordHasher;
    private readonly ISubscriptionQuotaGuard? _quotaGuard;
    private readonly IJwtService? _jwtService;
    private readonly IEmailService? _emailService;

    public CreateStaffMemberCommandHandler(
        IApplicationDbContext context,
        ICurrentTenantService currentTenantService,
        IPasswordHasher passwordHasher,
        ISubscriptionQuotaGuard? quotaGuard = null,
        IJwtService? jwtService = null,
        IEmailService? emailService = null)
    {
        _context = context;
        _currentTenantService = currentTenantService;
        _passwordHasher = passwordHasher;
        _quotaGuard = quotaGuard;
        _jwtService = jwtService;
        _emailService = emailService;
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
        Guid? targetPropertyId = request.PropertyId.HasValue && request.PropertyId.Value != Guid.Empty
            ? request.PropertyId
            : null;
        var now = DateTime.UtcNow;

        // Find or create user
        var user = await _context.Users
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(u => u.Email.ToLower() == normalizedEmail, cancellationToken);

        string? inviteSetupToken = null;
        var shouldSendInvite = false;

        if (user == null)
        {
            if (_quotaGuard != null)
            {
                await _quotaGuard.EnsureCanCreateStaffAsync(tenantId.Value, cancellationToken);
            }

            var hasExplicitPassword = !string.IsNullOrWhiteSpace(request.Password);
            var rawPassword = hasExplicitPassword
                ? request.Password!
                : Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));

            user = new User
            {
                Id = Guid.NewGuid(),
                Username = normalizedEmail,
                Email = normalizedEmail,
                FullName = request.FullName.Trim(),
                PhoneNumber = request.PhoneNumber?.Trim(),
                PasswordHash = _passwordHasher.Hash(rawPassword),
                GlobalRole = GlobalUserRole.TenantStaff,
                TenantId = tenantId.Value,
                IsActive = true,
                EmailVerifiedAtUtc = now,
                PhoneVerifiedAtUtc = !string.IsNullOrWhiteSpace(request.PhoneNumber) ? now : null,
                CreatedAtUtc = now
            };
            _context.Users.Add(user);

            if (!hasExplicitPassword)
            {
                shouldSendInvite = true;
                if (_jwtService != null)
                {
                    var fingerprint = ForgotPasswordCommandHandler.ComputePasswordFingerprint(user.PasswordHash);
                    inviteSetupToken = _jwtService.GeneratePasswordResetToken(
                        user.Id,
                        user.Email,
                        fingerprint,
                        TimeSpan.FromHours(24));
                }
            }
        }
        else
        {
            if (user.GlobalRole == GlobalUserRole.Customer)
            {
                if (!request.ConfirmCustomerPromotion)
                {
                    throw new ConflictException(
                        "ERR_CUSTOMER_ACCOUNT_EXISTS",
                        "Tài khoản email này đang là Khách hàng trên hệ thống. Vui lòng xác nhận trước khi nâng cấp thành Nhân sự PMS.");
                }

                user.GlobalRole = GlobalUserRole.TenantStaff;
            }

            if (_quotaGuard != null)
            {
                var alreadyActiveStaffInTenant = await _context.TenantStaffMembers
                    .IgnoreQueryFilters()
                    .AsNoTracking()
                    .AnyAsync(s => s.TenantId == tenantId.Value && s.UserId == user.Id && s.IsActive, cancellationToken);

                if (!alreadyActiveStaffInTenant)
                {
                    await _quotaGuard.EnsureCanCreateStaffAsync(tenantId.Value, cancellationToken);
                }
            }

            user.TenantId ??= tenantId.Value;

            if (!string.IsNullOrWhiteSpace(request.PhoneNumber) && string.IsNullOrWhiteSpace(user.PhoneNumber))
            {
                user.PhoneNumber = request.PhoneNumber.Trim();
            }

            user.EmailVerifiedAtUtc ??= now;
            if (!string.IsNullOrWhiteSpace(user.PhoneNumber) || !string.IsNullOrWhiteSpace(request.PhoneNumber))
            {
                user.PhoneVerifiedAtUtc ??= now;
            }
        }

        // Check if staff already exists in this tenant + exact branch/HQ scope (allows multi-branch assignments)
        var existingStaff = await _context.TenantStaffMembers
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(
                s => s.TenantId == tenantId.Value && s.UserId == user.Id && s.PropertyId == targetPropertyId,
                cancellationToken);

        if (existingStaff != null)
        {
            throw new InvalidOperationException($"Nhân viên với email {request.Email} đã được phân công tại chi nhánh/phạm vi này.");
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
        if (targetPropertyId.HasValue)
        {
            var property = await _context.Properties
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(p => p.Id == targetPropertyId.Value && p.TenantId == tenantId.Value, cancellationToken);
            if (property == null)
            {
                throw new NotFoundException(nameof(Property), targetPropertyId.Value);
            }
            propertyName = property.Name;
        }

        var staff = new TenantStaff
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId.Value,
            PropertyId = targetPropertyId,
            UserId = user.Id,
            RoleId = roleId,
            StaffRole = request.StaffRole,
            IsActive = true,
            CreatedAtUtc = now
        };

        _context.TenantStaffMembers.Add(staff);
        await _context.SaveChangesAsync(cancellationToken);

        var invitedViaEmail = false;
        if (shouldSendInvite && !string.IsNullOrEmpty(inviteSetupToken) && _emailService != null)
        {
            var baseUrl = ForgotPasswordCommandHandler.ResolveSafeAppUrl(request.AppUrl);
            var setupUrl = $"{baseUrl}/auth/reset-password?token={Uri.EscapeDataString(inviteSetupToken)}&mode=invite";
            try
            {
                invitedViaEmail = await _emailService.SendStaffInvitationEmailAsync(
                    user.Email,
                    user.FullName,
                    setupUrl,
                    1440,
                    cancellationToken);
            }
            catch
            {
                invitedViaEmail = false;
            }
        }

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
            CreatedAtUtc = staff.CreatedAtUtc,
            InvitedViaEmail = invitedViaEmail
        };
    }
}
