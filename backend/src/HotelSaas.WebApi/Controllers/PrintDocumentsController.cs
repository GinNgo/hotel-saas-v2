using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Public.Services;
using HotelSaas.Application.Reservations.DTOs;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using HotelSaas.WebApi.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.WebApi.Controllers;

/// <summary>
/// Cung cấp dữ liệu chuẩn hóa và mẫu in ấn cho các tài liệu:
/// 1. Hóa đơn thanh toán & Sổ cái phòng (Guest Invoice / Folio) kèm mã VietQR chuyển khoản.
/// 2. Phiếu xác nhận đặt phòng & Thẻ nhận phòng (Booking Voucher / Check-in Pass).
/// 3. Hợp đồng cung cấp dịch vụ phần mềm SaaS (SaaS Subscription Agreement).
/// 4. Cấu hình thông tin in ấn và thương hiệu (PrintTemplateConfig).
/// </summary>
[Authorize]
[ApiController]
[Route("api/print")]
[Produces("application/json")]
public sealed class PrintDocumentsController : ControllerBase
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserContext _currentUser;

    public PrintDocumentsController(IApplicationDbContext context, ICurrentUserContext currentUser)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _currentUser = currentUser ?? throw new ArgumentNullException(nameof(currentUser));
    }

    /// <summary>
    /// Lấy dữ liệu in Hóa đơn / Sổ cái thanh toán phòng của khách hàng theo ReservationId.
    /// Bao gồm thông tin cơ sở, chi tiết hạng phòng, phụ thu, chiết khấu, VAT và chuỗi payload VietQR chuẩn.
    /// </summary>
    [HttpGet("invoice/{reservationId:guid}")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(PrintableInvoiceDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetPrintableInvoice(
        Guid reservationId,
        [FromQuery] string? code = null,
        CancellationToken cancellationToken = default)
    {
        var reservation = await _context.Reservations
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Include(r => r.Tenant)
            .Include(r => r.Property)
            .Include(r => r.Room)
            .ThenInclude(rm => rm!.RoomType)
            .Include(r => r.Payments)
            .FirstOrDefaultAsync(r => r.Id == reservationId, cancellationToken);

        if (reservation == null)
        {
            return NotFound(new { code = "ERR_RESERVATION_NOT_FOUND", message = "Không tìm thấy hồ sơ đặt phòng." });
        }

        var snapshot = ReservationSnapshotHelper.TryDeserialize(reservation.Notes);

        bool isAuthorizedFullPii = (_currentUser.IsAuthenticated &&
            (_currentUser.GlobalRole == GlobalUserRole.SuperAdmin ||
             (_currentUser.TenantId.HasValue && _currentUser.TenantId.Value == reservation.TenantId) ||
             (_currentUser.UserId != Guid.Empty && reservation.GuestUserId == _currentUser.UserId))) ||
            (!string.IsNullOrWhiteSpace(code) &&
             (string.Equals(code.Trim(), reservation.ConfirmationCode, StringComparison.OrdinalIgnoreCase) ||
              (snapshot != null && !snapshot.IsTokenRevoked && !string.IsNullOrWhiteSpace(snapshot.LookupToken) &&
               string.Equals(code.Trim(), snapshot.LookupToken, StringComparison.OrdinalIgnoreCase))));

        var printConfigs = await _context.PrintTemplateConfigs
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(c => c.TenantId == reservation.TenantId && (c.PropertyId == reservation.PropertyId || c.PropertyId == null))
            .ToListAsync(cancellationToken);

        var printConfig = printConfigs.FirstOrDefault(c => c.PropertyId == reservation.PropertyId)
            ?? printConfigs.FirstOrDefault(c => c.PropertyId == null);

        // Lấy hóa đơn chính thức nếu đã tạo
        var invoice = await _context.Invoices
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Include(i => i.InvoiceItems)
            .FirstOrDefaultAsync(i => i.ReservationId == reservationId, cancellationToken);

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

        // Exclude REFUND transactions when summing paidAmount
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
            var roomNumber = reservation.Room?.RoomNumber ?? "Chưa chỉ định";
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

        var result = new PrintableInvoiceDto
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
            GuestName = reservation.GuestName,
            GuestEmail = isAuthorizedFullPii ? reservation.GuestEmail : MaskEmail(reservation.GuestEmail),
            GuestPhone = isAuthorizedFullPii ? (reservation.GuestPhone ?? "") : MaskPhone(reservation.GuestPhone),
            RoomNumber = reservation.Room?.RoomNumber ?? "",
            RoomTypeName = reservation.Room?.RoomType?.Name ?? snapshot?.RoomTypeName ?? "",
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
            VietQrImageUrl = vietQrUrl,
            ShowVietQrCode = showVietQr,
            BankAccountNumber = bankAcc,
            BankAccountHolder = bankHolder,
            BankName = bankName,
            CheckInPolicyText = printConfig?.CheckInPolicyText ?? "Nhận phòng từ 14:00 - Trả phòng trước 12:00. Vui lòng xuất trình CCCD/Hộ chiếu khi làm thủ tục.",
            FooterNote = printConfig?.FooterNote ?? "Cảm ơn Quý khách đã tin tưởng và sử dụng dịch vụ của chúng tôi! Hẹn gặp lại Quý khách.",
            Items = lineItems
        };

        return Ok(result);
    }

    /// <summary>
    /// Lấy dữ liệu in Phiếu xác nhận đặt phòng / Thẻ làm thủ tục (Booking Voucher) theo LookupToken hoặc ConfirmationCode.
    /// Che giấu PII trừ khi người dùng đã xác thực là chủ đơn / nhân viên cơ sở hoặc cung cấp đúng LookupToken đầy đủ.
    /// </summary>
    [HttpGet("voucher/{confirmationCode}")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(PrintableVoucherDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetPrintableVoucher(string confirmationCode, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(confirmationCode))
        {
            return NotFound(new { code = "ERR_VOUCHER_NOT_FOUND", message = "Không tìm thấy mã đặt phòng." });
        }

        var token = confirmationCode.Trim();

        var candidates = await _context.Reservations
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Include(r => r.Property)
            .Include(r => r.Tenant)
            .Include(r => r.Room)
            .ThenInclude(rm => rm!.RoomType)
            .Where(r =>
                (r.ConfirmationCode != null && r.ConfirmationCode.ToUpper() == token.ToUpper()) ||
                (r.Notes != null && r.Notes.Contains(token)))
            .Take(10)
            .ToListAsync(cancellationToken);

        Reservation? reservation = null;
        ReservationSnapshot? snapshot = null;
        bool isTokenMatch = false;
        bool isCodeMatch = false;

        foreach (var candidate in candidates)
        {
            var snap = ReservationSnapshotHelper.TryDeserialize(candidate.Notes);
            var tokenMatched = snap != null &&
                !string.IsNullOrWhiteSpace(snap.LookupToken) &&
                string.Equals(snap.LookupToken, token, StringComparison.OrdinalIgnoreCase);
            var codeMatched = string.Equals(candidate.ConfirmationCode, token, StringComparison.OrdinalIgnoreCase);

            if (tokenMatched || codeMatched)
            {
                reservation = candidate;
                snapshot = snap;
                isTokenMatch = tokenMatched;
                isCodeMatch = codeMatched;
                if (tokenMatched) break;
            }
        }

        if (reservation == null)
        {
            return NotFound(new { code = "ERR_VOUCHER_NOT_FOUND", message = "Không tìm thấy mã đặt phòng." });
        }

        if (isTokenMatch && !isCodeMatch && snapshot != null &&
            (snapshot.IsTokenRevoked || (snapshot.TokenExpiresAtUtc.HasValue && snapshot.TokenExpiresAtUtc.Value <= DateTime.UtcNow)))
        {
            return NotFound(new { code = "ERR_VOUCHER_NOT_FOUND", message = "Mã tra cứu đặt phòng đã hết hạn hoặc bị thu hồi." });
        }

        bool isAuthenticatedOwnerOrStaff = _currentUser.IsAuthenticated &&
            (_currentUser.GlobalRole == GlobalUserRole.SuperAdmin ||
             (_currentUser.TenantId.HasValue && _currentUser.TenantId.Value == reservation.TenantId) ||
             (_currentUser.UserId != Guid.Empty && reservation.GuestUserId == _currentUser.UserId));

        bool isValidTokenMatch = isTokenMatch && snapshot != null && !snapshot.IsTokenRevoked &&
            (!snapshot.TokenExpiresAtUtc.HasValue || snapshot.TokenExpiresAtUtc.Value > DateTime.UtcNow);

        bool isAuthorizedFullPii = isAuthenticatedOwnerOrStaff || isValidTokenMatch;

        var voucherConfigs = await _context.PrintTemplateConfigs
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(c => c.TenantId == reservation.TenantId && (c.PropertyId == reservation.PropertyId || c.PropertyId == null))
            .ToListAsync(cancellationToken);

        var printConfig = voucherConfigs.FirstOrDefault(c => c.PropertyId == reservation.PropertyId)
            ?? voucherConfigs.FirstOrDefault(c => c.PropertyId == null);

        var property = reservation.Property;
        var roomType = reservation.Room?.RoomType;
        var checkInTime = property != null ? property.CheckInTime.ToString("HH:mm") : "14:00";
        var checkOutTime = property != null ? property.CheckOutTime.ToString("HH:mm") : "12:00";
        var rentalType = snapshot?.RentalType.ToString() ??
            (reservation.CheckInDate == reservation.CheckOutDate ? RentalType.Hourly.ToString() : RentalType.Overnight.ToString());

        var result = new PrintableVoucherDto
        {
            ConfirmationCode = reservation.ConfirmationCode,
            CreatedAtUtc = reservation.CreatedAtUtc,
            PropertyName = property?.Name ?? reservation.Tenant?.Name ?? "Khách Sạn Đối Tác",
            PropertyAddress = property?.Address ?? string.Empty,
            PropertyPhone = !string.IsNullOrWhiteSpace(property?.PhoneNumber) ? property!.PhoneNumber : (printConfig?.Hotline ?? string.Empty),
            PropertyEmail = property?.Email ?? string.Empty,
            GuestName = isAuthorizedFullPii ? reservation.GuestName : PiiMaskingHelper.MaskName(reservation.GuestName),
            GuestEmail = isAuthorizedFullPii ? reservation.GuestEmail : MaskEmail(reservation.GuestEmail),
            GuestPhone = isAuthorizedFullPii ? (reservation.GuestPhone ?? "") : MaskPhone(reservation.GuestPhone),
            RoomTypeName = roomType?.Name ?? snapshot?.RoomTypeName ?? "Phòng Tiêu Chuẩn",
            RoomNumber = reservation.Room?.RoomNumber ?? "Lễ tân sắp xếp khi check-in",
            RentalType = rentalType,
            CheckInDate = reservation.CheckInDate,
            CheckInTime = checkInTime,
            CheckOutDate = reservation.CheckOutDate,
            CheckOutTime = checkOutTime,
            NumberOfGuests = reservation.NumberOfGuests,
            TotalAmount = reservation.TotalAmount,
            Status = reservation.Status.ToString(),
            BedType = roomType?.BedType ?? "1 Giường King",
            SquareMeters = roomType?.SquareMeters ?? 28,
            PolicyNote = printConfig?.CheckInPolicyText ?? $"Nhận phòng từ {checkInTime} - Trả phòng trước {checkOutTime}. Vui lòng xuất trình CCCD/Hộ chiếu gốc tại quầy lễ tân.",
            FooterNote = printConfig?.FooterNote ?? "Cảm ơn Quý khách đã tin tưởng và sử dụng dịch vụ của chúng tôi!",
            SpecialRequests = isAuthorizedFullPii ? ReservationSnapshotHelper.CleanCustomerNotes(reservation.Notes, snapshot) : null,
            QrCodeData = isAuthorizedFullPii
                ? $"HOTEL-CHECKIN:{reservation.ConfirmationCode}:{reservation.GuestName}"
                : $"HOTEL-CHECKIN:{reservation.ConfirmationCode}"
        };

        return Ok(result);
    }

    /// <summary>
    /// Lấy dữ liệu in Hợp đồng Cung cấp Dịch vụ Phần mềm SaaS chính thức theo ContractId.
    /// </summary>
    [HttpGet("contract/{contractId:guid}")]
    [ProducesResponseType(typeof(PrintableContractDocumentDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetPrintableContract(Guid contractId, CancellationToken cancellationToken = default)
    {
        var contract = await _context.TenantContracts
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Include(c => c.Tenant)
            .FirstOrDefaultAsync(c => c.Id == contractId, cancellationToken);

        if (contract == null)
        {
            return NotFound(new { code = "ERR_CONTRACT_NOT_FOUND", message = "Không tìm thấy hợp đồng." });
        }

        if (_currentUser.GlobalRole != GlobalUserRole.SuperAdmin &&
            (!_currentUser.TenantId.HasValue || _currentUser.TenantId.Value != contract.TenantId))
        {
            return Forbid();
        }

        var propertiesCount = await _context.Properties
            .IgnoreQueryFilters()
            .AsNoTracking()
            .CountAsync(p => p.TenantId == contract.TenantId, cancellationToken);

        var roomsCount = await _context.Rooms
            .IgnoreQueryFilters()
            .AsNoTracking()
            .CountAsync(r => r.TenantId == contract.TenantId, cancellationToken);

        var isSigned = contract.SignedAtUtc.HasValue && !string.IsNullOrWhiteSpace(contract.DigitalSignatureHash);

        var result = new PrintableContractDocumentDto
        {
            ContractId = contract.Id,
            ContractNumber = contract.ContractNumber,
            CreatedAtUtc = contract.CreatedAtUtc,
            SignedDate = contract.SignedAtUtc ?? contract.CreatedAtUtc,
            SignedAtUtc = contract.SignedAtUtc,
            Status = contract.Status.ToString(),
            IsSigned = isSigned,
            StartDate = contract.StartDate,
            EndDate = contract.EndDate,
            // Bên A: Nền tảng Hotel SaaS
            PlatformCompanyName = "CÔNG TY CỔ PHẦN CÔNG NGHỆ NỀN TẢNG KHÁCH SẠN HOTEL SAAS VIỆT NAM",
            PlatformAddress = "Tầng 18, Tòa nhà Innovation Hub, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh",
            PlatformTaxCode = "0318889999",
            PlatformHotline = "1900 8899",
            PlatformRepresentative = "Đại diện Pháp luật Nền tảng Hotel SaaS",
            // Bên B: Khách sạn / Doanh nghiệp Đối tác
            TenantCompanyName = contract.Tenant?.Name ?? "Doanh Nghiệp Đối Tác",
            TenantCode = contract.Tenant?.Code ?? "TENANT",
            TenantRepresentative = contract.RepresentativeName,
            TenantEmail = contract.RepresentativeEmail,
            TenantPhone = contract.RepresentativePhone,
            TenantAddress = !string.IsNullOrWhiteSpace(contract.Tenant?.Address)
                ? contract.Tenant!.Address
                : "Địa chỉ trụ sở chính theo Giấy chứng nhận đăng ký doanh nghiệp",
            // Chi tiết dịch vụ
            PlanCode = contract.PlanCode,
            PlanName = contract.PlanName,
            ContractType = contract.ContractType,
            BillingCycle = contract.BillingCycle.ToString(),
            ContractValue = contract.ContractValue,
            MaxPropertiesAllowed = propertiesCount > 0 ? propertiesCount : 3,
            MaxRoomsAllowed = roomsCount > 0 ? roomsCount : 50,
            DigitalSignatureHash = isSigned ? contract.DigitalSignatureHash! : string.Empty,
            TermsAndConditions = contract.TermsAndConditions ?? "Toàn bộ điều khoản cam kết mức độ dịch vụ (SLA 99.9%) và chính sách bảo mật dữ liệu khách sạn."
        };

        return Ok(result);
    }

    /// <summary>
    /// Lấy cấu hình in ấn hiện tại của khách sạn (bắt buộc Tenant scope và quyền SETTINGS:Read).
    /// </summary>
    [HttpGet("template-config")]
    [RequirePermission("SETTINGS", PermissionAction.Read)]
    [ProducesResponseType(typeof(PrintTemplateConfigDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetTemplateConfig(
        [FromQuery] Guid? tenantId = null,
        [FromQuery] Guid? propertyId = null,
        CancellationToken cancellationToken = default)
    {
        Guid effectiveTenantId;
        if (_currentUser.GlobalRole == GlobalUserRole.SuperAdmin)
        {
            effectiveTenantId = tenantId ?? _currentUser.TenantId ?? Guid.Empty;
        }
        else
        {
            if (tenantId.HasValue && tenantId.Value != Guid.Empty &&
                (!_currentUser.TenantId.HasValue || tenantId.Value != _currentUser.TenantId.Value))
            {
                return Forbid();
            }
            effectiveTenantId = _currentUser.TenantId ?? Guid.Empty;
        }

        if (effectiveTenantId == Guid.Empty)
        {
            return Forbid();
        }

        if (propertyId.HasValue && propertyId.Value != Guid.Empty &&
            _currentUser.GlobalRole != GlobalUserRole.SuperAdmin &&
            !_currentUser.IsTenantWide &&
            _currentUser.PropertyId.HasValue &&
            propertyId.Value != _currentUser.PropertyId.Value)
        {
            return Forbid();
        }

        var targetPropertyId = propertyId.HasValue && propertyId.Value != Guid.Empty
            ? propertyId
            : _currentUser.PropertyId;

        var configs = await _context.PrintTemplateConfigs
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(c => c.TenantId == effectiveTenantId)
            .ToListAsync(cancellationToken);

        var config = targetPropertyId.HasValue && targetPropertyId.Value != Guid.Empty
            ? configs.FirstOrDefault(c => c.PropertyId == targetPropertyId.Value) ?? configs.FirstOrDefault(c => c.PropertyId == null)
            : configs.FirstOrDefault(c => c.PropertyId == null);

        if (config == null)
        {
            return Ok(new PrintTemplateConfigDto
            {
                TenantId = effectiveTenantId,
                PropertyId = targetPropertyId,
                HeaderCompanyName = string.Empty,
                HeaderAddress = string.Empty,
                TaxNumber = string.Empty,
                Hotline = string.Empty,
                BankName = string.Empty,
                BankAccountNumber = string.Empty,
                BankAccountHolder = string.Empty,
                FooterNote = "Cảm ơn Quý khách đã tin tưởng và sử dụng dịch vụ của chúng tôi!",
                CheckInPolicyText = "Nhận phòng: 14:00 - Trả phòng: 12:00. Vui lòng xuất trình CCCD gốc.",
                ShowVietQrCode = false,
                DefaultPaperSize = "A4"
            });
        }

        return Ok(MapTemplateConfigDto(config));
    }

    /// <summary>
    /// Cập nhật cấu hình in ấn của cơ sở / khách sạn.
    /// </summary>
    [HttpPut("template-config")]
    [RequirePermission("SETTINGS", PermissionAction.Update)]
    public async Task<IActionResult> SaveTemplateConfig(
        [FromBody] PrintTemplateConfigDto request,
        [FromQuery] Guid? propertyId = null,
        CancellationToken cancellationToken = default)
    {
        if (request == null)
        {
            return BadRequest(new { code = "ERR_INVALID_REQUEST", message = "Dữ liệu cấu hình không hợp lệ." });
        }

        if (_currentUser.GlobalRole != GlobalUserRole.SuperAdmin &&
            request.TenantId != Guid.Empty &&
            (!_currentUser.TenantId.HasValue || request.TenantId != _currentUser.TenantId.Value))
        {
            return Forbid();
        }

        // Fail-Closed: Strictly resolve tenantId from authenticated user context, never blind client payload
        var tenantId = _currentUser.TenantId ?? (_currentUser.GlobalRole == GlobalUserRole.SuperAdmin && request.TenantId != Guid.Empty ? request.TenantId : Guid.Empty);
        if (tenantId == Guid.Empty)
        {
            return BadRequest(new { code = "ERR_TENANT_REQUIRED", message = "Yêu cầu TenantId hợp lệ từ phiên đăng nhập." });
        }

        var targetPropertyId = propertyId.HasValue && propertyId.Value != Guid.Empty
            ? propertyId
            : (request.PropertyId.HasValue && request.PropertyId.Value != Guid.Empty ? request.PropertyId : null);

        if (targetPropertyId.HasValue &&
            _currentUser.GlobalRole != GlobalUserRole.SuperAdmin &&
            !_currentUser.IsTenantWide &&
            _currentUser.PropertyId.HasValue &&
            targetPropertyId.Value != _currentUser.PropertyId.Value)
        {
            return Forbid();
        }

        var config = await _context.PrintTemplateConfigs
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(c => c.TenantId == tenantId && c.PropertyId == targetPropertyId, cancellationToken);

        if (config == null)
        {
            config = new PrintTemplateConfig
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                PropertyId = targetPropertyId,
                CreatedAtUtc = DateTime.UtcNow
            };
            _context.PrintTemplateConfigs.Add(config);
        }

        config.HeaderCompanyName = request.HeaderCompanyName.Trim();
        config.HeaderAddress = request.HeaderAddress.Trim();
        config.TaxNumber = request.TaxNumber.Trim();
        config.Hotline = request.Hotline.Trim();
        config.LogoUrl = request.LogoUrl?.Trim();
        config.BankName = request.BankName.Trim();
        config.BankAccountNumber = request.BankAccountNumber.Trim();
        config.BankAccountHolder = request.BankAccountHolder.Trim().ToUpperInvariant();
        config.FooterNote = request.FooterNote.Trim();
        config.CheckInPolicyText = request.CheckInPolicyText.Trim();
        config.ShowVietQrCode = request.ShowVietQrCode;
        config.DefaultPaperSize = string.IsNullOrWhiteSpace(request.DefaultPaperSize) ? "A4" : request.DefaultPaperSize.Trim();
        config.UpdatedAtUtc = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);

        return Ok(MapTemplateConfigDto(config));
    }

    private static PrintTemplateConfigDto MapTemplateConfigDto(PrintTemplateConfig config) => new()
    {
        Id = config.Id,
        TenantId = config.TenantId,
        PropertyId = config.PropertyId,
        HeaderCompanyName = config.HeaderCompanyName,
        HeaderAddress = config.HeaderAddress,
        TaxNumber = config.TaxNumber,
        Hotline = config.Hotline,
        LogoUrl = config.LogoUrl,
        BankName = config.BankName,
        BankAccountNumber = config.BankAccountNumber,
        BankAccountHolder = config.BankAccountHolder,
        FooterNote = config.FooterNote,
        CheckInPolicyText = config.CheckInPolicyText,
        ShowVietQrCode = config.ShowVietQrCode,
        DefaultPaperSize = config.DefaultPaperSize
    };

    private static string MaskEmail(string? email)
    {
        if (string.IsNullOrWhiteSpace(email))
        {
            return string.Empty;
        }

        var trimmed = email.Trim();
        var atIndex = trimmed.IndexOf('@');
        if (atIndex <= 0)
        {
            return "***";
        }

        return $"{trimmed[0]}***{trimmed[atIndex..]}";
    }

    private static string MaskPhone(string? phone)
    {
        if (string.IsNullOrWhiteSpace(phone))
        {
            return string.Empty;
        }

        var trimmed = phone.Trim();
        if (trimmed.Length <= 4)
        {
            return new string('*', trimmed.Length);
        }

        if (trimmed.Length <= 6)
        {
            return $"{trimmed[..2]}***{trimmed[^1..]}";
        }

        return $"{trimmed[..3]}****{trimmed[^3..]}";
    }
}

public sealed class PrintableInvoiceDto
{
    public Guid ReservationId { get; set; }
    public string InvoiceNumber { get; set; } = string.Empty;
    public string ConfirmationCode { get; set; } = string.Empty;
    public DateTime IssuedDate { get; set; }
    public string HeaderCompanyName { get; set; } = string.Empty;
    public string HeaderAddress { get; set; } = string.Empty;
    public string TaxNumber { get; set; } = string.Empty;
    public string Hotline { get; set; } = string.Empty;
    public string? LogoUrl { get; set; }
    public string PropertyName { get; set; } = string.Empty;
    public string GuestName { get; set; } = string.Empty;
    public string GuestEmail { get; set; } = string.Empty;
    public string GuestPhone { get; set; } = string.Empty;
    public string RoomNumber { get; set; } = string.Empty;
    public string RoomTypeName { get; set; } = string.Empty;
    public string RentalType { get; set; } = string.Empty;
    public DateOnly CheckInDate { get; set; }
    public DateOnly CheckOutDate { get; set; }
    public int NumberOfGuests { get; set; }
    public decimal SubTotal { get; set; }
    public decimal VatRate { get; set; } = 8m;
    public decimal VatAmount { get; set; }
    public decimal TotalAmount { get; set; }
    public decimal PaidAmount { get; set; }
    public decimal RemainingAmount { get; set; }
    public string Status { get; set; } = string.Empty;
    public string PaymentMethod { get; set; } = string.Empty;
    public string VietQrImageUrl { get; set; } = string.Empty;
    public bool ShowVietQrCode { get; set; }
    public string BankAccountNumber { get; set; } = string.Empty;
    public string BankAccountHolder { get; set; } = string.Empty;
    public string BankName { get; set; } = string.Empty;
    public string CheckInPolicyText { get; set; } = string.Empty;
    public string FooterNote { get; set; } = string.Empty;
    public List<InvoiceLineItemDto> Items { get; set; } = new();
}

public sealed class InvoiceLineItemDto
{
    public string Description { get; set; } = string.Empty;
    public int Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal Amount { get; set; }
}

public sealed class PrintableVoucherDto
{
    public string ConfirmationCode { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; }
    public string PropertyName { get; set; } = string.Empty;
    public string PropertyAddress { get; set; } = string.Empty;
    public string PropertyPhone { get; set; } = string.Empty;
    public string PropertyEmail { get; set; } = string.Empty;
    public string GuestName { get; set; } = string.Empty;
    public string GuestEmail { get; set; } = string.Empty;
    public string GuestPhone { get; set; } = string.Empty;
    public string RoomTypeName { get; set; } = string.Empty;
    public string RoomNumber { get; set; } = string.Empty;
    public string RentalType { get; set; } = string.Empty;
    public DateOnly CheckInDate { get; set; }
    public string CheckInTime { get; set; } = "14:00";
    public DateOnly CheckOutDate { get; set; }
    public string CheckOutTime { get; set; } = "12:00";
    public int NumberOfGuests { get; set; }
    public decimal TotalAmount { get; set; }
    public string Status { get; set; } = string.Empty;
    public string BedType { get; set; } = string.Empty;
    public decimal SquareMeters { get; set; }
    public string PolicyNote { get; set; } = string.Empty;
    public string FooterNote { get; set; } = string.Empty;
    public string? SpecialRequests { get; set; }
    public string QrCodeData { get; set; } = string.Empty;
}

public sealed class PrintableContractDocumentDto
{
    public Guid ContractId { get; set; }
    public string ContractNumber { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; }
    public DateTime SignedDate { get; set; }
    public DateTime? SignedAtUtc { get; set; }
    public string Status { get; set; } = string.Empty;
    public bool IsSigned { get; set; }
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public string PlatformCompanyName { get; set; } = string.Empty;
    public string PlatformAddress { get; set; } = string.Empty;
    public string PlatformTaxCode { get; set; } = string.Empty;
    public string PlatformHotline { get; set; } = string.Empty;
    public string PlatformRepresentative { get; set; } = string.Empty;
    public string TenantCompanyName { get; set; } = string.Empty;
    public string TenantCode { get; set; } = string.Empty;
    public string TenantRepresentative { get; set; } = string.Empty;
    public string TenantEmail { get; set; } = string.Empty;
    public string TenantPhone { get; set; } = string.Empty;
    public string TenantAddress { get; set; } = string.Empty;
    public string PlanCode { get; set; } = string.Empty;
    public string PlanName { get; set; } = string.Empty;
    public string ContractType { get; set; } = string.Empty;
    public string BillingCycle { get; set; } = string.Empty;
    public decimal ContractValue { get; set; }
    public int MaxPropertiesAllowed { get; set; }
    public int MaxRoomsAllowed { get; set; }
    public string DigitalSignatureHash { get; set; } = string.Empty;
    public string TermsAndConditions { get; set; } = string.Empty;
}

public sealed class PrintTemplateConfigDto
{
    public Guid? Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid? PropertyId { get; set; }
    public string HeaderCompanyName { get; set; } = string.Empty;
    public string HeaderAddress { get; set; } = string.Empty;
    public string TaxNumber { get; set; } = string.Empty;
    public string Hotline { get; set; } = string.Empty;
    public string? LogoUrl { get; set; }
    public string BankName { get; set; } = string.Empty;
    public string BankAccountNumber { get; set; } = string.Empty;
    public string BankAccountHolder { get; set; } = string.Empty;
    public string FooterNote { get; set; } = string.Empty;
    public string CheckInPolicyText { get; set; } = string.Empty;
    public bool ShowVietQrCode { get; set; }
    public string DefaultPaperSize { get; set; } = "A4";
}
