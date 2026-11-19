using System;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Reports.Common;
using HotelSaas.Application.Reports.DTOs;
using MediatR;

namespace HotelSaas.Application.Reports.Queries.ExportReservationInvoicePdf;

public sealed class ExportReservationInvoicePdfQueryHandler : IRequestHandler<ExportReservationInvoicePdfQuery, ExportedReportFileDto?>
{
    private readonly ICurrentUserContext _currentUser;
    private readonly IReportExportService _reportExportService;

    public ExportReservationInvoicePdfQueryHandler(ICurrentUserContext currentUser, IReportExportService reportExportService)
    {
        _currentUser = currentUser ?? throw new ArgumentNullException(nameof(currentUser));
        _reportExportService = reportExportService ?? throw new ArgumentNullException(nameof(reportExportService));
    }

    public async Task<ExportedReportFileDto?> Handle(ExportReservationInvoicePdfQuery request, CancellationToken cancellationToken)
    {
        ReportScopeHelper.EnsureTenantId(_currentUser);

        if (!_currentUser.IsTenantWide && (!_currentUser.PropertyId.HasValue || _currentUser.PropertyId.Value == Guid.Empty))
        {
            throw new ForbiddenException(
                "ERR_PROPERTY_REQUIRED",
                "Yêu cầu ngữ cảnh chi nhánh hợp lệ để xuất hóa đơn.");
        }

        var bytes = await _reportExportService.ExportInvoicePdfAsync(request.ReservationId, cancellationToken);
        if (bytes is null)
        {
            return null;
        }

        return new ExportedReportFileDto(
            bytes,
            "application/pdf",
            $"HoaDon_{request.ReservationId:N}.pdf");
    }
}
