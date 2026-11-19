using System;
using System.Threading;
using System.Threading.Tasks;
using FluentValidation;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Promotions.DTOs;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Promotions.Commands.TogglePromotionStatus;

public sealed record TogglePromotionStatusCommand(
    Guid Id,
    bool? IsActive = null
) : IRequest<PromotionDto>;

public sealed class TogglePromotionStatusCommandValidator : AbstractValidator<TogglePromotionStatusCommand>
{
    public TogglePromotionStatusCommandValidator()
    {
        RuleFor(x => x.Id)
            .NotEmpty().WithMessage("Id khuyến mãi không được để trống.");
    }
}

public sealed class TogglePromotionStatusCommandHandler : IRequestHandler<TogglePromotionStatusCommand, PromotionDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentTenantService _tenantService;

    public TogglePromotionStatusCommandHandler(
        IApplicationDbContext context,
        ICurrentTenantService tenantService)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _tenantService = tenantService ?? throw new ArgumentNullException(nameof(tenantService));
    }

    public async Task<PromotionDto> Handle(TogglePromotionStatusCommand request, CancellationToken cancellationToken)
    {
        var tenantId = _tenantService.TenantId;
        if (!tenantId.HasValue || tenantId.Value == Guid.Empty)
        {
            throw new UnauthorizedAccessException("Yêu cầu ngữ cảnh doanh nghiệp hợp lệ.");
        }

        var entity = await _context.Promotions
            .FirstOrDefaultAsync(p => p.Id == request.Id && p.TenantId == tenantId.Value, cancellationToken);

        if (entity == null)
        {
            throw new NotFoundException("Không tìm thấy chương trình khuyến mãi.");
        }

        entity.IsActive = request.IsActive ?? !entity.IsActive;
        entity.UpdatedAtUtc = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);

        return PromotionMapper.ToDto(entity);
    }
}
