using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Subscriptions.Queries.GetSubscriptionVietQr;

/// <summary>
/// Dynamic VietQR payment instruction payload for a pending tenant SaaS subscription upgrade.
/// </summary>
public sealed record SubscriptionVietQrDto(
    Guid PaymentId,
    string TransactionRef,
    string TransferContent,
    decimal Amount,
    string BankName,
    string BankBin,
    string BankAccountNumber,
    string BankAccountHolder,
    string QrImageUrl
);

/// <summary>
/// Generates a dynamic VietQR code for an authenticated tenant's pending subscription upgrade payment.
/// </summary>
public sealed record GetSubscriptionVietQrQuery(
    Guid PaymentId,
    string? PlatformBankName = null,
    string? PlatformAccountNumber = null,
    string? PlatformAccountHolder = null,
    bool IsDevelopment = false
) : IRequest<SubscriptionVietQrDto>;

public sealed class GetSubscriptionVietQrQueryHandler
    : IRequestHandler<GetSubscriptionVietQrQuery, SubscriptionVietQrDto>
{
    private const string DevDemoBankName = "MBBank";
    private const string DevDemoAccountNumber = "0999888777";
    private const string DevDemoAccountHolder = "HOTEL SAAS PLATFORM";

    private static readonly Regex NonAlnumRegex = new(@"[^a-zA-Z0-9]", RegexOptions.Compiled);

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
    private readonly ICurrentTenantService _tenantService;
    private readonly ICurrentUserContext _currentUser;
    private readonly IVietQrService _vietQrService;

    public GetSubscriptionVietQrQueryHandler(
        IApplicationDbContext context,
        ICurrentTenantService tenantService,
        ICurrentUserContext currentUser,
        IVietQrService vietQrService)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _tenantService = tenantService ?? throw new ArgumentNullException(nameof(tenantService));
        _currentUser = currentUser ?? throw new ArgumentNullException(nameof(currentUser));
        _vietQrService = vietQrService ?? throw new ArgumentNullException(nameof(vietQrService));
    }

    public async Task<SubscriptionVietQrDto> Handle(
        GetSubscriptionVietQrQuery request,
        CancellationToken cancellationToken)
    {
        var tenantId = _tenantService.TenantId ?? _currentUser.TenantId;
        if (!tenantId.HasValue || tenantId.Value == Guid.Empty)
        {
            throw new ForbiddenException("ERR_TENANT_REQUIRED", "Yêu cầu ngữ cảnh doanh nghiệp hợp lệ.");
        }

        var payment = await _context.SubscriptionPayments
            .IgnoreQueryFilters()
            .AsNoTracking()
            .FirstOrDefaultAsync(
                p => p.Id == request.PaymentId && p.TenantId == tenantId.Value,
                cancellationToken);

        if (payment == null)
        {
            throw new NotFoundException(nameof(SubscriptionPayment), request.PaymentId);
        }

        if (payment.Status != PaymentStatus.Pending)
        {
            throw new ConflictException(
                "ERR_PAYMENT_NOT_PENDING",
                "Giao dịch nâng cấp gói cước không còn ở trạng thái chờ thanh toán.");
        }

        var bankName = request.PlatformBankName?.Trim();
        var accountNumber = request.PlatformAccountNumber?.Trim();
        var accountHolder = request.PlatformAccountHolder?.Trim();

        if (string.IsNullOrWhiteSpace(bankName) || string.IsNullOrWhiteSpace(accountNumber))
        {
            if (request.IsDevelopment)
            {
                bankName = string.IsNullOrWhiteSpace(bankName) ? DevDemoBankName : bankName;
                accountNumber = string.IsNullOrWhiteSpace(accountNumber) ? DevDemoAccountNumber : accountNumber;
                accountHolder = string.IsNullOrWhiteSpace(accountHolder) ? DevDemoAccountHolder : accountHolder;
            }
            else
            {
                throw new UnprocessableEntityException(
                    "ERR_BANK_ACCOUNT_NOT_CONFIGURED",
                    "Nền tảng chưa cấu hình tài khoản ngân hàng nhận thanh toán gói cước VietQR.");
            }
        }

        if (string.IsNullOrWhiteSpace(accountHolder))
        {
            if (request.IsDevelopment)
            {
                accountHolder = DevDemoAccountHolder;
            }
            else
            {
                throw new UnprocessableEntityException(
                    "ERR_BANK_ACCOUNT_NOT_CONFIGURED",
                    "Nền tảng chưa cấu hình tên chủ tài khoản ngân hàng nhận thanh toán gói cước VietQR.");
            }
        }

        var bankBin = ResolveBankBin(bankName);
        var rawRef = !string.IsNullOrWhiteSpace(payment.TransactionRef)
            ? payment.TransactionRef.Trim()
            : $"SUB{payment.Id.ToString("N")[..10].ToUpperInvariant()}";

        var normalizedRef = NonAlnumRegex.Replace(rawRef.Split('|')[0], string.Empty).ToUpperInvariant();
        var transferContent = $"NANGCAP {normalizedRef}";

        var qr = _vietQrService.GenerateDynamicQr(new VietQrPayload(
            BankBin: bankBin,
            AccountNumber: accountNumber,
            AccountName: accountHolder,
            Amount: payment.Amount,
            Description: transferContent,
            ConfirmationCode: normalizedRef));

        return new SubscriptionVietQrDto(
            PaymentId: payment.Id,
            TransactionRef: payment.TransactionRef ?? normalizedRef,
            TransferContent: qr.Description,
            Amount: payment.Amount,
            BankName: qr.BankName,
            BankBin: qr.BankBin,
            BankAccountNumber: qr.AccountNumber,
            BankAccountHolder: qr.AccountName,
            QrImageUrl: qr.QrImageUrl);
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
}
