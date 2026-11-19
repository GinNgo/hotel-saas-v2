using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Print.Common;
using HotelSaas.Application.Print.DTOs;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Print.Commands.SavePrintTemplateConfig;

public sealed class SavePrintTemplateConfigCommandHandler : IRequestHandler<SavePrintTemplateConfigCommand, PrintTemplateSettingsDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserContext _currentUser;

    public SavePrintTemplateConfigCommandHandler(IApplicationDbContext context, ICurrentUserContext currentUser)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _currentUser = currentUser ?? throw new ArgumentNullException(nameof(currentUser));
    }

    public async Task<PrintTemplateSettingsDto> Handle(SavePrintTemplateConfigCommand request, CancellationToken cancellationToken)
    {
        if (_currentUser.GlobalRole != GlobalUserRole.SuperAdmin &&
            request.TenantId != Guid.Empty &&
            (!_currentUser.TenantId.HasValue || request.TenantId != _currentUser.TenantId.Value))
        {
            throw new ForbiddenException("ERR_FORBIDDEN", "Không có quyền cập nhật cấu hình in của doanh nghiệp khác.");
        }

        if (_currentUser.GlobalRole == GlobalUserRole.SuperAdmin &&
            _currentUser.TenantId.HasValue &&
            request.TenantId != Guid.Empty &&
            request.TenantId != _currentUser.TenantId.Value)
        {
            throw new ForbiddenException("ERR_FORBIDDEN", "Không có quyền cập nhật cấu hình in của doanh nghiệp khác.");
        }

        // Fail-Closed: Strictly resolve tenantId from authenticated user context, never blind client payload
        var tenantId = _currentUser.TenantId ??
            (_currentUser.GlobalRole == GlobalUserRole.SuperAdmin && request.TenantId != Guid.Empty
                ? request.TenantId
                : Guid.Empty);

        if (tenantId == Guid.Empty)
        {
            throw new BadRequestException("ERR_TENANT_REQUIRED", "Yêu cầu TenantId hợp lệ từ phiên đăng nhập.");
        }

        if (_currentUser.GlobalRole == GlobalUserRole.SuperAdmin && !_currentUser.TenantId.HasValue)
        {
            var nowUtc = DateTime.UtcNow;
            var hasDiagnosticGrant = _currentUser.IsAuthenticated && _currentUser.UserId != Guid.Empty &&
                (await _context.SupportAccessGrants
                    .IgnoreQueryFilters()
                    .AsNoTracking()
                    .Where(g =>
                        g.TargetSupportUserId == _currentUser.UserId &&
                        g.TenantId == tenantId &&
                        g.RevokedAtUtc == null &&
                        g.ExpiresAtUtc > nowUtc)
                    .ToListAsync(cancellationToken))
                .Any(g => string.Equals(g.Scope, "DIAGNOSTIC", StringComparison.OrdinalIgnoreCase));

            if (!hasDiagnosticGrant)
            {
                throw new ForbiddenException(
                    "ERR_SUPPORT_GRANT_REQUIRED",
                    "SuperAdmin cần SupportAccessGrant hợp lệ (DIAGNOSTIC) để cập nhật cấu hình in của Tenant.");
            }
        }

        var targetPropertyId = request.QueryPropertyId.HasValue && request.QueryPropertyId.Value != Guid.Empty
            ? request.QueryPropertyId
            : (request.BodyPropertyId.HasValue && request.BodyPropertyId.Value != Guid.Empty ? request.BodyPropertyId : null);

        if (targetPropertyId.HasValue &&
            _currentUser.GlobalRole != GlobalUserRole.SuperAdmin &&
            !_currentUser.IsTenantWide &&
            _currentUser.PropertyId.HasValue &&
            targetPropertyId.Value != _currentUser.PropertyId.Value)
        {
            throw new ForbiddenException("ERR_PROPERTY_FORBIDDEN", "Nhân viên chi nhánh không có quyền cập nhật cấu hình in của chi nhánh khác.");
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

        config.HeaderCompanyName = (request.HeaderCompanyName ?? string.Empty).Trim();
        config.HeaderAddress = (request.HeaderAddress ?? string.Empty).Trim();
        config.TaxNumber = (request.TaxNumber ?? string.Empty).Trim();
        config.Hotline = (request.Hotline ?? string.Empty).Trim();
        config.LogoUrl = request.LogoUrl?.Trim();
        config.BankName = (request.BankName ?? string.Empty).Trim();
        config.BankAccountNumber = (request.BankAccountNumber ?? string.Empty).Trim();
        config.BankAccountHolder = (request.BankAccountHolder ?? string.Empty).Trim().ToUpperInvariant();
        config.FooterNote = (request.FooterNote ?? string.Empty).Trim();
        config.CheckInPolicyText = (request.CheckInPolicyText ?? string.Empty).Trim();
        config.ShowVietQrCode = request.ShowVietQrCode;
        config.DefaultPaperSize = string.IsNullOrWhiteSpace(request.DefaultPaperSize) ? "A4" : request.DefaultPaperSize.Trim();
        config.UpdatedAtUtc = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);

        return PrintHelper.MapTemplateConfigDto(config);
    }
}
