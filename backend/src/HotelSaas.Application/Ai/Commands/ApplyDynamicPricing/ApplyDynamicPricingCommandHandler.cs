using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Ai.Common;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.RoomTypes.Commands.CreateRoomTypeRate;
using HotelSaas.Application.RoomTypes.DTOs;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Ai.Commands.ApplyDynamicPricing;

public sealed class ApplyDynamicPricingCommandHandler : IRequestHandler<ApplyDynamicPricingCommand, RoomTypeRateDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserContext _currentUser;
    private readonly ISender _mediator;

    public ApplyDynamicPricingCommandHandler(
        IApplicationDbContext context,
        ICurrentUserContext currentUser,
        ISender mediator)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _currentUser = currentUser ?? throw new ArgumentNullException(nameof(currentUser));
        _mediator = mediator ?? throw new ArgumentNullException(nameof(mediator));
    }

    public async Task<RoomTypeRateDto> Handle(ApplyDynamicPricingCommand request, CancellationToken cancellationToken)
    {
        var tenantId = _currentUser.TenantId;
        if (!tenantId.HasValue || tenantId.Value == Guid.Empty)
        {
            throw new UnauthorizedAccessException("ERR_TENANT_REQUIRED: Yêu cầu xác thực ngữ cảnh doanh nghiệp hợp lệ.");
        }

        if (request.RoomTypeId == Guid.Empty)
        {
            throw new BadRequestException("ERR_INVALID_REQUEST", "Vui lòng chọn hạng phòng hợp lệ để áp dụng giá AI.");
        }

        if (request.NightlyPrice <= 0)
        {
            throw new BadRequestException("ERR_INVALID_PRICE", "Giá đêm đề xuất phải lớn hơn 0.");
        }

        var roomType = await _context.RoomTypes
            .IgnoreQueryFilters()
            .AsNoTracking()
            .FirstOrDefaultAsync(rt => rt.Id == request.RoomTypeId, cancellationToken);

        if (roomType == null)
        {
            throw new NotFoundException("Không tìm thấy hạng phòng.");
        }

        if (roomType.TenantId != tenantId.Value)
        {
            throw new ForbiddenException("ERR_PROPERTY_FORBIDDEN", "Không có quyền truy cập hạng phòng của doanh nghiệp khác.");
        }

        var targetPropertyId = request.PropertyId ?? roomType.PropertyId;
        if (request.PropertyId.HasValue && request.PropertyId.Value != roomType.PropertyId)
        {
            throw new BadRequestException("ERR_PROPERTY_MISMATCH", "Hạng phòng không thuộc chi nhánh được chọn.");
        }

        if (!_currentUser.IsTenantWide && _currentUser.PropertyId != targetPropertyId)
        {
            throw new ForbiddenException("ERR_PROPERTY_FORBIDDEN", "Nhân viên chi nhánh không được phép áp dụng giá cho chi nhánh khác.");
        }

        var tz = AiHelper.ResolveVietnamTimeZone();
        var todayLocal = DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, tz));
        var effectiveFrom = request.EffectiveFrom ?? todayLocal;
        var effectiveTo = request.EffectiveTo ?? effectiveFrom.AddDays(1);

        if (effectiveTo <= effectiveFrom)
        {
            throw new BadRequestException("ERR_INVALID_DURATION", "Ngày kết thúc hiệu lực phải lớn hơn ngày bắt đầu.");
        }

        var currentRate = await _context.RoomTypeRates
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(r => r.RoomTypeId == roomType.Id &&
                        r.PropertyId == targetPropertyId &&
                        r.TenantId == tenantId.Value &&
                        r.IsActive &&
                        r.EffectiveFrom <= effectiveFrom &&
                        effectiveFrom < r.EffectiveTo)
            .OrderByDescending(r => r.CreatedAtUtc)
            .FirstOrDefaultAsync(cancellationToken);

        var firstHours = Math.Max(1, request.FirstHours ?? currentRate?.FirstHours ?? 2);
        var firstHoursPrice = request.FirstHoursPrice ?? currentRate?.FirstHoursPrice ?? Math.Round(request.NightlyPrice * 0.40m, 0, MidpointRounding.AwayFromZero);
        var additionalHourPrice = request.AdditionalHourPrice ?? currentRate?.AdditionalHourPrice ?? Math.Round(request.NightlyPrice * 0.12m, 0, MidpointRounding.AwayFromZero);
        var currency = !string.IsNullOrWhiteSpace(request.Currency)
            ? request.Currency.Trim().ToUpperInvariant()
            : (currentRate?.Currency ?? "VND");
        var changeReason = !string.IsNullOrWhiteSpace(request.ChangeReason)
            ? request.ChangeReason.Trim()
            : "Áp dụng đề xuất AI Dynamic Pricing";

        var createdRate = await _mediator.Send(new CreateRoomTypeRateCommand(
            roomType.Id,
            targetPropertyId,
            firstHours,
            firstHoursPrice,
            additionalHourPrice,
            Math.Round(request.NightlyPrice, 0, MidpointRounding.AwayFromZero),
            effectiveFrom,
            effectiveTo,
            currency,
            changeReason), cancellationToken);

        await AiHelper.TryRecordAiUsageAsync(
            _context,
            _currentUser,
            tenantId.Value,
            "DynamicPricingApply",
            $"RoomType={roomType.Id}, Property={targetPropertyId}, Range={effectiveFrom:yyyy-MM-dd}..{effectiveTo:yyyy-MM-dd}",
            $"AppliedNightlyPrice={createdRate.NightlyPrice}, RateId={createdRate.Id}",
            "ai-dynamic-pricing-engine",
            cancellationToken);

        return createdRate;
    }
}
