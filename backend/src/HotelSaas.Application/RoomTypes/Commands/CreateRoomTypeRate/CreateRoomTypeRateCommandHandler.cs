using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Common.Models;
using HotelSaas.Application.RoomTypes.DTOs;
using HotelSaas.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.RoomTypes.Commands.CreateRoomTypeRate;

/// <summary>
/// Command handler implementing atomic rate creation and interval splitting with full audit logging.
/// Secures synchronization with row-level locks on the parent room type.
/// </summary>
public sealed class CreateRoomTypeRateCommandHandler : IRequestHandler<CreateRoomTypeRateCommand, RoomTypeRateDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentTenantService _tenantService;
    private readonly ICurrentPropertyService _propertyService;
    private readonly ICurrentUserContext _userContext;
    private readonly IMembershipLookupService _membershipLookupService;

    public CreateRoomTypeRateCommandHandler(
        IApplicationDbContext context,
        ICurrentTenantService tenantService,
        ICurrentPropertyService propertyService,
        ICurrentUserContext userContext,
        IMembershipLookupService membershipLookupService)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _tenantService = tenantService ?? throw new ArgumentNullException(nameof(tenantService));
        _propertyService = propertyService ?? throw new ArgumentNullException(nameof(propertyService));
        _userContext = userContext ?? throw new ArgumentNullException(nameof(userContext));
        _membershipLookupService = membershipLookupService ?? throw new ArgumentNullException(nameof(membershipLookupService));
    }

    private static TimeZoneInfo GetVietnamTimeZone()
    {
        if (TimeZoneInfo.TryFindSystemTimeZoneById("Asia/Ho_Chi_Minh", out var tz)) return tz;
        if (TimeZoneInfo.TryFindSystemTimeZoneById("SE Asia Standard Time", out tz)) return tz;
        return TimeZoneInfo.CreateCustomTimeZone("Asia/Ho_Chi_Minh", TimeSpan.FromHours(7), "ICT", "ICT");
    }

    public async Task<RoomTypeRateDto> Handle(CreateRoomTypeRateCommand request, CancellationToken cancellationToken)
    {
        var tenantId = _tenantService.TenantId;
        if (!tenantId.HasValue || tenantId.Value == Guid.Empty)
        {
            throw new UnauthorizedAccessException("Tenant context is required.");
        }

        var userId = _userContext.UserId;
        if (userId == Guid.Empty)
        {
            throw new UnauthorizedAccessException("User identity context is required.");
        }

        // 1. Resolve room type
        var roomType = await _context.RoomTypes
            .FirstOrDefaultAsync(rt => rt.Id == request.RoomTypeId && rt.TenantId == tenantId.Value, cancellationToken);

        if (roomType == null)
        {
            throw new NotFoundException("Loại phòng không tồn tại.");
        }

        var targetPropertyId = request.PropertyId ?? roomType.PropertyId;
        if (targetPropertyId != roomType.PropertyId)
        {
            throw new BadRequestException("ERR_CONTEXT_MISMATCH", "Loại phòng không thuộc chi nhánh được chỉ định.");
        }

        // Header check
        if (_propertyService.HeaderPropertyId.HasValue && _propertyService.HeaderPropertyId.Value != targetPropertyId)
        {
            throw new BadRequestException("ERR_CONTEXT_MISMATCH",
                "Chi nhánh trong header X-Property-Id không khớp với chi nhánh của loại phòng.");
        }

        // Token check for property-scoped staff
        if (!_propertyService.IsTenantWide &&
            _propertyService.TokenPropertyId.HasValue && _propertyService.TokenPropertyId.Value != targetPropertyId)
        {
            throw new BadRequestException("ERR_CONTEXT_MISMATCH",
                "Chi nhánh của loại phòng không khớp với chi nhánh trong token xác thực.");
        }

        // 2. Authoritative membership validation
        var membership = await _membershipLookupService.ResolveMembershipAsync(
            tenantId.Value,
            userId,
            targetPropertyId,
            cancellationToken);

        if (membership.Status != MembershipLookupStatus.Success)
        {
            switch (membership.Status)
            {
                case MembershipLookupStatus.MembershipRevoked:
                    throw new ForbiddenException("ERR_MEMBERSHIP_REVOKED", membership.ErrorMessage ?? "Quyền nhân sự tại chi nhánh đã bị thu hồi.");
                case MembershipLookupStatus.PropertyNotFound:
                    throw new NotFoundException(membership.ErrorMessage ?? "Chi nhánh không tồn tại.");
                case MembershipLookupStatus.PropertyInactive:
                    throw new ConflictException("ERR_PROPERTY_INACTIVE", membership.ErrorMessage ?? "Chi nhánh hiện không hoạt động.");
                case MembershipLookupStatus.PropertyForbidden:
                    throw new ForbiddenException("ERR_PROPERTY_FORBIDDEN", membership.ErrorMessage ?? "Bạn không có quyền truy cập chi nhánh này.");
                case MembershipLookupStatus.TenantNotFoundOrInactive:
                    throw new ForbiddenException("ERR_TENANT_INACTIVE", membership.ErrorMessage ?? "Doanh nghiệp hiện bị tạm ngưng.");
                case MembershipLookupStatus.UserNotFoundOrInactive:
                    throw new UnauthorizedAccessException("ERR_USER_DEACTIVATED: " + (membership.ErrorMessage ?? "Tài khoản người dùng đã bị vô hiệu hóa."));
                case MembershipLookupStatus.PropertyRequired:
                    throw new ForbiddenException("ERR_PROPERTY_REQUIRED", membership.ErrorMessage ?? "Yêu cầu chọn chi nhánh làm việc để tiếp tục.");
                default:
                    throw new ForbiddenException("ERR_FORBIDDEN", membership.ErrorMessage ?? "Không có quyền thực hiện thao tác trên chi nhánh này.");
            }
        }

        // 3. Date validation: Cannot configure rates starting in the past
        var tz = GetVietnamTimeZone();
        var todayLocal = DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, tz));
        if (request.EffectiveFrom < todayLocal)
        {
            throw new BadRequestException("ERR_PAST_DATE", "Ngày hiệu lực của bảng giá không được nằm trong quá khứ.");
        }

        // 4. Begin transaction & acquire atomic row lock on RoomType with explicit Tenant & Property boundaries
        await using var transaction = await _context.BeginTransactionAsync(cancellationToken);

        await _context.LockRoomTypeRowAsync(roomType.Id, tenantId.Value, targetPropertyId, cancellationToken);

        // Fetch existing active rates for this room type
        var existingRates = await _context.RoomTypeRates
            .Where(r => r.RoomTypeId == roomType.Id && r.PropertyId == targetPropertyId && r.TenantId == tenantId.Value && r.IsActive)
            .OrderBy(r => r.EffectiveFrom)
            .ToListAsync(cancellationToken);

        var utcNow = DateTime.UtcNow;
        bool isSplit = false;
        bool isReplaced = false;

        // Find ALL overlapping active rates ordered chronologically:
        // r.EffectiveFrom < request.EffectiveTo && request.EffectiveFrom < r.EffectiveTo
        var overlappingRates = existingRates
            .Where(r => r.EffectiveFrom < request.EffectiveTo && request.EffectiveFrom < r.EffectiveTo)
            .OrderBy(r => r.EffectiveFrom)
            .ToList();

        var tailRatesToAdd = new List<(RoomTypeRate TailRate, DateOnly OriginalStart, DateOnly OriginalEnd, decimal OldNightlyPrice)>();

        foreach (var overlappingRate in overlappingRates)
        {
            var originalStart = overlappingRate.EffectiveFrom;
            var originalEnd = overlappingRate.EffectiveTo;

            if (request.EffectiveFrom <= originalStart && request.EffectiveTo >= originalEnd)
            {
                // Case (a): Full cover or exact match - Deactivate old rate
                isReplaced = true;
                overlappingRate.IsActive = false;

                _context.RoomTypeRateAudits.Add(new RoomTypeRateAudit
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId.Value,
                    PropertyId = targetPropertyId,
                    RoomTypeId = roomType.Id,
                    RateId = overlappingRate.Id,
                    OldEffectiveFrom = originalStart,
                    OldEffectiveTo = originalEnd,
                    OldNightlyPrice = overlappingRate.NightlyPrice,
                    NewEffectiveFrom = request.EffectiveFrom,
                    NewEffectiveTo = request.EffectiveTo,
                    NewNightlyPrice = request.NightlyPrice,
                    ActionType = "Replaced",
                    ChangedByUserId = userId,
                    ChangedAtUtc = utcNow,
                    ChangeReason = request.ChangeReason
                });
            }
            else if (originalStart < request.EffectiveFrom && request.EffectiveTo < originalEnd)
            {
                // Case (b): Strict interior split - Shorten head + create active tail clone [request.EffectiveTo, originalEnd)
                isSplit = true;
                overlappingRate.EffectiveTo = request.EffectiveFrom;

                _context.RoomTypeRateAudits.Add(new RoomTypeRateAudit
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId.Value,
                    PropertyId = targetPropertyId,
                    RoomTypeId = roomType.Id,
                    RateId = overlappingRate.Id,
                    OldEffectiveFrom = originalStart,
                    OldEffectiveTo = originalEnd,
                    OldNightlyPrice = overlappingRate.NightlyPrice,
                    NewEffectiveFrom = originalStart,
                    NewEffectiveTo = request.EffectiveFrom,
                    NewNightlyPrice = overlappingRate.NightlyPrice,
                    ActionType = "Split_Shortened",
                    ChangedByUserId = userId,
                    ChangedAtUtc = utcNow,
                    ChangeReason = request.ChangeReason
                });

                var tailRate = new RoomTypeRate
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId.Value,
                    PropertyId = targetPropertyId,
                    RoomTypeId = roomType.Id,
                    FirstHours = overlappingRate.FirstHours,
                    FirstHoursPrice = overlappingRate.FirstHoursPrice,
                    AdditionalHourPrice = overlappingRate.AdditionalHourPrice,
                    NightlyPrice = overlappingRate.NightlyPrice,
                    Currency = overlappingRate.Currency,
                    EffectiveFrom = request.EffectiveTo,
                    EffectiveTo = originalEnd,
                    CreatedByUserId = userId,
                    ChangeReason = overlappingRate.ChangeReason,
                    IsActive = true
                };

                tailRatesToAdd.Add((tailRate, originalStart, originalEnd, overlappingRate.NightlyPrice));
            }
            else if (originalStart < request.EffectiveFrom && request.EffectiveTo >= originalEnd)
            {
                // Case (c): Right-tail overlap - Shorten existing rate to end at request.EffectiveFrom
                isSplit = true;
                overlappingRate.EffectiveTo = request.EffectiveFrom;

                _context.RoomTypeRateAudits.Add(new RoomTypeRateAudit
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId.Value,
                    PropertyId = targetPropertyId,
                    RoomTypeId = roomType.Id,
                    RateId = overlappingRate.Id,
                    OldEffectiveFrom = originalStart,
                    OldEffectiveTo = originalEnd,
                    OldNightlyPrice = overlappingRate.NightlyPrice,
                    NewEffectiveFrom = originalStart,
                    NewEffectiveTo = request.EffectiveFrom,
                    NewNightlyPrice = overlappingRate.NightlyPrice,
                    ActionType = "Split_Shortened",
                    ChangedByUserId = userId,
                    ChangedAtUtc = utcNow,
                    ChangeReason = request.ChangeReason
                });
            }
            else
            {
                // Case (d): Left-head overlap - Advance existing rate start to request.EffectiveTo
                isSplit = true;
                overlappingRate.EffectiveFrom = request.EffectiveTo;

                _context.RoomTypeRateAudits.Add(new RoomTypeRateAudit
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId.Value,
                    PropertyId = targetPropertyId,
                    RoomTypeId = roomType.Id,
                    RateId = overlappingRate.Id,
                    OldEffectiveFrom = originalStart,
                    OldEffectiveTo = originalEnd,
                    OldNightlyPrice = overlappingRate.NightlyPrice,
                    NewEffectiveFrom = request.EffectiveTo,
                    NewEffectiveTo = originalEnd,
                    NewNightlyPrice = overlappingRate.NightlyPrice,
                    ActionType = "Trimmed_Head",
                    ChangedByUserId = userId,
                    ChangedAtUtc = utcNow,
                    ChangeReason = request.ChangeReason
                });
            }
        }

        // Flush modified/deactivated overlapping rates BEFORE inserting newRate & split tails
        // so PostgreSQL gist exclusion constraint (EXCLUDE_RoomTypeRates_NoOverlap) never collides transiently.
        if (overlappingRates.Count > 0)
        {
            await _context.SaveChangesAsync(cancellationToken);
        }

        // Insert new active rate
        var newRate = new RoomTypeRate
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId.Value,
            PropertyId = targetPropertyId,
            RoomTypeId = roomType.Id,
            FirstHours = request.FirstHours,
            FirstHoursPrice = request.FirstHoursPrice,
            AdditionalHourPrice = request.AdditionalHourPrice,
            NightlyPrice = request.NightlyPrice,
            Currency = string.IsNullOrWhiteSpace(request.Currency) ? "VND" : request.Currency,
            EffectiveFrom = request.EffectiveFrom,
            EffectiveTo = request.EffectiveTo,
            CreatedByUserId = userId,
            ChangeReason = request.ChangeReason,
            IsActive = true
        };

        _context.RoomTypeRates.Add(newRate);

        var newAuditAction = isSplit ? "Split_Created" : (isReplaced ? "Replaced_Created" : "Created");
        _context.RoomTypeRateAudits.Add(new RoomTypeRateAudit
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId.Value,
            PropertyId = targetPropertyId,
            RoomTypeId = roomType.Id,
            RateId = newRate.Id,
            NewEffectiveFrom = newRate.EffectiveFrom,
            NewEffectiveTo = newRate.EffectiveTo,
            NewNightlyPrice = newRate.NightlyPrice,
            ActionType = newAuditAction,
            ChangedByUserId = userId,
            ChangedAtUtc = utcNow,
            ChangeReason = request.ChangeReason
        });

        foreach (var (tailRate, originalStart, originalEnd, oldNightlyPrice) in tailRatesToAdd)
        {
            _context.RoomTypeRates.Add(tailRate);
            _context.RoomTypeRateAudits.Add(new RoomTypeRateAudit
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId.Value,
                PropertyId = targetPropertyId,
                RoomTypeId = roomType.Id,
                RateId = tailRate.Id,
                OldEffectiveFrom = originalStart,
                OldEffectiveTo = originalEnd,
                OldNightlyPrice = oldNightlyPrice,
                NewEffectiveFrom = tailRate.EffectiveFrom,
                NewEffectiveTo = tailRate.EffectiveTo,
                NewNightlyPrice = tailRate.NightlyPrice,
                ActionType = "Split_TailCreated",
                ChangedByUserId = userId,
                ChangedAtUtc = utcNow,
                ChangeReason = request.ChangeReason
            });
        }

        await _context.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return new RoomTypeRateDto
        {
            Id = newRate.Id,
            PropertyId = newRate.PropertyId,
            RoomTypeId = newRate.RoomTypeId,
            FirstHours = newRate.FirstHours,
            FirstHoursPrice = newRate.FirstHoursPrice,
            AdditionalHourPrice = newRate.AdditionalHourPrice,
            NightlyPrice = newRate.NightlyPrice,
            Currency = newRate.Currency,
            EffectiveFrom = newRate.EffectiveFrom,
            EffectiveTo = newRate.EffectiveTo,
            ChangeReason = newRate.ChangeReason,
            IsActive = newRate.IsActive,
            CreatedAtUtc = newRate.CreatedAtUtc
        };
    }
}
