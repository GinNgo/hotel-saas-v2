using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Common.Models;
using HotelSaas.Application.Payments.DTOs;
using HotelSaas.Application.Payments.Queries.GetFolio;
using HotelSaas.Application.Quotes.DTOs;
using HotelSaas.Application.Reservations.DTOs;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Payments.Commands.AddFolioItem;

public sealed class AddFolioItemCommandHandler : IRequestHandler<AddFolioItemCommand, FolioDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentTenantService _tenantService;
    private readonly ICurrentUserContext _userContext;
    private readonly IMembershipLookupService _membershipLookupService;
    private readonly ISender _mediator;

    public AddFolioItemCommandHandler(
        IApplicationDbContext context,
        ICurrentTenantService tenantService,
        ICurrentUserContext userContext,
        IMembershipLookupService membershipLookupService,
        ISender mediator)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _tenantService = tenantService ?? throw new ArgumentNullException(nameof(tenantService));
        _userContext = userContext ?? throw new ArgumentNullException(nameof(userContext));
        _membershipLookupService = membershipLookupService ?? throw new ArgumentNullException(nameof(membershipLookupService));
        _mediator = mediator ?? throw new ArgumentNullException(nameof(mediator));
    }

    public async Task<FolioDto> Handle(AddFolioItemCommand request, CancellationToken cancellationToken)
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

        // Authoritative membership check - fail-closed
        var membership = await _membershipLookupService.ResolveMembershipAsync(
            tenantId.Value,
            userId,
            request.PropertyId,
            cancellationToken);

        if (membership.Status != MembershipLookupStatus.Success)
        {
            throw new ForbiddenException("ERR_MEMBERSHIP_FORBIDDEN", membership.ErrorMessage ?? "Bạn không có quyền thực hiện thao tác tại chi nhánh này.");
        }

        var reservation = await _context.Reservations
            .FirstOrDefaultAsync(r => r.Id == request.ReservationId &&
                                      r.PropertyId == request.PropertyId &&
                                      r.TenantId == tenantId.Value, cancellationToken);

        if (reservation == null)
        {
            throw new NotFoundException("Không tìm thấy thông tin đơn đặt phòng.");
        }

        if (reservation.Status == ReservationStatus.Cancelled)
        {
            throw new BadRequestException("ERR_RESERVATION_CANCELLED", "Đơn đặt phòng đã bị hủy, không thể thêm dịch vụ.");
        }

        if (reservation.Status == ReservationStatus.CheckedOut)
        {
            throw new BadRequestException("ERR_RESERVATION_CHECKEDOUT", "Khách đã trả phòng, không thể bổ sung phí dịch vụ.");
        }

        decimal lineAmount = Math.Round(request.Quantity * request.UnitPrice, 0, MidpointRounding.AwayFromZero);

        // 1. Update reservation total amount
        reservation.TotalAmount += lineAmount;

        // 2. Update snapshot breakdown
        var snapshot = ReservationSnapshotHelper.TryDeserialize(reservation.Notes);
        if (snapshot != null)
        {
            var breakdownList = snapshot.Breakdown != null ? snapshot.Breakdown.ToList() : new List<QuoteBreakdownItemDto>();
            breakdownList.Add(new QuoteBreakdownItemDto
            {
                Description = $"{request.Description} (x{request.Quantity})",
                Quantity = request.Quantity,
                UnitPrice = request.UnitPrice,
                Amount = lineAmount,
                Category = request.Category ?? "Service"
            });

            snapshot.TotalAmount = reservation.TotalAmount;
            snapshot.Breakdown = breakdownList;

            reservation.Notes = ReservationSnapshotHelper.Serialize(snapshot);
        }

        // 3. If an existing Invoice exists, add line item to invoice
        var invoice = await _context.Invoices
            .Include(i => i.InvoiceItems)
            .FirstOrDefaultAsync(i => i.ReservationId == reservation.Id && i.TenantId == tenantId.Value, cancellationToken);

        if (invoice != null)
        {
            var invoiceItem = new InvoiceItem
            {
                Id = Guid.NewGuid(),
                InvoiceId = invoice.Id,
                ItemCode = request.ItemCode,
                Description = $"{request.Description} (x{request.Quantity})",
                Quantity = request.Quantity,
                UnitPrice = request.UnitPrice,
                Amount = lineAmount,
                SortOrder = invoice.InvoiceItems.Count + 1,
                CreatedAtUtc = DateTime.UtcNow
            };

            invoice.InvoiceItems.Add(invoiceItem);
            invoice.Subtotal += lineAmount;
            invoice.GrandTotal += lineAmount;
            invoice.Balance = Math.Max(0m, invoice.GrandTotal - invoice.PaidAmount);
        }

        await _context.SaveChangesAsync(cancellationToken);

        // 4. Return refreshed Folio statement
        return await _mediator.Send(new GetFolioQuery(reservation.Id, request.PropertyId), cancellationToken);
    }
}
