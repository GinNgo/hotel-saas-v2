using System;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Models;
using HotelSaas.Application.Reports.DTOs;
using HotelSaas.Application.Reports.Queries.ExportReportCsv;
using HotelSaas.Application.Reports.Queries.ExportReportExcel;
using HotelSaas.Application.Reports.Queries.ExportReportPdf;
using HotelSaas.Application.Reports.Queries.ExportReservationInvoicePdf;
using HotelSaas.Application.Reports.Queries.GetGroupAnalytics;
using HotelSaas.Application.Reports.Queries.GetPmsKpi;
using HotelSaas.Application.Reports.Queries.GetReportRoomTypes;
using HotelSaas.Application.Reports.Queries.GetRevenueSummary;
using HotelSaas.WebApi.Authorization;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace HotelSaas.WebApi.Controllers;

/// <summary>
/// Provides PMS financial reporting, hospitality performance KPIs (ADR, RevPAR, Occupancy),
/// multi-property group analytics, and accounting exports for hotel managers and enterprise accountants.
/// </summary>
[ApiController]
[Route("api/reports")]
[Produces("application/json")]
[Authorize]
[RequirePermission("REPORTS", 1)]
public sealed class ReportsController : ControllerBase
{
    private readonly ISender _mediator;

    public ReportsController(ISender mediator)
    {
        _mediator = mediator ?? throw new ArgumentNullException(nameof(mediator));
    }

    /// <summary>
    /// Retrieves consolidated multi-property portfolio KPIs, cross-branch comparison matrix, daily trends, and distribution channels.
    /// </summary>
    [HttpGet("group-analytics")]
    [ProducesResponseType(typeof(ApiResponse<GroupAnalyticsDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> GetGroupAnalytics(
        [FromQuery] DateOnly? fromDate,
        [FromQuery] DateOnly? toDate,
        CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(new GetGroupAnalyticsQuery(fromDate, toDate), cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Retrieves financial revenue summary, payment method breakdown, and daily revenue timeline.
    /// </summary>
    [HttpGet("revenue-summary")]
    [ProducesResponseType(typeof(RevenueSummaryDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> GetRevenueSummary(
        [FromQuery] DateOnly? fromDate,
        [FromQuery] DateOnly? toDate,
        [FromQuery] Guid? propertyId,
        [FromQuery] Guid? roomTypeId,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await _mediator.Send(
                new GetRevenueSummaryQuery(fromDate, toDate, propertyId, roomTypeId),
                cancellationToken);
            return Ok(result);
        }
        catch (BadRequestException ex)
        {
            return BadRequest(new { code = ex.ErrorCode, message = ex.Message });
        }
    }

    /// <summary>
    /// Computes international PMS performance indicators: Occupancy Rate, ADR, RevPAR, and operational ratios.
    /// </summary>
    [HttpGet("pms-kpi")]
    [ProducesResponseType(typeof(PmsKpiDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> GetPmsKpi(
        [FromQuery] DateOnly? fromDate,
        [FromQuery] DateOnly? toDate,
        [FromQuery] Guid? propertyId,
        [FromQuery] Guid? roomTypeId,
        CancellationToken cancellationToken)
    {
        try
        {
            var kpi = await _mediator.Send(
                new GetPmsKpiQuery(fromDate, toDate, propertyId, roomTypeId),
                cancellationToken);
            return Ok(kpi);
        }
        catch (BadRequestException ex)
        {
            return BadRequest(new { code = ex.ErrorCode, message = ex.Message });
        }
    }

    [HttpGet("room-types")]
    public async Task<IActionResult> GetReportRoomTypes(
        CancellationToken cancellationToken,
        [FromQuery] Guid? propertyId = null)
    {
        try
        {
            var types = await _mediator.Send(new GetReportRoomTypesQuery(propertyId), cancellationToken);
            return Ok(types);
        }
        catch (BadRequestException ex)
        {
            return BadRequest(new { code = ex.ErrorCode, message = ex.Message });
        }
    }

    /// <summary>
    /// Exports reservation and financial ledger data to Excel-friendly CSV with UTF-8 BOM encoding.
    /// </summary>
    [HttpGet("export-csv")]
    [Produces("text/csv")]
    [ProducesResponseType(typeof(FileContentResult), StatusCodes.Status200OK)]
    public async Task<IActionResult> ExportCsv(
        [FromQuery] DateOnly? fromDate,
        [FromQuery] DateOnly? toDate,
        [FromQuery] Guid? propertyId,
        CancellationToken cancellationToken)
    {
        try
        {
            var file = await _mediator.Send(new ExportReportCsvQuery(fromDate, toDate, propertyId), cancellationToken);
            return File(file.Content, file.ContentType, file.FileName);
        }
        catch (BadRequestException ex)
        {
            return BadRequest(new { code = ex.ErrorCode, message = ex.Message });
        }
    }

    [HttpGet("export-excel")]
    [Produces("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")]
    public async Task<IActionResult> ExportExcel(
        [FromQuery] DateOnly? fromDate,
        [FromQuery] DateOnly? toDate,
        [FromQuery] Guid? propertyId,
        CancellationToken cancellationToken)
    {
        try
        {
            var file = await _mediator.Send(new ExportReportExcelQuery(fromDate, toDate, propertyId), cancellationToken);
            return File(file.Content, file.ContentType, file.FileName);
        }
        catch (BadRequestException ex)
        {
            return BadRequest(new { code = ex.ErrorCode, message = ex.Message });
        }
    }

    [HttpGet("export-pdf")]
    [Produces("application/pdf")]
    public async Task<IActionResult> ExportPdf(
        [FromQuery] DateOnly? fromDate,
        [FromQuery] DateOnly? toDate,
        [FromQuery] Guid? propertyId,
        CancellationToken cancellationToken)
    {
        try
        {
            var file = await _mediator.Send(new ExportReportPdfQuery(fromDate, toDate, propertyId), cancellationToken);
            return File(file.Content, file.ContentType, file.FileName);
        }
        catch (BadRequestException ex)
        {
            return BadRequest(new { code = ex.ErrorCode, message = ex.Message });
        }
    }

    [HttpGet("reservations/{reservationId:guid}/invoice.pdf")]
    [Produces("application/pdf")]
    public async Task<IActionResult> ExportInvoicePdf(Guid reservationId, CancellationToken cancellationToken)
    {
        try
        {
            var file = await _mediator.Send(new ExportReservationInvoicePdfQuery(reservationId), cancellationToken);
            return file is null
                ? NotFound(new { code = "ERR_INVOICE_NOT_FOUND", message = "Không tìm thấy hóa đơn của đơn đặt phòng." })
                : File(file.Content, file.ContentType, file.FileName);
        }
        catch (BadRequestException ex)
        {
            return BadRequest(new { code = ex.ErrorCode, message = ex.Message });
        }
    }
}
