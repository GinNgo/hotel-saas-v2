using System;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Payments.Commands.CreateVnpayUrl;

/// <summary>
/// Command to generate a secure VNPay checkout URL for a reservation or public room hold.
/// </summary>
public sealed record CreateVnpayUrlCommand(
    Guid? ReservationId,
    string? LookupToken,
    string? ClientIp,
    string? ReturnUrl = null
) : IRequest<VnpayCreateUrlResult>;

public sealed class CreateVnpayUrlCommandHandler : IRequestHandler<CreateVnpayUrlCommand, VnpayCreateUrlResult>
{
    private readonly IApplicationDbContext _context;
    private readonly IVnpayPaymentService _vnpayService;

    public CreateVnpayUrlCommandHandler(
        IApplicationDbContext context,
        IVnpayPaymentService vnpayService)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _vnpayService = vnpayService ?? throw new ArgumentNullException(nameof(vnpayService));
    }

    public async Task<VnpayCreateUrlResult> Handle(CreateVnpayUrlCommand request, CancellationToken cancellationToken)
    {
        if (!request.ReservationId.HasValue && string.IsNullOrWhiteSpace(request.LookupToken))
        {
            throw new BadRequestException("ERR_RESERVATION_REQUIRED", "Yêu cầu mã đặt phòng (ReservationId) hoặc mã tra cứu (LookupToken).");
        }

        var query = _context.Reservations
            .IgnoreQueryFilters()
            .Include(r => r.Property)
            .AsNoTracking();

        Domain.Entities.Reservation? reservation = null;

        if (request.ReservationId.HasValue)
        {
            reservation = await query.FirstOrDefaultAsync(r => r.Id == request.ReservationId.Value, cancellationToken);
        }
        else if (!string.IsNullOrWhiteSpace(request.LookupToken))
        {
            // Lookup token may be ConfirmationCode or Guid lookup token
            reservation = await query.FirstOrDefaultAsync(r => r.ConfirmationCode == request.LookupToken, cancellationToken);
        }

        if (reservation == null)
        {
            throw new NotFoundException("Không tìm thấy thông tin đơn đặt phòng.");
        }

        if (reservation.Status == ReservationStatus.Cancelled)
        {
            throw new BadRequestException("ERR_RESERVATION_CANCELLED", "Đơn đặt phòng này đã bị hủy, không thể thanh toán.");
        }

        if (reservation.Status == ReservationStatus.CheckedIn || reservation.Status == ReservationStatus.CheckedOut)
        {
            throw new BadRequestException("ERR_INVALID_STATUS", "Đơn đặt phòng đang trong quá trình hoặc đã hoàn tất lưu trú.");
        }

        // Verify remaining payable amount
        decimal existingPaid = await _context.Payments
            .IgnoreQueryFilters()
            .Where(p => p.ReservationId == reservation.Id && p.Status == PaymentStatus.Completed)
            .SumAsync(p => (decimal?)p.Amount, cancellationToken) ?? 0m;

        decimal payableAmount = reservation.TotalAmount - existingPaid;
        if (payableAmount <= 0)
        {
            throw new ConflictException("ERR_ALREADY_PAID", "Đơn đặt phòng này đã được thanh toán đầy đủ.");
        }

        var clientIp = string.IsNullOrWhiteSpace(request.ClientIp) ? "127.0.0.1" : request.ClientIp;
        var orderInfo = $"Thanh toan don #{reservation.ConfirmationCode} {reservation.Property?.Name}";

        return _vnpayService.CreatePaymentUrl(
            reservation.Id,
            reservation.ConfirmationCode,
            payableAmount,
            orderInfo,
            clientIp,
            request.ReturnUrl
        );
    }
}
