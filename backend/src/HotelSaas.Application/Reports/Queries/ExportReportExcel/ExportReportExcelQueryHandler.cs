using System;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Reports.Common;
using HotelSaas.Application.Reports.DTOs;
using MediatR;

namespace HotelSaas.Application.Reports.Queries.ExportReportExcel;

public sealed class ExportReportExcelQueryHandler : IRequestHandler<ExportReportExcelQuery, ExportedReportFileDto>
{
    private readonly ICurrentUserContext _currentUser;
    private readonly IReportExportService _reportExportService;

    public ExportReportExcelQueryHandler(ICurrentUserContext currentUser, IReportExportService reportExportService)
    {
        _currentUser = currentUser ?? throw new ArgumentNullException(nameof(currentUser));
        _reportExportService = reportExportService ?? throw new ArgumentNullException(nameof(reportExportService));
    }

    public async Task<ExportedReportFileDto> Handle(ExportReportExcelQuery request, CancellationToken cancellationToken)
    {
        ReportScopeHelper.EnsureTenantId(_currentUser);
        var effectivePropertyId = ReportScopeHelper.ResolveScopedPropertyId(_currentUser, request.PropertyId);

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var effectiveFrom = request.FromDate ?? today.AddDays(-30);
        var effectiveTo = request.ToDate ?? today;

        if (effectiveFrom > effectiveTo)
        {
            throw new BadRequestException("ERR_INVALID_DATE_RANGE", "Ngày bắt đầu không được lớn hơn ngày kết thúc.");
        }

        var bytes = await _reportExportService.ExportReservationsExcelAsync(
            effectiveFrom, effectiveTo, effectivePropertyId, cancellationToken);

        return new ExportedReportFileDto(
            bytes,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            $"BaoCao_DoanhThu_{effectiveFrom:yyyyMMdd}_{effectiveTo:yyyyMMdd}.xlsx");
    }
}
