using HotelSaas.Application.Common.Models;
using HotelSaas.Application.Guests.Commands.UpdateGuestNotes;
using HotelSaas.Application.Guests.DTOs;
using HotelSaas.Application.Guests.Queries.GetGuestDirectory;
using HotelSaas.Application.Guests.Queries.GetGuestHistory;
using HotelSaas.WebApi.Authorization;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HotelSaas.WebApi.Controllers;

/// <summary>
/// Quản lý danh bạ khách hàng, lịch sử lưu trú và ghi chú chăm sóc khách (Guest CRM).
/// </summary>
[ApiController]
[Route("api/guests")]
[Produces("application/json")]
[Authorize]
public sealed class GuestsController : ControllerBase
{
    private readonly ISender _mediator;

    public GuestsController(ISender mediator)
    {
        _mediator = mediator;
    }

    /// <summary>
    /// Lấy danh bạ khách hàng đã từng lưu trú tại tổ chức theo bộ lọc và phân trang.
    /// </summary>
    [HttpGet]
    [RequirePermission("GUESTS", 1)]
    [ProducesResponseType(typeof(ApiResponse<PagedResult<GuestDirectoryItemDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetGuestDirectory(
        [FromQuery] string? search,
        [FromQuery] string? loyaltyTier,
        [FromQuery] bool? isVip,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        var result = await _mediator.Send(new GetGuestDirectoryQuery
        {
            Search = search,
            LoyaltyTier = loyaltyTier,
            IsVip = isVip,
            Page = page,
            PageSize = pageSize
        }, cancellationToken);

        return Ok(ApiResponse.Ok(result));
    }

    /// <summary>
    /// Tra cứu chi tiết hồ sơ và lịch sử các lần đặt phòng của khách hàng theo số điện thoại.
    /// </summary>
    [HttpGet("history")]
    [RequirePermission("GUESTS", 1)]
    [ProducesResponseType(typeof(ApiResponse<GuestDetailDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetGuestHistory(
        [FromQuery] string phoneNumber,
        CancellationToken cancellationToken = default)
    {
        var result = await _mediator.Send(new GetGuestHistoryQuery
        {
            PhoneNumber = phoneNumber
        }, cancellationToken);

        return Ok(ApiResponse.Ok(result));
    }

    /// <summary>
    /// Cập nhật ghi chú đặc biệt (sở thích, VIP, blacklist) của khách hàng.
    /// </summary>
    [HttpPut("notes")]
    [RequirePermission("GUESTS", 4)]
    [ProducesResponseType(typeof(ApiResponse<bool>), StatusCodes.Status200OK)]
    public async Task<IActionResult> UpdateGuestNotes(
        [FromBody] UpdateGuestNotesCommand command,
        CancellationToken cancellationToken = default)
    {
        var result = await _mediator.Send(command, cancellationToken);
        return Ok(ApiResponse.Ok(result, "Cập nhật ghi chú khách hàng thành công."));
    }
}
