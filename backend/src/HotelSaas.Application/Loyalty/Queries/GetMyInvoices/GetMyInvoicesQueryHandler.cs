using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Loyalty.DTOs;
using HotelSaas.Application.Loyalty.Services;
using HotelSaas.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Loyalty.Queries.GetMyInvoices;

public sealed class GetMyInvoicesQueryHandler : IRequestHandler<GetMyInvoicesQuery, List<GuestInvoiceRecordDto>>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserContext _userContext;

    public GetMyInvoicesQueryHandler(
        IApplicationDbContext context,
        ICurrentUserContext userContext)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _userContext = userContext ?? throw new ArgumentNullException(nameof(userContext));
    }

    public async Task<List<GuestInvoiceRecordDto>> Handle(GetMyInvoicesQuery request, CancellationToken cancellationToken)
    {
        var userId = _userContext.UserId;
        if (userId == Guid.Empty)
        {
            throw new UnauthorizedAccessException("Yêu cầu đăng nhập tài khoản.");
        }

        var user = await _context.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);

        if (user == null)
        {
            throw new NotFoundException("Tài khoản người dùng không tồn tại.");
        }

        var reservations = await _context.Reservations
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Include(r => r.Property)
            .Include(r => r.Tenant)
            .Include(r => r.Room)
                .ThenInclude(rm => rm!.RoomType)
            .Include(r => r.Payments)
            .Where(r => r.GuestUserId == userId)
            .OrderByDescending(r => r.CreatedAtUtc)
            .Take(50)
            .ToListAsync(cancellationToken);

        if (reservations.Count == 0)
        {
            return new List<GuestInvoiceRecordDto>();
        }

        var reservationIds = reservations.Select(r => r.Id).ToList();
        var tenantIds = reservations.Select(r => r.TenantId).Distinct().ToList();

        var existingInvoices = await _context.Invoices
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Include(i => i.InvoiceItems)
            .Where(i => reservationIds.Contains(i.ReservationId))
            .ToDictionaryAsync(i => i.ReservationId, cancellationToken);

        var printConfigs = await _context.PrintTemplateConfigs
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(c => tenantIds.Contains(c.TenantId))
            .ToListAsync(cancellationToken);

        var results = new List<GuestInvoiceRecordDto>(reservations.Count);

        foreach (var res in reservations)
        {
            existingInvoices.TryGetValue(res.Id, out var inv);
            var printConfig = ResolvePrintConfig(printConfigs, res.TenantId, res.PropertyId);
            results.Add(GuestInvoiceRecordMapper.Map(res, inv, printConfig, "Chuyển khoản / Điểm thưởng"));
        }

        return results;
    }

    private static PrintTemplateConfig? ResolvePrintConfig(
        IReadOnlyList<PrintTemplateConfig> configs,
        Guid tenantId,
        Guid propertyId)
    {
        return configs.FirstOrDefault(c => c.TenantId == tenantId && c.PropertyId == propertyId)
            ?? configs.FirstOrDefault(c => c.TenantId == tenantId && c.PropertyId == null);
    }
}
