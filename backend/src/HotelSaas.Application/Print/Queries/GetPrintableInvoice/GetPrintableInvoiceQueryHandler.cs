using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Print.Common;
using HotelSaas.Application.Print.DTOs;
using HotelSaas.Application.Reservations.DTOs;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Print.Queries.GetPrintableInvoice;

public sealed class GetPrintableInvoiceQueryHandler : IRequestHandler<GetPrintableInvoiceQuery, PrintableInvoiceDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserContext _currentUser;

    public GetPrintableInvoiceQueryHandler(IApplicationDbContext context, ICurrentUserContext currentUser)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _currentUser = currentUser ?? throw new ArgumentNullException(nameof(currentUser));
    }

    public async Task<PrintableInvoiceDto> Handle(GetPrintableInvoiceQuery request, CancellationToken cancellationToken)
    {
        var reservation = await _context.Reservations
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Include(r => r.Tenant)
            .Include(r => r.Property)
            .Include(r => r.Room)
            .ThenInclude(rm => rm!.RoomType)
            .Include(r => r.Payments)
            .FirstOrDefaultAsync(r => r.Id == request.ReservationId, cancellationToken);

        if (reservation == null)
        {
            throw new NotFoundException("Không tìm thấy hồ sơ đặt phòng.");
        }

        var snapshot = ReservationSnapshotHelper.TryDeserialize(reservation.Notes);

        bool isAuthorizedFullPii = (_currentUser.IsAuthenticated &&
            (_currentUser.GlobalRole == GlobalUserRole.SuperAdmin ||
             (_currentUser.TenantId.HasValue && _currentUser.TenantId.Value == reservation.TenantId) ||
             (_currentUser.UserId != Guid.Empty && reservation.GuestUserId == _currentUser.UserId))) ||
            (!string.IsNullOrWhiteSpace(request.Code) &&
             (string.Equals(request.Code.Trim(), reservation.ConfirmationCode, StringComparison.OrdinalIgnoreCase) ||
              (snapshot != null && !snapshot.IsTokenRevoked && !string.IsNullOrWhiteSpace(snapshot.LookupToken) &&
               string.Equals(request.Code.Trim(), snapshot.LookupToken, StringComparison.OrdinalIgnoreCase))));

        var printConfigs = await _context.PrintTemplateConfigs
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(c => c.TenantId == reservation.TenantId && (c.PropertyId == reservation.PropertyId || c.PropertyId == null))
            .ToListAsync(cancellationToken);

        var printConfig = printConfigs.FirstOrDefault(c => c.PropertyId == reservation.PropertyId)
            ?? printConfigs.FirstOrDefault(c => c.PropertyId == null);

        var invoice = await _context.Invoices
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Include(i => i.InvoiceItems)
            .FirstOrDefaultAsync(i => i.ReservationId == request.ReservationId, cancellationToken);

        var propertyName = reservation.Property?.Name ?? reservation.Tenant?.Name ?? "Khách Sạn & Khu Nghỉ Dưỡng";
        var headerCompany = !string.IsNullOrWhiteSpace(printConfig?.HeaderCompanyName) ? printConfig!.HeaderCompanyName : propertyName;
        var address = !string.IsNullOrWhiteSpace(printConfig?.HeaderAddress) ? printConfig!.HeaderAddress : (reservation.Property?.Address ?? string.Empty);
        var taxCode = printConfig?.TaxNumber ?? string.Empty;
        var hotline = !string.IsNullOrWhiteSpace(printConfig?.Hotline) ? printConfig!.Hotline : (reservation.Property?.PhoneNumber ?? string.Empty);
        var logoUrl = !string.IsNullOrWhiteSpace(printConfig?.LogoUrl) ? printConfig!.LogoUrl : null;

        var totalAmount = invoice != null && invoice.GrandTotal > 0 ? invoice.GrandTotal : reservation.TotalAmount;
        var vatRate = invoice != null
            ? Math.Round(invoice.TaxRate * 100m, 2)
            : (reservation.Property?.TaxRatePercent > 0 ? reservation.Property!.TaxRatePercent : 8m);
        var vatAmount = invoice?.TaxAmount ?? Math.Round(totalAmount * (vatRate / 100m), 0);
        var subTotal = invoice != null && invoice.Subtotal > 0 ? invoice.Subtotal : totalAmount - vatAmount;

        var completedNonRefundPayments = reservation.Payments
            .Where(p => p.Status == PaymentStatus.Completed &&
                        (p.TransactionRef == null || !p.TransactionRef.Contains("REFUND", StringComparison.OrdinalIgnoreCase)))
            .ToList();
        var paidAmount = completedNonRefundPayments.Sum(p => p.Amount);
        var remainingAmount = Math.Max(0, totalAmount - paidAmount);

        var hasBankConfig = printConfig != null &&
            !string.IsNullOrWhiteSpace(printConfig.BankName) &&
            !string.IsNullOrWhiteSpace(printConfig.BankAccountNumber);
        var bankName = hasBankConfig ? printConfig!.BankName : string.Empty;
        var bankAcc = hasBankConfig ? printConfig!.BankAccountNumber : string.Empty;
        var bankHolder = hasBankConfig ? printConfig!.BankAccountHolder : string.Empty;
        var showVietQr = (printConfig?.ShowVietQrCode ?? false) && hasBankConfig && remainingAmount > 0;
        var vietQrUrl = showVietQr
            ? $"https://img.vietqr.io/image/{Uri.EscapeDataString(bankName)}-{Uri.EscapeDataString(bankAcc)}-compact2.png?amount={remainingAmount:0}&addInfo={Uri.EscapeDataString($"THANHTOAN {reservation.ConfirmationCode}")}"
            : string.Empty;

        var rentalType = snapshot?.RentalType.ToString() ??
            (reservation.CheckInDate == reservation.CheckOutDate ? RentalType.Hourly.ToString() : RentalType.Overnight.ToString());

        var lineItems = new List<InvoiceLineItemDto>();
        if (invoice != null && invoice.InvoiceItems.Any())
        {
            lineItems = invoice.InvoiceItems.Select(item => new InvoiceLineItemDto
            {
                Description = item.Description,
                Quantity = item.Quantity,
                UnitPrice = item.UnitPrice,
                Amount = item.Amount
            }).ToList();
        }
        else
        {
            var roomTypeName = reservation.Room?.RoomType?.Name ?? snapshot?.RoomTypeName ?? "Phòng Tiêu Chuẩn";
            var roomNumber = isAuthorizedFullPii
                ? (reservation.Room?.RoomNumber ?? "Chưa chỉ định")
                : (string.IsNullOrWhiteSpace(reservation.Room?.RoomNumber) ? "Chưa chỉ định" : "***");
            if (snapshot?.RentalType == RentalType.Hourly)
            {
                var hours = Math.Max(1, (int)Math.Ceiling((snapshot.EndAtUtc - snapshot.StartAtUtc).TotalHours));
                lineItems.Add(new InvoiceLineItemDto
                {
                    Description = $"Tiền phòng: {roomTypeName} (Phòng {roomNumber}) - {hours} giờ",
                    Quantity = hours,
                    UnitPrice = Math.Round(subTotal / hours, 0),
                    Amount = subTotal
                });
            }
            else
            {
                var nights = Math.Max(1, (reservation.CheckOutDate.ToDateTime(TimeOnly.MinValue) - reservation.CheckInDate.ToDateTime(TimeOnly.MinValue)).Days);
                lineItems.Add(new InvoiceLineItemDto
                {
                    Description = $"Tiền phòng: {roomTypeName} (Phòng {roomNumber}) - {nights} đêm",
                    Quantity = nights,
                    UnitPrice = Math.Round(subTotal / nights, 0),
                    Amount = subTotal
                });
            }
        }

        return new PrintableInvoiceDto
        {
            ReservationId = reservation.Id,
            InvoiceNumber = invoice?.InvoiceNumber ?? $"HD-{DateTime.UtcNow:yyyyMMdd}-{reservation.ConfirmationCode}",
            ConfirmationCode = reservation.ConfirmationCode,
            IssuedDate = invoice?.IssuedAtUtc ?? DateTime.UtcNow,
            HeaderCompanyName = headerCompany,
            HeaderAddress = address,
            TaxNumber = taxCode,
            Hotline = hotline,
            LogoUrl = logoUrl,
            PropertyName = propertyName,
            GuestName = isAuthorizedFullPii ? reservation.GuestName : MaskGuestName(reservation.GuestName),
            GuestEmail = isAuthorizedFullPii ? reservation.GuestEmail : PrintHelper.MaskEmail(reservation.GuestEmail),
            GuestPhone = isAuthorizedFullPii ? (reservation.GuestPhone ?? string.Empty) : PrintHelper.MaskPhone(reservation.GuestPhone),
            RoomNumber = isAuthorizedFullPii
                ? (reservation.Room?.RoomNumber ?? string.Empty)
                : (string.IsNullOrWhiteSpace(reservation.Room?.RoomNumber) ? string.Empty : "***"),
            RoomTypeName = reservation.Room?.RoomType?.Name ?? snapshot?.RoomTypeName ?? string.Empty,
            RentalType = rentalType,
            CheckInDate = reservation.CheckInDate,
            CheckOutDate = reservation.CheckOutDate,
            NumberOfGuests = reservation.NumberOfGuests,
            SubTotal = subTotal,
            VatRate = vatRate,
            VatAmount = vatAmount,
            TotalAmount = totalAmount,
            PaidAmount = paidAmount,
            RemainingAmount = remainingAmount,
            Status = remainingAmount <= 0 ? "ĐÃ THANH TOÁN ĐỦ" : "CÒN CÔNG NỢ",
            PaymentMethod = completedNonRefundPayments.OrderByDescending(p => p.CreatedAtUtc).Select(p => p.Method.ToString()).FirstOrDefault()
                ?? reservation.PaymentMethodPreference.ToString(),
            VietQrImageUrl = isAuthorizedFullPii ? vietQrUrl : string.Empty,
            ShowVietQrCode = isAuthorizedFullPii && showVietQr,
            BankAccountNumber = isAuthorizedFullPii ? bankAcc : MaskBankAccountNumber(bankAcc),
            BankAccountHolder = bankHolder,
            BankName = bankName,
            CheckInPolicyText = printConfig?.CheckInPolicyText ?? "Nhận phòng từ 14:00 - Trả phòng trước 12:00. Vui lòng xuất trình CCCD/Hộ chiếu khi làm thủ tục.",
            FooterNote = printConfig?.FooterNote ?? "Cảm ơn Quý khách đã tin tưởng và sử dụng dịch vụ của chúng tôi! Hẹn gặp lại Quý khách.",
            Items = lineItems
        };
    }

    private static string MaskGuestName(string? name)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            return string.Empty;
        }

        var words = name.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries);
        return string.Join(' ', words.Select(w => w.Length <= 1 ? "*" : $"{w[0]}***"));
    }

    private static string MaskBankAccountNumber(string? accountNumber)
    {
        if (string.IsNullOrWhiteSpace(accountNumber))
        {
            return string.Empty;
        }

        var trimmed = accountNumber.Trim();
        if (trimmed.Length <= 4)
        {
            return "****";
        }

        return $"{new string('*', trimmed.Length - 3)}{trimmed[^3..]}";
    }
}
