using System;
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

namespace HotelSaas.Application.Loyalty.Queries.GetGuestInvoicePrintView;

public sealed class GetGuestInvoicePrintViewQueryHandler : IRequestHandler<GetGuestInvoicePrintViewQuery, GuestInvoiceRecordDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserContext _userContext;

    public GetGuestInvoicePrintViewQueryHandler(
        IApplicationDbContext context,
        ICurrentUserContext userContext)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _userContext = userContext ?? throw new ArgumentNullException(nameof(userContext));
    }

    public async Task<GuestInvoiceRecordDto> Handle(GetGuestInvoicePrintViewQuery request, CancellationToken cancellationToken)
    {
        var userId = _userContext.UserId;
        if (userId == Guid.Empty)
        {
            throw new UnauthorizedAccessException("Yêu cầu đăng nhập tài khoản.");
        }

        // Try to load as Invoice first across tenant boundaries
        var invoice = await _context.Invoices
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Include(i => i.InvoiceItems)
            .Include(i => i.Reservation)
                .ThenInclude(r => r!.Property)
            .Include(i => i.Reservation)
                .ThenInclude(r => r!.Tenant)
            .Include(i => i.Reservation)
                .ThenInclude(r => r!.Room)
                    .ThenInclude(rm => rm!.RoomType)
            .Include(i => i.Reservation)
                .ThenInclude(r => r!.Payments)
            .FirstOrDefaultAsync(i => i.Id == request.InvoiceOrReservationId, cancellationToken);

        Reservation? res = invoice?.Reservation;

        if (res == null)
        {
            // If not found as Invoice Id, try as Reservation Id
            res = await _context.Reservations
                .IgnoreQueryFilters()
                .AsNoTracking()
                .Include(r => r.Property)
                .Include(r => r.Tenant)
                .Include(r => r.Room)
                    .ThenInclude(rm => rm!.RoomType)
                .Include(r => r.Payments)
                .FirstOrDefaultAsync(r => r.Id == request.InvoiceOrReservationId, cancellationToken);
        }

        if (res == null)
        {
            throw new NotFoundException("Không tìm thấy thông tin hóa đơn hoặc đặt phòng.");
        }

        // Strict ownership enforcement (closes cross-guest IDOR)
        if (res.GuestUserId != userId)
        {
            throw new ForbiddenException("ERR_FORBIDDEN", "Bạn không có quyền truy cập hóa đơn của đặt phòng này.");
        }

        var printConfigs = await _context.PrintTemplateConfigs
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(c => c.TenantId == res.TenantId && (c.PropertyId == res.PropertyId || c.PropertyId == null))
            .ToListAsync(cancellationToken);

        var printConfig = printConfigs.FirstOrDefault(c => c.PropertyId == res.PropertyId)
            ?? printConfigs.FirstOrDefault(c => c.PropertyId == null);

        return GuestInvoiceRecordMapper.Map(res, invoice, printConfig, "Chuyển khoản QR / Điểm thưởng");
    }
}
