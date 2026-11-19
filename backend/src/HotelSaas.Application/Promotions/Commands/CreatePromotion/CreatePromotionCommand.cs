using System;
using System.Threading;
using System.Threading.Tasks;
using FluentValidation;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Promotions.DTOs;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Promotions.Commands.CreatePromotion;

public sealed record CreatePromotionCommand(
    string Code,
    string Name,
    string? Description,
    PromotionType Type,
    decimal Value,
    int MinNights,
    int? MaxUsage,
    DateTime StartsAtUtc,
    DateTime EndsAtUtc,
    bool IsActive = true
) : IRequest<PromotionDto>;

public sealed class CreatePromotionCommandValidator : AbstractValidator<CreatePromotionCommand>
{
    public CreatePromotionCommandValidator()
    {
        RuleFor(x => x.Code)
            .NotEmpty().WithMessage("Mã khuyến mãi không được để trống.")
            .MaximumLength(50).WithMessage("Mã khuyến mãi không được vượt quá 50 ký tự.")
            .Matches("^[A-Za-z0-9_-]+$").WithMessage("Mã khuyến mãi chỉ chấp nhận chữ cái không dấu, số, gạch dưới (_) và gạch ngang (-).");

        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Tên chương trình khuyến mãi không được để trống.")
            .MaximumLength(200).WithMessage("Tên chương trình không được vượt quá 200 ký tự.");

        RuleFor(x => x.Description)
            .MaximumLength(1000).WithMessage("Mô tả không được vượt quá 1000 ký tự.");

        RuleFor(x => x.Type)
            .IsInEnum().WithMessage("Loại khuyến mãi không hợp lệ.");

        RuleFor(x => x.Value)
            .GreaterThan(0m).WithMessage("Giá trị khuyến mãi phải lớn hơn 0.");

        When(x => x.Type == PromotionType.PercentDiscount, () =>
        {
            RuleFor(x => x.Value)
                .LessThanOrEqualTo(100m)
                .WithMessage("Phần trăm giảm giá không được vượt quá 100%.");
        });

        RuleFor(x => x.MinNights)
            .GreaterThanOrEqualTo(1)
            .WithMessage("Số đêm tối thiểu phải lớn hơn hoặc bằng 1.");

        RuleFor(x => x.MaxUsage)
            .GreaterThanOrEqualTo(1)
            .When(x => x.MaxUsage.HasValue)
            .WithMessage("Giới hạn lượt sử dụng tối đa phải lớn hơn hoặc bằng 1.");

        RuleFor(x => x.EndsAtUtc)
            .GreaterThan(x => x.StartsAtUtc)
            .WithMessage("Thời gian kết thúc phải sau thời gian bắt đầu.");
    }
}

public sealed class CreatePromotionCommandHandler : IRequestHandler<CreatePromotionCommand, PromotionDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentTenantService _tenantService;

    public CreatePromotionCommandHandler(
        IApplicationDbContext context,
        ICurrentTenantService tenantService)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _tenantService = tenantService ?? throw new ArgumentNullException(nameof(tenantService));
    }

    public async Task<PromotionDto> Handle(CreatePromotionCommand request, CancellationToken cancellationToken)
    {
        var tenantId = _tenantService.TenantId;
        if (!tenantId.HasValue || tenantId.Value == Guid.Empty)
        {
            throw new UnauthorizedAccessException("Yêu cầu ngữ cảnh doanh nghiệp hợp lệ.");
        }

        var normalizedCode = request.Code.Trim().ToUpperInvariant();

        var exists = await _context.Promotions
            .IgnoreQueryFilters()
            .AnyAsync(p => p.TenantId == tenantId.Value && p.Code == normalizedCode, cancellationToken);

        if (exists)
        {
            throw new ConflictException("ERR_PROMOTION_CODE_EXISTS",
                $"Mã khuyến mãi '{normalizedCode}' đã tồn tại trong doanh nghiệp.");
        }

        var utcNow = DateTime.UtcNow;
        var entity = new Promotion
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId.Value,
            Code = normalizedCode,
            Name = request.Name.Trim(),
            Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim(),
            Type = request.Type,
            Value = request.Value,
            MinNights = request.MinNights,
            MaxUsage = request.MaxUsage,
            CurrentUsage = 0,
            StartsAtUtc = PromotionMapper.NormalizeUtc(request.StartsAtUtc),
            EndsAtUtc = PromotionMapper.NormalizeUtc(request.EndsAtUtc),
            IsActive = request.IsActive,
            CreatedAtUtc = utcNow,
            UpdatedAtUtc = utcNow
        };

        _context.Promotions.Add(entity);
        await _context.SaveChangesAsync(cancellationToken);

        return PromotionMapper.ToDto(entity);
    }
}
