using System;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Auth.DTOs;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Common.Utils;
using HotelSaas.Application.Public.Services;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Auth.Commands.RegisterPartner;

/// <summary>
/// Handles partner hotel registration: validates email and 2-level administrative location,
/// supports both brand-new partners and existing logged-in customer accounts upgrading to hotel owners,
/// creates the tenant enterprise, primary physical branch, owner staff profile, and assigns starter subscription.
/// </summary>
public sealed class RegisterPartnerCommandHandler : IRequestHandler<RegisterPartnerCommand, RegisterPartnerResponse>
{
    private readonly IApplicationDbContext _context;
    private readonly IPasswordHasher _passwordHasher;
    private readonly ILocationLookupService _locationService;
    private readonly ICurrentUserContext _userContext;

    /// <summary>
    /// Initializes a new instance of <see cref="RegisterPartnerCommandHandler"/>.
    /// </summary>
    public RegisterPartnerCommandHandler(
        IApplicationDbContext context,
        IPasswordHasher passwordHasher,
        ILocationLookupService locationService,
        ICurrentUserContext userContext)
    {
        _context = context;
        _passwordHasher = passwordHasher;
        _locationService = locationService;
        _userContext = userContext;
    }

    /// <inheritdoc />
    public async Task<RegisterPartnerResponse> Handle(RegisterPartnerCommand request, CancellationToken cancellationToken)
    {
        var emailNormalized = request.Email.Trim().ToLowerInvariant();

        // 1. Resolve User (Existing Authenticated User, Existing by Email, or New User)
        User? user = null;

        if (_userContext.IsAuthenticated && _userContext.UserId != Guid.Empty)
        {
            // Scenario A: Caller is already authenticated (e.g. Logged-in Customer upgrading to Partner)
            user = await _context.Users
                .FirstOrDefaultAsync(u => u.Id == _userContext.UserId, cancellationToken);
        }

        if (user == null)
        {
            // Scenario B: Check if an account already exists with this email
            var existingUser = await _context.Users
                .FirstOrDefaultAsync(u => u.Email.ToLower() == emailNormalized, cancellationToken);

            if (existingUser != null)
            {
                // Verify password to authenticate the upgrade if not logged in
                if (string.IsNullOrWhiteSpace(request.Password) ||
                    !_passwordHasher.Verify(request.Password, existingUser.PasswordHash))
                {
                    throw new ConflictException("Email này đã được sử dụng. Vui lòng đăng nhập bằng tài khoản này để tiếp tục đăng ký mở khách sạn.");
                }

                user = existingUser;
            }
        }

        // 2. Validate Vietnamese 2-level administrative location
        var province = _locationService.GetProvinceByCode(request.ProvinceCode);
        if (province == null)
        {
            throw new BadRequestException("ERR_INVALID_PROVINCE", "Tỉnh/Thành phố được chọn không hợp lệ.");
        }

        WardDto? ward = null;
        if (!string.IsNullOrWhiteSpace(request.WardCode))
        {
            ward = _locationService.GetWardByCode(request.ProvinceCode, request.WardCode);
            if (ward == null)
            {
                throw new BadRequestException("ERR_INVALID_WARD", "Phường/Xã không thuộc Tỉnh/Thành phố đã chọn.");
            }
        }

        // Format physical address: "123 Street, Ward, Province"
        var formattedAddress = ward != null
            ? $"{request.Address.Trim()}, {ward.Name}, {province.Name}"
            : $"{request.Address.Trim()}, {province.Name}";

        // 3. Resolve system OWNER role
        var ownerRole = await _context.AccessRoles
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(r => r.Code == "OWNER", cancellationToken);

        if (ownerRole == null)
        {
            ownerRole = await _context.AccessRoles
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(r => r.IsSystemRole, cancellationToken);

            if (ownerRole == null)
            {
                throw new InvalidOperationException("Hệ thống chưa được khởi tạo vai trò quản trị (OWNER role missing).");
            }
        }

        // 4. Generate unique identifiers and slugs
        var tenantId = Guid.NewGuid();
        var propertyId = Guid.NewGuid();

        var baseSlug = GenerateSlug(request.PropertyName);
        var tenantSlug = await EnsureUniqueTenantSlugAsync(baseSlug, cancellationToken);
        var propertySlug = await EnsureUniquePropertySlugAsync(baseSlug, cancellationToken);
        var tenantCode = "TNT-" + tenantId.ToString("N")[..6].ToUpperInvariant();

        // 5. Create Tenant Enterprise
        var tenant = new Tenant
        {
            Id = tenantId,
            Name = request.PropertyName.Trim(),
            Code = tenantCode,
            Slug = tenantSlug,
            Address = formattedAddress,
            City = province.Name,
            PhoneNumber = request.PhoneNumber.Trim(),
            Email = emailNormalized,
            Status = TenantStatus.Active,
            SubscriptionTier = SubscriptionTier.Basic,
            CheckInTime = new TimeOnly(14, 0),
            CheckOutTime = new TimeOnly(12, 0),
            TaxRatePercent = 0m,
            ServiceFeeRatePercent = 0m
        };
        _context.Tenants.Add(tenant);

        // 6. Create Primary Property Branch
        var property = new Property
        {
            Id = propertyId,
            TenantId = tenantId,
            Name = request.PropertyName.Trim(),
            Code = "MAIN",
            Slug = propertySlug,
            Address = formattedAddress,
            City = province.Name,
            PhoneNumber = request.PhoneNumber.Trim(),
            Email = emailNormalized,
            PropertyType = PropertyType.Hotel,
            StarRating = 0,
            CheckInTime = new TimeOnly(14, 0, 0),
            CheckOutTime = new TimeOnly(12, 0, 0),
            BufferMinutes = 30,
            MaxHourlyHours = 12,
            TaxRatePercent = 0m,
            ServiceFeeRatePercent = 0m,
            Status = PropertyStatus.Active,
            IsPublished = false
        };

        // Auto-match nearest landmarks and tourist zones (3-layer fallback)
        GeoProximityHelper.AutoMatchNearbyLandmarks(property, _locationService, request.ProvinceCode, request.WardCode);

        _context.Properties.Add(property);

        // 7. Ensure User Account
        if (user == null)
        {
            // Scenario C: Create new user
            if (string.IsNullOrWhiteSpace(request.Password) || request.Password.Length < 6)
            {
                throw new BadRequestException("ERR_INVALID_PASSWORD", "Mật khẩu phải có ít nhất 6 ký tự.");
            }

            user = new User
            {
                Id = Guid.NewGuid(),
                Email = emailNormalized,
                Username = emailNormalized,
                PasswordHash = _passwordHasher.Hash(request.Password),
                FullName = request.FullName.Trim(),
                PhoneNumber = request.PhoneNumber.Trim(),
                GlobalRole = GlobalUserRole.TenantStaff,
                IsActive = true,
                TenantId = tenantId
            };
            _context.Users.Add(user);
        }
        else
        {
            // Upgrading existing customer/user to TenantStaff
            if (user.GlobalRole == GlobalUserRole.Customer)
            {
                user.GlobalRole = GlobalUserRole.TenantStaff;
            }
            if (string.IsNullOrWhiteSpace(user.PhoneNumber) && !string.IsNullOrWhiteSpace(request.PhoneNumber))
            {
                user.PhoneNumber = request.PhoneNumber.Trim();
            }
            if (user.TenantId == null)
            {
                user.TenantId = tenantId;
            }
        }

        // 8. Create Owner Staff Assignment (Tenant-wide)
        var staffMember = new TenantStaff
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            PropertyId = null, // NULL indicates tenant-wide owner privileges
            UserId = user.Id,
            RoleId = ownerRole.Id,
            StaffRole = StaffRole.Owner,
            IsActive = true
        };
        _context.TenantStaffMembers.Add(staffMember);

        // 9. Assign Initial Starter Subscription
        var subscription = new Subscription
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Tier = SubscriptionTier.Basic,
            BillingCycle = BillingCycle.Monthly,
            Status = SubscriptionStatus.Active,
            PricePerCycle = 0m,
            Currency = "VND",
            CurrentPeriodStartUtc = DateTime.UtcNow,
            CurrentPeriodEndUtc = DateTime.UtcNow.AddYears(1),
            AutoRenew = true
        };
        _context.Subscriptions.Add(subscription);

        await _context.SaveChangesAsync(cancellationToken);

        return new RegisterPartnerResponse(
            user.Id,
            tenantId,
            propertyId,
            request.PropertyName.Trim(),
            "Đăng ký đối tác khách sạn thành công! Bạn có thể bắt đầu thiết lập phòng và nhận khách ngay.");
    }

    private static string GenerateSlug(string text)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            return "hotel-" + Guid.NewGuid().ToString("N")[..6];
        }

        var normalized = VietnameseTextNormalizer.Normalize(text);
        var clean = Regex.Replace(normalized, @"[^a-z0-9\s-]", "");
        var slug = Regex.Replace(clean, @"\s+", "-").Trim('-');

        return string.IsNullOrWhiteSpace(slug) ? "hotel-" + Guid.NewGuid().ToString("N")[..6] : slug;
    }

    private async Task<string> EnsureUniqueTenantSlugAsync(string baseSlug, CancellationToken cancellationToken)
    {
        var slug = baseSlug;
        var suffix = 1;
        while (await _context.Tenants.IgnoreQueryFilters().AnyAsync(t => t.Slug == slug, cancellationToken))
        {
            slug = $"{baseSlug}-{suffix++}";
        }
        return slug;
    }

    private async Task<string> EnsureUniquePropertySlugAsync(string baseSlug, CancellationToken cancellationToken)
    {
        var slug = baseSlug;
        var suffix = 1;
        while (await _context.Properties.IgnoreQueryFilters().AnyAsync(p => p.Slug == slug, cancellationToken))
        {
            slug = $"{baseSlug}-{suffix++}";
        }
        return slug;
    }
}
