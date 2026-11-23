using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
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
    private static readonly Dictionary<string, string> BankNameToBinMap = new(StringComparer.OrdinalIgnoreCase)
    {
        ["MB"] = "970422",
        ["MBBANK"] = "970422",
        ["MB BANK"] = "970422",
        ["VIETINBANK"] = "970415",
        ["ICB"] = "970415",
        ["CTG"] = "970415",
        ["VIETCOMBANK"] = "970436",
        ["VCB"] = "970436",
        ["TECHCOMBANK"] = "970407",
        ["TCB"] = "970407",
        ["BIDV"] = "970418",
        ["TPBANK"] = "970423",
        ["TPB"] = "970423",
        ["VPBANK"] = "970432",
        ["VPB"] = "970432",
        ["OCB"] = "970448",
        ["AGRIBANK"] = "970405",
        ["VBA"] = "970405",
        ["SACOMBANK"] = "970403",
        ["STB"] = "970403",
        ["ACB"] = "970416",
        ["VIB"] = "970441",
        ["MSB"] = "970426",
        ["HDBANK"] = "970437",
        ["SHB"] = "970443",
        ["SEABANK"] = "970440",
        ["EXIMBANK"] = "970431",
        ["EIB"] = "970431"
    };

    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserContext _currentUser;
    private readonly IVietQrService? _vietQrService;
    private readonly ICurrentPropertyService? _currentPropertyService;

    public GetPrintableInvoiceQueryHandler(
        IApplicationDbContext context,
        ICurrentUserContext currentUser,
        IVietQrService? vietQrService = null,
        ICurrentPropertyService? currentPropertyService = null)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _currentUser = currentUser ?? throw new ArgumentNullException(nameof(currentUser));
        _vietQrService = vietQrService;
        _currentPropertyService = currentPropertyService;
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

        var effectiveIsTenantWide = _currentPropertyService != null
            ? _currentPropertyService.IsTenantWide
            : _currentUser.IsTenantWide;
        var effectivePropertyId = _currentPropertyService != null
            ? _currentPropertyService.PropertyId
            : _currentUser.PropertyId;
        var effectiveExcludedPropertyIds = _currentPropertyService != null
            ? _currentPropertyService.ExcludedPropertyIds
            : _currentUser.ExcludedPropertyIds;
        var isPropertyExcluded = effectiveExcludedPropertyIds != null &&
            effectiveExcludedPropertyIds.Contains(reservation.PropertyId);
        var hasStaffBranchAccess = _currentUser.TenantId.HasValue &&
            _currentUser.TenantId.Value == reservation.TenantId &&
            !isPropertyExcluded &&
            (effectiveIsTenantWide || effectivePropertyId == reservation.PropertyId);

        bool isAuthenticatedAuthorized = _currentUser.IsAuthenticated &&
            (_currentUser.GlobalRole == GlobalUserRole.SuperAdmin ||
             hasStaffBranchAccess ||
             (_currentUser.UserId != Guid.Empty && reservation.GuestUserId == _currentUser.UserId));

        var trimmedCode = request.Code?.Trim();
        bool isLookupTokenMatch = !string.IsNullOrWhiteSpace(trimmedCode) &&
            snapshot != null &&
            !string.IsNullOrWhiteSpace(snapshot.LookupToken) &&
            string.Equals(trimmedCode, snapshot.LookupToken, StringComparison.OrdinalIgnoreCase);

        if (!isAuthenticatedAuthorized && isLookupTokenMatch && snapshot != null &&
            (snapshot.IsTokenRevoked ||
             !snapshot.TokenExpiresAtUtc.HasValue ||
             snapshot.TokenExpiresAtUtc.Value <= DateTime.UtcNow))
        {
            throw new NotFoundException("Mã tra cứu đặt phòng đã hết hạn hoặc bị thu hồi.");
        }

        bool isValidLookupToken = isLookupTokenMatch &&
            snapshot != null &&
            !snapshot.IsTokenRevoked &&
            snapshot.TokenExpiresAtUtc.HasValue &&
            snapshot.TokenExpiresAtUtc.Value > DateTime.UtcNow;

        bool isAuthorizedFullPii = isAuthenticatedAuthorized || isValidLookupToken;

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

        var totalAmount = invoice != null && (invoice.GrandTotal > 0m || invoice.Subtotal > 0m)
            ? invoice.GrandTotal
            : reservation.TotalAmount;
        var vatRate = invoice != null
            ? Math.Round(invoice.TaxRate * 100m, 2)
            : (reservation.Property?.TaxRatePercent > 0m ? reservation.Property!.TaxRatePercent : 8m);

        decimal subTotal;
        decimal vatAmount;
        decimal serviceFeeAmount;
        decimal discountAmount;

        if (invoice != null && invoice.Subtotal > 0m)
        {
            subTotal = invoice.Subtotal;
            vatAmount = invoice.TaxAmount;
            serviceFeeAmount = invoice.ServiceFeeAmount;
            discountAmount = invoice.DiscountAmount;
        }
        else
        {
            var taxRateDecimal = invoice != null ? invoice.TaxRate : vatRate / 100m;
            var serviceFeeRateDecimal = invoice != null
                ? invoice.ServiceFeeRate
                : (reservation.Property?.ServiceFeeRatePercent > 0m
                    ? reservation.Property!.ServiceFeeRatePercent / 100m
                    : 0m);
            discountAmount = invoice != null && invoice.DiscountAmount > 0m
                ? invoice.DiscountAmount
                : Math.Max(0m, reservation.PointsDiscountAmount) + Math.Max(0m, snapshot?.PromoDiscountAmount ?? 0m);

            var denominator = 1m + taxRateDecimal + serviceFeeRateDecimal;
            if (taxRateDecimal > 0m || serviceFeeRateDecimal > 0m)
            {
                var netBase = Math.Round(totalAmount / denominator, 0, MidpointRounding.AwayFromZero);
                vatAmount = Math.Round(netBase * taxRateDecimal, 0, MidpointRounding.AwayFromZero);
                serviceFeeAmount = Math.Round(netBase * serviceFeeRateDecimal, 0, MidpointRounding.AwayFromZero);
                subTotal = Math.Max(0m, totalAmount + discountAmount - vatAmount - serviceFeeAmount);
            }
            else
            {
                vatAmount = 0m;
                serviceFeeAmount = 0m;
                subTotal = Math.Max(0m, totalAmount + discountAmount);
            }
        }

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
        var vietQrUrl = string.Empty;
        if (isAuthorizedFullPii && showVietQr)
        {
            var resolvedBin = ResolveBankBin(bankName);
            var trimmedAcc = bankAcc.Trim();
            var effectiveHolder = !string.IsNullOrWhiteSpace(bankHolder) ? bankHolder.Trim() : headerCompany.Trim();
            var effectiveCode = !string.IsNullOrWhiteSpace(reservation.ConfirmationCode)
                ? reservation.ConfirmationCode.Trim()
                : reservation.Id.ToString("N")[..8].ToUpperInvariant();

            if (_vietQrService != null)
            {
                var qr = _vietQrService.GenerateDynamicQr(new VietQrPayload(
                    BankBin: resolvedBin,
                    AccountNumber: trimmedAcc,
                    AccountName: effectiveHolder,
                    Amount: remainingAmount,
                    Description: $"DATPHONG {effectiveCode}",
                    ConfirmationCode: effectiveCode,
                    ReservationId: reservation.Id));
                vietQrUrl = qr.QrImageUrl;
            }
            else
            {
                var compactCode = new string(effectiveCode.Where(char.IsLetterOrDigit).ToArray()).ToUpperInvariant();
                var fallbackDesc = string.IsNullOrWhiteSpace(compactCode) ? "DATPHONG" : $"DATPHONG {compactCode}";
                var roundedAmount = (long)Math.Max(0, Math.Round(remainingAmount, 0, MidpointRounding.AwayFromZero));
                vietQrUrl = $"https://img.vietqr.io/image/{Uri.EscapeDataString(resolvedBin)}-{Uri.EscapeDataString(trimmedAcc)}-compact2.png?amount={roundedAmount}&addInfo={WebUtility.UrlEncode(fallbackDesc)}";
            }
        }

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
            ServiceFeeAmount = serviceFeeAmount,
            DiscountAmount = discountAmount,
            TotalAmount = totalAmount,
            PaidAmount = paidAmount,
            RemainingAmount = remainingAmount,
            Status = remainingAmount <= 0 ? "ĐÃ THANH TOÁN ĐỦ" : "CÒN CÔNG NỢ",
            PaymentMethod = completedNonRefundPayments.OrderByDescending(p => p.CreatedAtUtc).Select(p => p.Method.ToString()).FirstOrDefault()
                ?? reservation.PaymentMethodPreference.ToString(),
            VietQrImageUrl = isAuthorizedFullPii ? vietQrUrl : string.Empty,
            ShowVietQrCode = isAuthorizedFullPii && showVietQr,
            BankAccountNumber = isAuthorizedFullPii ? bankAcc : MaskBankAccountNumber(bankAcc),
            BankAccountHolder = isAuthorizedFullPii ? bankHolder : MaskGuestName(bankHolder),
            BankName = bankName,
            CheckInPolicyText = printConfig?.CheckInPolicyText ?? "Nhận phòng từ 14:00 - Trả phòng trước 12:00. Vui lòng xuất trình CCCD/Hộ chiếu khi làm thủ tục.",
            FooterNote = printConfig?.FooterNote ?? "Cảm ơn Quý khách đã tin tưởng và sử dụng dịch vụ của chúng tôi! Hẹn gặp lại Quý khách.",
            Items = lineItems
        };
    }

    private static string ResolveBankBin(string rawBankNameOrBin)
    {
        var trimmed = rawBankNameOrBin.Trim();
        if (trimmed.Length == 6 && trimmed.All(char.IsDigit))
        {
            return trimmed;
        }

        if (BankNameToBinMap.TryGetValue(trimmed, out var mappedBin))
        {
            return mappedBin;
        }

        var compact = trimmed.Replace(" ", string.Empty, StringComparison.Ordinal);
        return BankNameToBinMap.TryGetValue(compact, out mappedBin) ? mappedBin : trimmed;
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
