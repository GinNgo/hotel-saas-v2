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
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Banners.Commands.UpdateBanner;

public sealed record UpdateBannerCommand(
    Guid Id,
    string Title,
    string ImageUrl,
    string? TargetUrl,
    string? TargetPlanCode,
    DateTime? ValidFromUtc,
    DateTime? ValidToUtc,
    bool IsActive
) : IRequest<SystemBannerDto>;

public sealed class UpdateBannerCommandValidator : AbstractValidator<UpdateBannerCommand>
{
    public UpdateBannerCommandValidator()
    {
        RuleFor(x => x.Id)
            .NotEmpty().WithMessage("Mã banner là bắt buộc.");

        RuleFor(x => x.Title)
            .NotEmpty().WithMessage("Tiêu đề banner là bắt buộc.")
            .MaximumLength(200).WithMessage("Tiêu đề banner không được vượt quá 200 ký tự.");

        RuleFor(x => x.ImageUrl)
            .NotEmpty().WithMessage("Đường dẫn ảnh hoặc biểu ngữ là bắt buộc.")
            .MaximumLength(1000).WithMessage("Đường dẫn ảnh không được vượt quá 1000 ký tự.")
            .Must(url => BannerMappingHelper.IsSafeHttpOrRelativeUrl(url, allowRelative: true))
            .WithMessage("Đường dẫn ảnh không hợp lệ.");

        RuleFor(x => x.TargetUrl)
            .MaximumLength(1000).WithMessage("Đường dẫn đích không được vượt quá 1000 ký tự.")
            .Must(url => BannerMappingHelper.IsSafeHttpOrRelativeUrl(url, allowRelative: true))
            .WithMessage("Đường dẫn đích không hợp lệ.");

        RuleFor(x => x)
            .Must(x => !x.ValidFromUtc.HasValue || !x.ValidToUtc.HasValue || x.ValidToUtc.Value >= x.ValidFromUtc.Value)
            .WithMessage("Thời điểm kết thúc phải sau thời điểm bắt đầu.");
    }
}

public sealed class UpdateBannerCommandHandler : IRequestHandler<UpdateBannerCommand, SystemBannerDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserContext _currentUser;

    public UpdateBannerCommandHandler(IApplicationDbContext context, ICurrentUserContext currentUser)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _currentUser = currentUser ?? throw new ArgumentNullException(nameof(currentUser));
    }

    public async Task<SystemBannerDto> Handle(UpdateBannerCommand request, CancellationToken cancellationToken)
    {
        if (_currentUser.IsAuthenticated && _currentUser.GlobalRole != GlobalUserRole.SuperAdmin)
        {
            throw new ForbiddenException("ERR_FORBIDDEN", "Chỉ Quản trị viên Nền tảng (SuperAdmin) mới có quyền cập nhật System Banner.");
        }

        var banner = await _context.SystemBanners
            .FirstOrDefaultAsync(b => b.Id == request.Id, cancellationToken);

        if (banner == null)
        {
            throw new NotFoundException(nameof(SystemBanner), request.Id);
        }

        banner.Title = request.Title.Trim();
        banner.ImageUrl = request.ImageUrl.Trim();
        banner.TargetUrl = string.IsNullOrWhiteSpace(request.TargetUrl) ? null : request.TargetUrl.Trim();
        banner.TargetPlanCode = string.IsNullOrWhiteSpace(request.TargetPlanCode)
            ? null
            : request.TargetPlanCode.Trim().ToUpperInvariant();
        banner.ValidFromUtc = request.ValidFromUtc?.ToUniversalTime();
        banner.ValidToUtc = request.ValidToUtc?.ToUniversalTime();
        banner.IsActive = request.IsActive;
        banner.UpdatedAtUtc = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);

        return BannerMappingHelper.ToDto(banner);
    }
}
