using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using FluentValidation;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Platform.DTOs;
using HotelSaas.Application.Platform.Queries.GetPlatformOverview;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Platform.Plans;

internal static class AdminPlanMappingHelper
{
    internal static void EnsureSuperAdmin(ICurrentUserContext currentUser)
    {
        if (currentUser.IsAuthenticated && currentUser.GlobalRole != GlobalUserRole.SuperAdmin)
        {
            throw new ForbiddenException("ERR_FORBIDDEN", "Chỉ Quản trị viên Nền tảng (SuperAdmin) mới có quyền quản lý gói dịch vụ.");
        }
    }

    internal static List<string> ParseFeatures(string? featuresJson)
    {
        if (string.IsNullOrWhiteSpace(featuresJson))
        {
            return new List<string>();
        }

        try
        {
            return JsonSerializer.Deserialize<List<string>>(featuresJson) ?? new List<string>();
        }
        catch (JsonException)
        {
            return new List<string>();
        }
    }

    internal static string? SerializeFeatures(IReadOnlyList<string>? features)
    {
        if (features == null || features.Count == 0)
        {
            return null;
        }

        var normalized = features
            .Select(f => f?.Trim())
            .Where(f => !string.IsNullOrWhiteSpace(f))
            .ToList();

        return normalized.Count == 0 ? null : JsonSerializer.Serialize(normalized);
    }

    internal static async Task<IReadOnlyList<TenantMrrAssignment>> LoadActiveTenantMrrAssignmentsAsync(
        IApplicationDbContext context,
        IReadOnlyList<SubscriptionPlan> plans,
        CancellationToken cancellationToken)
    {
        List<Tenant> tenants;
        try
        {
            tenants = await context.Tenants
                .IgnoreQueryFilters()
                .AsNoTracking()
                .ToListAsync(cancellationToken);
        }
        catch (NotImplementedException)
        {
            tenants = new List<Tenant>();
        }

        var subscriptions = await context.Subscriptions
            .IgnoreQueryFilters()
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        List<TenantContract> contracts;
        try
        {
            contracts = await context.TenantContracts
                .IgnoreQueryFilters()
                .AsNoTracking()
                .ToListAsync(cancellationToken);
        }
        catch (NotImplementedException)
        {
            contracts = new List<TenantContract>();
        }

        return PlatformMrrCalculator.ComputeActiveTenantMrrAssignments(tenants, subscriptions, contracts, plans);
    }

    internal static AdminPlanDto ToDto(SubscriptionPlan plan, IReadOnlyList<TenantMrrAssignment>? activeAssignments = null)
    {
        var matched = activeAssignments == null
            ? new List<TenantMrrAssignment>()
            : activeAssignments.Where(entry => PlatformMrrCalculator.MatchesPlan(plan, entry)).ToList();

        return new AdminPlanDto
        {
            Id = plan.Id,
            Code = plan.Code,
            Name = plan.Name,
            Description = plan.Description,
            MonthlyPrice = plan.MonthlyPrice,
            YearlyPrice = plan.YearlyPrice,
            MaxRooms = plan.MaxRooms,
            MaxProperties = plan.MaxProperties,
            MaxStaff = plan.MaxStaff,
            HasVnPay = plan.HasVnPay,
            HasAdvancedReports = plan.HasAdvancedReports,
            IsActive = plan.IsActive,
            IsPopular = plan.IsPopular,
            SortOrder = plan.SortOrder,
            Features = ParseFeatures(plan.FeaturesJson),
            ActiveTenantsCount = matched.Count,
            EstimatedMonthlyRevenue = matched.Sum(x => x.MonthlyMrr)
        };
    }
}

public sealed record GetAdminPlansQuery : IRequest<IReadOnlyList<AdminPlanDto>>;

public sealed class GetAdminPlansQueryHandler : IRequestHandler<GetAdminPlansQuery, IReadOnlyList<AdminPlanDto>>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserContext _currentUser;

    public GetAdminPlansQueryHandler(IApplicationDbContext context, ICurrentUserContext currentUser)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _currentUser = currentUser ?? throw new ArgumentNullException(nameof(currentUser));
    }

    public async Task<IReadOnlyList<AdminPlanDto>> Handle(GetAdminPlansQuery request, CancellationToken cancellationToken)
    {
        AdminPlanMappingHelper.EnsureSuperAdmin(_currentUser);

        var plans = await _context.SubscriptionPlans
            .AsNoTracking()
            .OrderBy(p => p.SortOrder)
            .ThenBy(p => p.MonthlyPrice)
            .ToListAsync(cancellationToken);

        var activeAssignments = await AdminPlanMappingHelper.LoadActiveTenantMrrAssignmentsAsync(
            _context, plans, cancellationToken);

        return plans.Select(p => AdminPlanMappingHelper.ToDto(p, activeAssignments)).ToList();
    }
}

public sealed record GetAdminPlanByIdQuery(Guid Id) : IRequest<AdminPlanDto>;

public sealed class GetAdminPlanByIdQueryHandler : IRequestHandler<GetAdminPlanByIdQuery, AdminPlanDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserContext _currentUser;

    public GetAdminPlanByIdQueryHandler(IApplicationDbContext context, ICurrentUserContext currentUser)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _currentUser = currentUser ?? throw new ArgumentNullException(nameof(currentUser));
    }

    public async Task<AdminPlanDto> Handle(GetAdminPlanByIdQuery request, CancellationToken cancellationToken)
    {
        AdminPlanMappingHelper.EnsureSuperAdmin(_currentUser);

        var plan = await _context.SubscriptionPlans
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == request.Id, cancellationToken);

        if (plan == null)
        {
            throw new NotFoundException("Không tìm thấy thông tin gói dịch vụ.");
        }

        var activeAssignments = await AdminPlanMappingHelper.LoadActiveTenantMrrAssignmentsAsync(
            _context, new[] { plan }, cancellationToken);

        return AdminPlanMappingHelper.ToDto(plan, activeAssignments);
    }
}

public sealed record CreateAdminPlanCommand(
    string Code,
    string Name,
    string? Description,
    decimal MonthlyPrice,
    decimal YearlyPrice,
    int MaxRooms,
    int MaxProperties,
    int MaxStaff,
    bool HasVnPay,
    bool HasAdvancedReports,
    bool IsActive,
    bool IsPopular,
    int SortOrder,
    IReadOnlyList<string>? Features
) : IRequest<AdminPlanDto>;

public sealed class CreateAdminPlanCommandValidator : AbstractValidator<CreateAdminPlanCommand>
{
    public CreateAdminPlanCommandValidator()
    {
        RuleFor(x => x.Code)
            .NotEmpty().WithMessage("Mã gói dịch vụ là bắt buộc.")
            .MaximumLength(50).WithMessage("Mã gói dịch vụ không được vượt quá 50 ký tự.");

        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Tên gói dịch vụ là bắt buộc.")
            .MaximumLength(150).WithMessage("Tên gói dịch vụ không được vượt quá 150 ký tự.");

        RuleFor(x => x.MonthlyPrice)
            .GreaterThanOrEqualTo(0).WithMessage("Giá gói theo tháng không hợp lệ.");

        RuleFor(x => x.YearlyPrice)
            .GreaterThanOrEqualTo(0).WithMessage("Giá gói theo năm không hợp lệ.");

        RuleFor(x => x.MaxRooms)
            .GreaterThan(0).WithMessage("Số lượng phòng tối đa phải lớn hơn 0.");

        RuleFor(x => x.MaxProperties)
            .GreaterThan(0).WithMessage("Số lượng chi nhánh tối đa phải lớn hơn 0.");

        RuleFor(x => x.MaxStaff)
            .GreaterThan(0).WithMessage("Số lượng nhân viên tối đa phải lớn hơn 0.");
    }
}

public sealed class CreateAdminPlanCommandHandler : IRequestHandler<CreateAdminPlanCommand, AdminPlanDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserContext _currentUser;

    public CreateAdminPlanCommandHandler(IApplicationDbContext context, ICurrentUserContext currentUser)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _currentUser = currentUser ?? throw new ArgumentNullException(nameof(currentUser));
    }

    public async Task<AdminPlanDto> Handle(CreateAdminPlanCommand request, CancellationToken cancellationToken)
    {
        AdminPlanMappingHelper.EnsureSuperAdmin(_currentUser);

        var codeUpper = request.Code.Trim().ToUpperInvariant();
        var exists = await _context.SubscriptionPlans
            .AnyAsync(p => p.Code == codeUpper, cancellationToken);

        if (exists)
        {
            throw new ConflictException("ERR_PLAN_CODE_EXISTS", $"Mã gói '{codeUpper}' đã tồn tại trong hệ thống.");
        }

        var now = DateTime.UtcNow;
        var plan = new SubscriptionPlan
        {
            Id = Guid.NewGuid(),
            Code = codeUpper,
            Name = request.Name.Trim(),
            Description = request.Description?.Trim(),
            MonthlyPrice = request.MonthlyPrice,
            YearlyPrice = request.YearlyPrice > 0 ? request.YearlyPrice : request.MonthlyPrice * 10m,
            MaxRooms = request.MaxRooms,
            MaxProperties = Math.Max(1, request.MaxProperties),
            MaxStaff = Math.Max(1, request.MaxStaff),
            HasVnPay = request.HasVnPay,
            HasAdvancedReports = request.HasAdvancedReports,
            IsActive = request.IsActive,
            IsPopular = request.IsPopular,
            SortOrder = request.SortOrder,
            FeaturesJson = AdminPlanMappingHelper.SerializeFeatures(request.Features),
            CreatedAtUtc = now,
            UpdatedAtUtc = now
        };

        _context.SubscriptionPlans.Add(plan);
        await _context.SaveChangesAsync(cancellationToken);

        return AdminPlanMappingHelper.ToDto(plan);
    }
}

public sealed record UpdateAdminPlanCommand(
    Guid Id,
    string Code,
    string Name,
    string? Description,
    decimal MonthlyPrice,
    decimal YearlyPrice,
    int MaxRooms,
    int MaxProperties,
    int MaxStaff,
    bool HasVnPay,
    bool HasAdvancedReports,
    bool IsActive,
    bool IsPopular,
    int SortOrder,
    IReadOnlyList<string>? Features
) : IRequest<AdminPlanDto>;

public sealed class UpdateAdminPlanCommandValidator : AbstractValidator<UpdateAdminPlanCommand>
{
    public UpdateAdminPlanCommandValidator()
    {
        RuleFor(x => x.Id)
            .NotEmpty().WithMessage("Mã định danh gói là bắt buộc.");

        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Tên gói dịch vụ là bắt buộc.")
            .MaximumLength(150).WithMessage("Tên gói dịch vụ không được vượt quá 150 ký tự.");

        RuleFor(x => x.MonthlyPrice)
            .GreaterThanOrEqualTo(0).WithMessage("Giá gói theo tháng không hợp lệ.");

        RuleFor(x => x.YearlyPrice)
            .GreaterThanOrEqualTo(0).WithMessage("Giá gói theo năm không hợp lệ.");

        RuleFor(x => x.MaxRooms)
            .GreaterThan(0).WithMessage("Số lượng phòng tối đa phải lớn hơn 0.");

        RuleFor(x => x.MaxProperties)
            .GreaterThan(0).WithMessage("Số lượng chi nhánh tối đa phải lớn hơn 0.");

        RuleFor(x => x.MaxStaff)
            .GreaterThan(0).WithMessage("Số lượng nhân viên tối đa phải lớn hơn 0.");
    }
}

public sealed class UpdateAdminPlanCommandHandler : IRequestHandler<UpdateAdminPlanCommand, AdminPlanDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserContext _currentUser;

    public UpdateAdminPlanCommandHandler(IApplicationDbContext context, ICurrentUserContext currentUser)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _currentUser = currentUser ?? throw new ArgumentNullException(nameof(currentUser));
    }

    public async Task<AdminPlanDto> Handle(UpdateAdminPlanCommand request, CancellationToken cancellationToken)
    {
        AdminPlanMappingHelper.EnsureSuperAdmin(_currentUser);

        var plan = await _context.SubscriptionPlans
            .FirstOrDefaultAsync(p => p.Id == request.Id, cancellationToken);

        if (plan == null)
        {
            throw new NotFoundException("Không tìm thấy gói cước để cập nhật.");
        }

        plan.Name = request.Name.Trim();
        plan.Description = request.Description?.Trim();
        plan.MonthlyPrice = request.MonthlyPrice;
        plan.YearlyPrice = request.YearlyPrice > 0 ? request.YearlyPrice : request.MonthlyPrice * 10m;
        plan.MaxRooms = request.MaxRooms;
        plan.MaxProperties = Math.Max(1, request.MaxProperties);
        plan.MaxStaff = Math.Max(1, request.MaxStaff);
        plan.HasVnPay = request.HasVnPay;
        plan.HasAdvancedReports = request.HasAdvancedReports;
        plan.IsActive = request.IsActive;
        plan.IsPopular = request.IsPopular;
        plan.SortOrder = request.SortOrder;
        plan.FeaturesJson = AdminPlanMappingHelper.SerializeFeatures(request.Features);
        plan.UpdatedAtUtc = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);

        var activeAssignments = await AdminPlanMappingHelper.LoadActiveTenantMrrAssignmentsAsync(
            _context, new[] { plan }, cancellationToken);

        return AdminPlanMappingHelper.ToDto(plan, activeAssignments);
    }
}

public sealed record ToggleAdminPlanActiveCommand(Guid Id) : IRequest<AdminPlanDto>;

public sealed class ToggleAdminPlanActiveCommandValidator : AbstractValidator<ToggleAdminPlanActiveCommand>
{
    public ToggleAdminPlanActiveCommandValidator()
    {
        RuleFor(x => x.Id)
            .NotEmpty().WithMessage("Mã định danh gói là bắt buộc.");
    }
}

public sealed class ToggleAdminPlanActiveCommandHandler : IRequestHandler<ToggleAdminPlanActiveCommand, AdminPlanDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserContext _currentUser;

    public ToggleAdminPlanActiveCommandHandler(IApplicationDbContext context, ICurrentUserContext currentUser)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _currentUser = currentUser ?? throw new ArgumentNullException(nameof(currentUser));
    }

    public async Task<AdminPlanDto> Handle(ToggleAdminPlanActiveCommand request, CancellationToken cancellationToken)
    {
        AdminPlanMappingHelper.EnsureSuperAdmin(_currentUser);

        var plan = await _context.SubscriptionPlans
            .FirstOrDefaultAsync(p => p.Id == request.Id, cancellationToken);

        if (plan == null)
        {
            throw new NotFoundException("Không tìm thấy gói cước.");
        }

        plan.IsActive = !plan.IsActive;
        plan.UpdatedAtUtc = DateTime.UtcNow;
        await _context.SaveChangesAsync(cancellationToken);

        var activeAssignments = await AdminPlanMappingHelper.LoadActiveTenantMrrAssignmentsAsync(
            _context, new[] { plan }, cancellationToken);

        return AdminPlanMappingHelper.ToDto(plan, activeAssignments);
    }
}
