using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Reservations.DTOs;
using HotelSaas.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Payments.Queries.GenerateVietQr;

public sealed class GenerateVietQrQueryHandler : IRequestHandler<GenerateVietQrQuery, VietQrResult>
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
    private readonly IVietQrService _vietQrService;

    public GenerateVietQrQueryHandler(IApplicationDbContext context, IVietQrService vietQrService)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _vietQrService = vietQrService ?? throw new ArgumentNullException(nameof(vietQrService));
    }

    public async Task<VietQrResult> Handle(GenerateVietQrQuery request, CancellationToken cancellationToken)
    {
        if (request.Amount <= 0)
        {
            throw new BadRequestException("ERR_INVALID_AMOUNT", "Số tiền chuyển khoản không hợp lệ.");
        }

        Reservation? reservation = null;
        Guid targetTenantId = Guid.Empty;
        Guid? targetPropertyId = null;

        if (request.ReservationId.HasValue && request.ReservationId.Value != Guid.Empty)
        {
            reservation = await _context.Reservations
                .IgnoreQueryFilters()
                .AsNoTracking()
                .FirstOrDefaultAsync(r => r.Id == request.ReservationId.Value, cancellationToken);

            if (reservation == null)
            {
                throw new NotFoundException("Không tìm thấy hồ sơ đặt phòng.");
            }

            targetTenantId = reservation.TenantId;
            targetPropertyId = reservation.PropertyId;
        }
        else if (!string.IsNullOrWhiteSpace(request.ConfirmationCode))
        {
            var codeOrToken = request.ConfirmationCode.Trim();
            var candidates = await _context.Reservations
                .IgnoreQueryFilters()
                .AsNoTracking()
                .Where(r =>
                    (r.ConfirmationCode != null && r.ConfirmationCode.ToUpper() == codeOrToken.ToUpper()) ||
                    (r.Notes != null && r.Notes.Contains(codeOrToken)))
                .Take(10)
                .ToListAsync(cancellationToken);

            reservation = candidates.FirstOrDefault(r =>
            {
                if (string.Equals(r.ConfirmationCode, codeOrToken, StringComparison.OrdinalIgnoreCase))
                    return true;
                var snap = ReservationSnapshotHelper.TryDeserialize(r.Notes);
                return snap != null &&
                       !string.IsNullOrWhiteSpace(snap.LookupToken) &&
                       string.Equals(snap.LookupToken, codeOrToken, StringComparison.OrdinalIgnoreCase);
            });

            if (reservation != null)
            {
                targetTenantId = reservation.TenantId;
                targetPropertyId = reservation.PropertyId;
            }
        }

        if (targetTenantId == Guid.Empty && request.PropertyId.HasValue && request.PropertyId.Value != Guid.Empty)
        {
            var property = await _context.Properties
                .IgnoreQueryFilters()
                .AsNoTracking()
                .FirstOrDefaultAsync(p => p.Id == request.PropertyId.Value, cancellationToken);

            if (property != null)
            {
                targetTenantId = property.TenantId;
                targetPropertyId = property.Id;
            }
        }

        if (targetTenantId == Guid.Empty)
        {
            throw new UnprocessableEntityException(
                "ERR_BANK_ACCOUNT_NOT_CONFIGURED",
                "Không xác định được cơ sở lưu trú hoặc cơ sở chưa cấu hình tài khoản ngân hàng nhận chuyển khoản VietQR.");
        }

        var configs = await _context.PrintTemplateConfigs
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(c => c.TenantId == targetTenantId && (c.PropertyId == targetPropertyId || c.PropertyId == null))
            .ToListAsync(cancellationToken);

        var config = (targetPropertyId.HasValue
                ? configs.FirstOrDefault(c => c.PropertyId == targetPropertyId.Value)
                : null)
            ?? configs.FirstOrDefault(c => c.PropertyId == null);

        if (config == null ||
            string.IsNullOrWhiteSpace(config.BankName) ||
            string.IsNullOrWhiteSpace(config.BankAccountNumber))
        {
            throw new UnprocessableEntityException(
                "ERR_BANK_ACCOUNT_NOT_CONFIGURED",
                "Cơ sở lưu trú chưa cấu hình tài khoản ngân hàng nhận thanh toán VietQR. Vui lòng chọn phương thức thanh toán VNPay hoặc liên hệ lễ tân.");
        }

        var accountHolder = !string.IsNullOrWhiteSpace(config.BankAccountHolder)
            ? config.BankAccountHolder.Trim()
            : config.HeaderCompanyName?.Trim();

        if (string.IsNullOrWhiteSpace(accountHolder))
        {
            throw new UnprocessableEntityException(
                "ERR_BANK_ACCOUNT_NOT_CONFIGURED",
                "Cơ sở lưu trú chưa cấu hình tên chủ tài khoản ngân hàng nhận thanh toán VietQR.");
        }

        var bankBin = ResolveBankBin(config.BankName);
        var effectiveCode = !string.IsNullOrWhiteSpace(reservation?.ConfirmationCode)
            ? reservation!.ConfirmationCode
            : (!string.IsNullOrWhiteSpace(request.ConfirmationCode) ? request.ConfirmationCode.Trim() : "BOOKING");

        var payload = new VietQrPayload(
            BankBin: bankBin,
            AccountNumber: config.BankAccountNumber.Trim(),
            AccountName: accountHolder,
            Amount: request.Amount,
            Description: !string.IsNullOrWhiteSpace(request.Description) ? request.Description.Trim() : $"DATPHONG {effectiveCode}",
            ConfirmationCode: effectiveCode,
            ReservationId: reservation?.Id ?? request.ReservationId
        );

        return _vietQrService.GenerateDynamicQr(payload);
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
