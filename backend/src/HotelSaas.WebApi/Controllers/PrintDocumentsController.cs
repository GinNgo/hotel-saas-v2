using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
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
    public async Task<IActionResult> GetPrintableInvoice(Guid reservationId, CancellationToken cancellationToken)
    {
        var reservation = await _context.Reservations
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

        var printConfig = await _context.PrintTemplateConfigs
            .IgnoreQueryFilters()
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.TenantId == reservation.TenantId && (c.PropertyId == null || c.PropertyId == reservation.PropertyId), cancellationToken);

        // Lấy hóa đơn chính thức nếu đã tạo
        var invoice = await _context.Invoices
            .AsNoTracking()
            .Include(i => i.InvoiceItems)
            .FirstOrDefaultAsync(i => i.ReservationId == reservationId, cancellationToken);

        var propertyName = reservation.Property?.Name ?? reservation.Tenant?.Name ?? "Khách Sạn & Khu Nghỉ Dưỡng";
        var headerCompany = printConfig?.HeaderCompanyName ?? propertyName;
        var address = printConfig?.HeaderAddress ?? reservation.Property?.Address ?? "Việt Nam";
        var taxCode = printConfig?.TaxNumber ?? "0109988776";
        var hotline = printConfig?.Hotline ?? reservation.Property?.PhoneNumber ?? "1900-6868";
        var logoUrl = printConfig?.LogoUrl ?? "/images/saigon-riverside-tower.png";

        var totalAmount = reservation.TotalAmount;
        var vatAmount = invoice?.TaxAmount ?? Math.Round(totalAmount * 0.08m, 0); // 8% VAT
        var subTotal = totalAmount - vatAmount;
        var paidAmount = reservation.Payments.Where(p => p.Status == PaymentStatus.Completed).Sum(p => p.Amount);
        var remainingAmount = Math.Max(0, totalAmount - paidAmount);

        // Tạo mã VietQR URL tiêu chuẩn: https://img.vietqr.io/image/<BANK>-<ACC>-compact2.png?amount=<AMT>&addInfo=<INFO>
        var bankName = printConfig?.BankName ?? "MBBank";
        var bankAcc = !string.IsNullOrWhiteSpace(printConfig?.BankAccountNumber) ? printConfig.BankAccountNumber : "0988889999";
        var vietQrUrl = $"https://img.vietqr.io/image/{bankName}-{bankAcc}-compact2.png?amount={remainingAmount:0}&addInfo={Uri.EscapeDataString($"THANHTOAN {reservation.ConfirmationCode}")}";

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
            var roomTypeName = reservation.Room?.RoomType?.Name ?? "Phòng Tiêu Chuẩn";
            var roomNumber = reservation.Room?.RoomNumber ?? "Chưa chỉ định";
            var nightsOrHours = Math.Max(1, (reservation.CheckOutDate.ToDateTime(TimeOnly.MinValue) - reservation.CheckInDate.ToDateTime(TimeOnly.MinValue)).Days);

            lineItems.Add(new InvoiceLineItemDto
            {
                Description = $"Tiền phòng: {roomTypeName} (Phòng {roomNumber}) - {nightsOrHours} đêm",
                Quantity = nightsOrHours,
                UnitPrice = Math.Round(subTotal / nightsOrHours, 0),
                Amount = subTotal
            });
        }

        var result = new PrintableInvoiceDto
        {
            InvoiceNumber = invoice?.InvoiceNumber ?? $"HD-{DateTime.UtcNow:yyyyMMdd}-{reservation.ConfirmationCode}",
            ConfirmationCode = reservation.ConfirmationCode,
            IssuedDate = invoice?.IssuedAtUtc ?? DateTime.UtcNow,
            HeaderCompanyName = headerCompany,
            HeaderAddress = address,
            TaxNumber = taxCode,
            Hotline = hotline,
            LogoUrl = logoUrl,
            GuestName = reservation.GuestName,
            GuestEmail = reservation.GuestEmail,
            GuestPhone = reservation.GuestPhone ?? "",
            RoomNumber = reservation.Room?.RoomNumber ?? "",
            RoomTypeName = reservation.Room?.RoomType?.Name ?? "",
            CheckInDate = reservation.CheckInDate,
            CheckOutDate = reservation.CheckOutDate,
            NumberOfGuests = reservation.NumberOfGuests,
            SubTotal = subTotal,
            VatAmount = vatAmount,
            TotalAmount = totalAmount,
            PaidAmount = paidAmount,
            RemainingAmount = remainingAmount,
            Status = remainingAmount == 0 ? "ĐÃ THANH TOÁN ĐỦ" : "CÒN CÔNG NỢ",
            PaymentMethod = reservation.Payments.LastOrDefault()?.Method.ToString() ?? "Chuyển khoản / Tiền mặt",
            VietQrImageUrl = vietQrUrl,
            BankAccountNumber = bankAcc,
            BankAccountHolder = printConfig?.BankAccountHolder ?? "KHACH SAN BIEN DONG",
            BankName = bankName,
            FooterNote = printConfig?.FooterNote ?? "Cảm ơn Quý khách đã tin tưởng và sử dụng dịch vụ của chúng tôi! Hẹn gặp lại Quý khách.",
            Items = lineItems
        };

        return Ok(result);
    }

    /// <summary>
    /// Lấy dữ liệu in Phiếu xác nhận đặt phòng / Thẻ làm thủ tục (Booking Voucher) theo ConfirmationCode.
    /// </summary>
    [HttpGet("voucher/{confirmationCode}")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(PrintableVoucherDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetPrintableVoucher(string confirmationCode, CancellationToken cancellationToken)
    {
        var reservation = await _context.Reservations
            .AsNoTracking()
            .Include(r => r.Property)
            .Include(r => r.Tenant)
            .Include(r => r.Room)
            .ThenInclude(rm => rm!.RoomType)
            .FirstOrDefaultAsync(r => r.ConfirmationCode.ToUpper() == confirmationCode.ToUpper(), cancellationToken);

        if (reservation == null)
        {
            return NotFound(new { code = "ERR_VOUCHER_NOT_FOUND", message = "Không tìm thấy mã đặt phòng." });
        }

        var printConfig = await _context.PrintTemplateConfigs
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.TenantId == reservation.TenantId, cancellationToken);

        var property = reservation.Property;
        var roomType = reservation.Room?.RoomType;

        var result = new PrintableVoucherDto
        {
            ConfirmationCode = reservation.ConfirmationCode,
            CreatedAtUtc = reservation.CreatedAtUtc,
            PropertyName = property?.Name ?? reservation.Tenant?.Name ?? "Khách Sạn Đối Tác",
            PropertyAddress = property?.Address ?? "Việt Nam",
            PropertyPhone = property?.PhoneNumber ?? "1900-6868",
            PropertyEmail = property?.Email ?? "support@hotelsaas.vn",
            GuestName = reservation.GuestName,
            GuestEmail = reservation.GuestEmail,
            GuestPhone = reservation.GuestPhone ?? "",
            RoomTypeName = roomType?.Name ?? "Phòng Tiêu Chuẩn",
            RoomNumber = reservation.Room?.RoomNumber ?? "Lễ tân sắp xếp khi check-in",
            CheckInDate = reservation.CheckInDate,
            CheckInTime = property != null ? property.CheckInTime.ToString("HH:mm") : "14:00",
            CheckOutDate = reservation.CheckOutDate,
            CheckOutTime = property != null ? property.CheckOutTime.ToString("HH:mm") : "12:00",
            NumberOfGuests = reservation.NumberOfGuests,
            TotalAmount = reservation.TotalAmount,
            Status = reservation.Status.ToString(),
            BedType = roomType?.BedType ?? "1 Giường King",
            SquareMeters = roomType?.SquareMeters ?? 28,
            PolicyNote = printConfig?.CheckInPolicyText ?? "Nhận phòng từ 14:00 - Trả phòng trước 12:00. Vui lòng xuất trình CCCD/Hộ chiếu gốc tại quầy lễ tân.",
            QrCodeData = $"HOTEL-CHECKIN:{reservation.ConfirmationCode}:{reservation.GuestName}"
        };

        return Ok(result);
    }

    /// <summary>
    /// Lấy dữ liệu in Hợp đồng Cung cấp Dịch vụ Phần mềm SaaS chính thức theo ContractId.
    /// </summary>
    [HttpGet("contract/{contractId:guid}")]
    [ProducesResponseType(typeof(PrintableContractDocumentDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetPrintableContract(Guid contractId, CancellationToken cancellationToken)
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

        var propertiesCount = await _context.Properties
            .IgnoreQueryFilters()
            .AsNoTracking()
            .CountAsync(p => p.TenantId == contract.TenantId, cancellationToken);

        var roomsCount = await _context.Rooms
            .IgnoreQueryFilters()
            .AsNoTracking()
            .CountAsync(r => r.TenantId == contract.TenantId, cancellationToken);

        var result = new PrintableContractDocumentDto
        {
            ContractNumber = contract.ContractNumber,
            SignedDate = contract.SignedAtUtc ?? contract.CreatedAtUtc,
            StartDate = contract.StartDate,
            EndDate = contract.EndDate,
            // Bên A: Nền tảng Hotel SaaS
            PlatformCompanyName = "CÔNG TY CỔ PHẦN CÔNG NGHỆ NỀN TẢNG KHÁCH SẠN HOTEL SAAS VIỆT NAM",
            PlatformAddress = "Tầng 18, Tòa nhà Innovation Hub, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh",
            PlatformTaxCode = "0318889999",
            PlatformHotline = "1900 8899",
            PlatformRepresentative = "Ngô Võ Tuấn Anh (Tổng Giám Đốc)",
            // Bên B: Khách sạn / Doanh nghiệp Đối tác
            TenantCompanyName = contract.Tenant?.Name ?? "Doanh Nghiệp Đối Tác",
            TenantCode = contract.Tenant?.Code ?? "TENANT",
            TenantRepresentative = contract.RepresentativeName,
            TenantEmail = contract.RepresentativeEmail,
            TenantPhone = contract.RepresentativePhone,
            TenantAddress = "Địa chỉ trụ sở chính theo Giấy chứng nhận đăng ký doanh nghiệp",
            // Chi tiết dịch vụ
            PlanCode = contract.PlanCode,
            PlanName = contract.PlanName,
            ContractType = contract.ContractType,
            BillingCycle = contract.BillingCycle.ToString(),
            ContractValue = contract.ContractValue,
            MaxPropertiesAllowed = propertiesCount > 0 ? propertiesCount : 3,
            MaxRoomsAllowed = roomsCount > 0 ? roomsCount : 50,
            DigitalSignatureHash = contract.DigitalSignatureHash ?? "DIGITAL_SIG_VERIFIED_SHA256",
            TermsAndConditions = contract.TermsAndConditions ?? "Toàn bộ điều khoản cam kết mức độ dịch vụ (SLA 99.9%) và chính sách bảo mật dữ liệu khách sạn."
        };

        return Ok(result);
    }

    /// <summary>
    /// Lấy cấu hình in ấn hiện tại của khách sạn.
    /// </summary>
    [HttpGet("template-config")]
    public async Task<IActionResult> GetTemplateConfig([FromQuery] Guid? tenantId, CancellationToken cancellationToken)
    {
        var effectiveTenantId = tenantId ?? _currentUser.TenantId;
        PrintTemplateConfig? config = null;

        if (effectiveTenantId.HasValue && effectiveTenantId.Value != Guid.Empty)
        {
            config = await _context.PrintTemplateConfigs
                .IgnoreQueryFilters()
                .AsNoTracking()
                .FirstOrDefaultAsync(c => c.TenantId == effectiveTenantId.Value, cancellationToken);
        }
        else
        {
            config = await _context.PrintTemplateConfigs
                .IgnoreQueryFilters()
                .AsNoTracking()
                .FirstOrDefaultAsync(cancellationToken);
        }

        if (config == null)
        {
            return Ok(new PrintTemplateConfigDto
            {
                TenantId = effectiveTenantId ?? Guid.Empty,
                HeaderCompanyName = "Khách Sạn & Nghỉ Dưỡng Mẫu",
                HeaderAddress = "Số 123 Đường Biển Đông, TP. Đà Nẵng",
                TaxNumber = "0401999888",
                Hotline = "1900 6868",
                BankName = "MBBank",
                BankAccountNumber = "0988889999",
                BankAccountHolder = "KHACH SAN BIEN DONG",
                FooterNote = "Cảm ơn Quý khách đã tin tưởng và sử dụng dịch vụ của chúng tôi!",
                CheckInPolicyText = "Nhận phòng: 14:00 - Trả phòng: 12:00. Vui lòng xuất trình CCCD gốc.",
                ShowVietQrCode = true,
                DefaultPaperSize = "A4"
            });
        }

        return Ok(new PrintTemplateConfigDto
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
        });
    }

    /// <summary>
    /// Cập nhật cấu hình in ấn của cơ sở / khách sạn.
    /// </summary>
    [HttpPut("template-config")]
    public async Task<IActionResult> SaveTemplateConfig([FromBody] PrintTemplateConfigDto request, CancellationToken cancellationToken)
    {
        var tenantId = request.TenantId != Guid.Empty ? request.TenantId : (_currentUser.TenantId ?? Guid.Empty);
        if (tenantId == Guid.Empty)
        {
            return BadRequest(new { code = "ERR_TENANT_REQUIRED", message = "Yêu cầu TenantId hợp lệ." });
        }

        var config = await _context.PrintTemplateConfigs
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(c => c.TenantId == tenantId && (request.PropertyId == null || c.PropertyId == request.PropertyId), cancellationToken);

        if (config == null)
        {
            config = new PrintTemplateConfig
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                PropertyId = request.PropertyId,
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

        return Ok(config);
    }
}

public sealed class PrintableInvoiceDto
{
    public string InvoiceNumber { get; set; } = string.Empty;
    public string ConfirmationCode { get; set; } = string.Empty;
    public DateTime IssuedDate { get; set; }
    public string HeaderCompanyName { get; set; } = string.Empty;
    public string HeaderAddress { get; set; } = string.Empty;
    public string TaxNumber { get; set; } = string.Empty;
    public string Hotline { get; set; } = string.Empty;
    public string? LogoUrl { get; set; }
    public string GuestName { get; set; } = string.Empty;
    public string GuestEmail { get; set; } = string.Empty;
    public string GuestPhone { get; set; } = string.Empty;
    public string RoomNumber { get; set; } = string.Empty;
    public string RoomTypeName { get; set; } = string.Empty;
    public DateOnly CheckInDate { get; set; }
    public DateOnly CheckOutDate { get; set; }
    public int NumberOfGuests { get; set; }
    public decimal SubTotal { get; set; }
    public decimal VatAmount { get; set; }
    public decimal TotalAmount { get; set; }
    public decimal PaidAmount { get; set; }
    public decimal RemainingAmount { get; set; }
    public string Status { get; set; } = string.Empty;
    public string PaymentMethod { get; set; } = string.Empty;
    public string VietQrImageUrl { get; set; } = string.Empty;
    public string BankAccountNumber { get; set; } = string.Empty;
    public string BankAccountHolder { get; set; } = string.Empty;
    public string BankName { get; set; } = string.Empty;
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
    public string QrCodeData { get; set; } = string.Empty;
}

public sealed class PrintableContractDocumentDto
{
    public string ContractNumber { get; set; } = string.Empty;
    public DateTime SignedDate { get; set; }
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
    public string BankName { get; set; } = "MBBank";
    public string BankAccountNumber { get; set; } = string.Empty;
    public string BankAccountHolder { get; set; } = string.Empty;
    public string FooterNote { get; set; } = string.Empty;
    public string CheckInPolicyText { get; set; } = string.Empty;
    public bool ShowVietQrCode { get; set; } = true;
    public string DefaultPaperSize { get; set; } = "A4";
}
