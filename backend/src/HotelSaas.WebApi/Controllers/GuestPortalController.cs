using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Models;
using HotelSaas.Application.Guest.Commands.UpdateGuestProfile;
using HotelSaas.Application.Guest.DTOs;
using HotelSaas.Application.Guest.Queries.GetGuestBookingDetail;
using HotelSaas.Application.Guest.Queries.GetGuestBookings;
using HotelSaas.Application.Guest.Queries.GetGuestMe;
using HotelSaas.Application.Loyalty.Commands.EnrollPropertyMembership;
using HotelSaas.Application.Loyalty.Commands.UpdateGuestVatProfile;
using HotelSaas.Application.Loyalty.DTOs;
using HotelSaas.Application.Loyalty.Queries.GetGuestInvoicePrintView;
using HotelSaas.Application.Loyalty.Queries.GetMyGuestProfile;
using HotelSaas.Application.Loyalty.Queries.GetMyInvoices;
using HotelSaas.Application.Loyalty.Queries.GetMyPointTransactions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HotelSaas.WebApi.Controllers;

[Authorize]
[ApiController]
[Route("api/guest")]
[Produces("application/json")]
public class GuestPortalController : BaseApiController
{
    public sealed record EnrollMembershipRequest(Guid PropertyId);
    public sealed record UpdateVatProfileRequest(string? CompanyName, string? CompanyTaxCode, string? CompanyAddress);
    public sealed record UpdateGuestProfileRequest(string FullName);

    /// <summary>
    /// Lấy thông tin tài khoản cá nhân của khách đang đăng nhập (Contract Gate G3 / US3).
    /// </summary>
    [HttpGet("me")]
    [ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
    public async Task<ActionResult<ApiResponse<GuestMeDto>>> GetMe(CancellationToken cancellationToken)
    {
        var result = await Mediator.Send(new GetGuestMeQuery(), cancellationToken);
        return OkResponse(result);
    }

    /// <summary>
    /// Cập nhật họ tên của tài khoản khách đang đăng nhập (Contract Gate G3 / US3).
    /// </summary>
    [HttpPatch("me")]
    public async Task<ActionResult<ApiResponse<GuestMeDto>>> UpdateMe([FromBody] UpdateGuestProfileRequest request, CancellationToken cancellationToken)
    {
        var result = await Mediator.Send(new UpdateGuestProfileCommand(request.FullName), cancellationToken);
        return OkResponse(result, "Cập nhật hồ sơ tài khoản thành công.");
    }

    /// <summary>
    /// Lấy danh sách lịch sử đặt phòng của khách đang đăng nhập (Phân trang, bảo mật theo Subject).
    /// </summary>
    [HttpGet("bookings")]
    public async Task<ActionResult<ApiResponse<PagedResult<GuestBookingSummaryDto>>>> GetBookings(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        CancellationToken cancellationToken = default)
    {
        var result = await Mediator.Send(new GetGuestBookingsQuery(page, pageSize), cancellationToken);
        return OkResponse(result);
    }

    /// <summary>
    /// Lấy chi tiết đơn đặt phòng theo Id (chỉ cho phép truy cập nếu thuộc về khách đang đăng nhập).
    /// </summary>
    [HttpGet("bookings/{id:guid}")]
    public async Task<ActionResult<ApiResponse<GuestBookingDetailDto>>> GetBookingDetail(
        [FromRoute] Guid id,
        CancellationToken cancellationToken = default)
    {
        var result = await Mediator.Send(new GetGuestBookingDetailQuery(id), cancellationToken);
        return OkResponse(result);
    }

    /// <summary>
    /// Lấy thông tin hồ sơ khách hàng, số dư điểm thưởng và danh sách thẻ hội viên.
    /// </summary>
    [HttpGet("profile")]
    public async Task<ActionResult<ApiResponse<GuestProfileResponseDto>>> GetProfile(CancellationToken cancellationToken)
    {
        var result = await Mediator.Send(new GetMyGuestProfileQuery(), cancellationToken);
        return OkResponse(result);
    }

    /// <summary>
    /// Cập nhật thông tin công ty và mã số thuế phục vụ xuất hóa đơn VAT điện tử.
    /// </summary>
    [HttpPut("vat-profile")]
    public async Task<ActionResult<ApiResponse<bool>>> UpdateVatProfile([FromBody] UpdateVatProfileRequest request, CancellationToken cancellationToken)
    {
        var result = await Mediator.Send(new UpdateGuestVatProfileCommand(
            request.CompanyName,
            request.CompanyTaxCode,
            request.CompanyAddress
        ), cancellationToken);
        return OkResponse(result, "Cập nhật thông tin xuất hóa đơn VAT thành công.");
    }

    /// <summary>
    /// Lấy lịch sử biến động sổ cái điểm thưởng (Cộng điểm, Tiêu điểm, Hoàn điểm).
    /// </summary>
    [HttpGet("loyalty-ledger")]
    public async Task<ActionResult<ApiResponse<List<LoyaltyPointLedgerItemDto>>>> GetLoyaltyLedger([FromQuery] string? filterType, CancellationToken cancellationToken)
    {
        var result = await Mediator.Send(new GetMyPointTransactionsQuery(filterType), cancellationToken);
        return OkResponse(result);
    }

    /// <summary>
    /// Đăng ký thành viên cơ sở/chuỗi mới 1 chạm để nhận ưu đãi và điểm thưởng chào mừng.
    /// </summary>
    [HttpPost("memberships/enroll")]
    public async Task<ActionResult<ApiResponse<GuestLoyaltyMembershipDto>>> EnrollMembership([FromBody] EnrollMembershipRequest request, CancellationToken cancellationToken)
    {
        var result = await Mediator.Send(new EnrollPropertyMembershipCommand(request.PropertyId), cancellationToken);
        return OkResponse(result, "Đăng ký thành viên thành công! Bạn nhận được 50 điểm chào mừng.");
    }

    /// <summary>
    /// Lấy danh sách các đơn đặt phòng và hóa đơn (Folio) của khách hàng.
    /// </summary>
    [HttpGet("invoices")]
    public async Task<ActionResult<ApiResponse<List<GuestInvoiceRecordDto>>>> GetInvoices(CancellationToken cancellationToken)
    {
        var result = await Mediator.Send(new GetMyInvoicesQuery(), cancellationToken);
        return OkResponse(result);
    }

    /// <summary>
    /// Lấy chi tiết hóa đơn (Folio) phục vụ in ấn chuẩn A4/K80 hoặc xuất PDF/CSV.
    /// </summary>
    [HttpGet("invoices/{invoiceOrReservationId:guid}/print")]
    public async Task<ActionResult<ApiResponse<GuestInvoiceRecordDto>>> GetInvoicePrintView([FromRoute] Guid invoiceOrReservationId, CancellationToken cancellationToken)
    {
        var result = await Mediator.Send(new GetGuestInvoicePrintViewQuery(invoiceOrReservationId), cancellationToken);
        return OkResponse(result);
    }
}
