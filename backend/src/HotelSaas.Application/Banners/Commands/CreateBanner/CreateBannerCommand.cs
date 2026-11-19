using System;
using System.Threading;
using System.Threading.Tasks;
using FluentValidation;
using HotelSaas.Application.Banners.DTOs;
using HotelSaas.Application.Banners.Queries.GetActiveBanners;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using MediatR;

namespace HotelSaas.Application.Banners.Commands.CreateBanner;

public sealed record CreateBannerCommand(
    string Title,
    string ImageUrl,
    string? TargetUrl,
    string? TargetPlanCode,
    DateTime? ValidFromUtc,
    DateTime? ValidToUtc,
    bool IsActive = true
) : IRequest<SystemBannerDto>;

public sealed class CreateBannerCommandValidator : AbstractValidator<CreateBannerCommand>
{
    public CreateBannerCommandValidator()
    {
        RuleFor(x => x.Title)
            .NotEmpty().WithMessage("Tiêu đề banner là bắt buộc.")
            .MaximumLength(200).WithMessage("Tiêu đề banner không được vượt quá 200 ký tự.");

        RuleFor(x => x.ImageUrl)
            .NotEmpty().WithMessage("Đường dẫn ảnh hoặc biểu ngữ là bắt buộc.")
            .MaximumLength(1000).WithMessage("Đường dẫn ảnh không được vượt quá 1000 ký tự.")
            .Must(url => BannerMappingHelper.IsSafeHttpOrRelativeUrl(url, allowRelative: true))
            .WithMessage("Đường dẫn ảnh không hợp lệ (chỉ chấp nhận HTTP/HTTPS hoặc đường dẫn nội bộ).");

        RuleFor(x => x.TargetUrl)
            .MaximumLength(1000).WithMessage("Đường dẫn đích không được vượt quá 1000 ký tự.")
            .Must(url => BannerMappingHelper.IsSafeHttpOrRelativeUrl(url, allowRelative: true))
            .WithMessage("Đường dẫn đích không hợp lệ.");

        RuleFor(x => x.TargetPlanCode)
            .MaximumLength(50).WithMessage("Mã gói mục tiêu không được vượt quá 50 ký tự.");

        RuleFor(x => x)
            .Must(x => !x.ValidFromUtc.HasValue || !x.ValidToUtc.HasValue || x.ValidToUtc.Value >= x.ValidFromUtc.Value)
            .WithMessage("Thời điểm kết thúc phải sau thời điểm bắt đầu.");
    }
}

public sealed class CreateBannerCommandHandler : IRequestHandler<CreateBannerCommand, SystemBannerDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserContext _currentUser;

    public CreateBannerCommandHandler(IApplicationDbContext context, ICurrentUserContext currentUser)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _currentUser = currentUser ?? throw new ArgumentNullException(nameof(currentUser));
    }

    public async Task<SystemBannerDto> Handle(CreateBannerCommand request, CancellationToken cancellationToken)
    {
        if (_currentUser.IsAuthenticated && _currentUser.GlobalRole != GlobalUserRole.SuperAdmin)
        {
            throw new ForbiddenException("ERR_FORBIDDEN", "Chỉ Quản trị viên Nền tảng (SuperAdmin) mới có quyền tạo System Banner.");
        }

        var now = DateTime.UtcNow;
        var banner = new SystemBanner
        {
            Id = Guid.NewGuid(),
            Title = request.Title.Trim(),
            ImageUrl = request.ImageUrl.Trim(),
            TargetUrl = string.IsNullOrWhiteSpace(request.TargetUrl) ? null : request.TargetUrl.Trim(),
            TargetPlanCode = string.IsNullOrWhiteSpace(request.TargetPlanCode)
                ? null
                : request.TargetPlanCode.Trim().ToUpperInvariant(),
            ValidFromUtc = request.ValidFromUtc?.ToUniversalTime(),
            ValidToUtc = request.ValidToUtc?.ToUniversalTime(),
            IsActive = request.IsActive,
            CreatedAtUtc = now,
            UpdatedAtUtc = now
        };

        _context.SystemBanners.Add(banner);
        await _context.SaveChangesAsync(cancellationToken);

        return BannerMappingHelper.ToDto(banner);
    }
}
