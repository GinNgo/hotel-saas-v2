using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Print.Common;
using HotelSaas.Application.Print.DTOs;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Print.Queries.GetPrintTemplateConfig;

public sealed class GetPrintTemplateConfigQueryHandler : IRequestHandler<GetPrintTemplateConfigQuery, PrintTemplateSettingsDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserContext _currentUser;

    public GetPrintTemplateConfigQueryHandler(IApplicationDbContext context, ICurrentUserContext currentUser)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _currentUser = currentUser ?? throw new ArgumentNullException(nameof(currentUser));
    }

    public async Task<PrintTemplateSettingsDto> Handle(GetPrintTemplateConfigQuery request, CancellationToken cancellationToken)
    {
        Guid effectiveTenantId;
        if (_currentUser.GlobalRole == GlobalUserRole.SuperAdmin)
        {
            effectiveTenantId = request.TenantId ?? _currentUser.TenantId ?? Guid.Empty;
        }
        else
        {
            if (request.TenantId.HasValue && request.TenantId.Value != Guid.Empty &&
                (!_currentUser.TenantId.HasValue || request.TenantId.Value != _currentUser.TenantId.Value))
            {
                throw new ForbiddenException("ERR_FORBIDDEN", "Không có quyền truy cập cấu hình in của doanh nghiệp khác.");
            }
            effectiveTenantId = _currentUser.TenantId ?? Guid.Empty;
        }

        if (effectiveTenantId == Guid.Empty)
        {
            throw new ForbiddenException("ERR_FORBIDDEN", "Yêu cầu ngữ cảnh doanh nghiệp hợp lệ.");
        }

        if (request.PropertyId.HasValue && request.PropertyId.Value != Guid.Empty &&
            _currentUser.GlobalRole != GlobalUserRole.SuperAdmin &&
            !_currentUser.IsTenantWide &&
            _currentUser.PropertyId.HasValue &&
            request.PropertyId.Value != _currentUser.PropertyId.Value)
        {
            throw new ForbiddenException("ERR_PROPERTY_FORBIDDEN", "Nhân viên chi nhánh không có quyền truy cập cấu hình in của chi nhánh khác.");
        }

        var targetPropertyId = request.PropertyId.HasValue && request.PropertyId.Value != Guid.Empty
            ? request.PropertyId
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
            return new PrintTemplateSettingsDto
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
                DefaultPaperSize = "A4",
                SepayApiKey = string.Empty,
                HasSepayApiKey = false
            };
        }

        return PrintHelper.MapTemplateConfigDto(config);
    }
}
