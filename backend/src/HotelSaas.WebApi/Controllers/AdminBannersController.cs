using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Banners.Commands.CreateBanner;
using HotelSaas.Application.Banners.Commands.DeleteBanner;
using HotelSaas.Application.Banners.Commands.UpdateBanner;
using HotelSaas.Application.Banners.DTOs;
using HotelSaas.Application.Banners.Queries.GetActiveBanners;
using HotelSaas.Application.Banners.Queries.GetAllBanners;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace HotelSaas.WebApi.Controllers;

/// <summary>
/// Manages global platform SystemBanners (SuperAdmin CRUD) and public/tenant-targeted active banner feed.
/// </summary>
[Authorize(Roles = "SuperAdmin")]
[ApiController]
[Route("api/admin/banners")]
[Produces("application/json")]
public sealed class AdminBannersController : ControllerBase
{
    private readonly ISender _mediator;

    public AdminBannersController(ISender mediator)
    {
        _mediator = mediator ?? throw new ArgumentNullException(nameof(mediator));
    }

    [HttpGet("/api/banners/active")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(IReadOnlyList<SystemBannerDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetActiveBanners(
        [FromQuery] string? planCode,
        CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(new GetActiveBannersQuery(planCode), cancellationToken);
        return Ok(result);
    }

    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<SystemBannerDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAllBanners(CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(new GetAllBannersQuery(), cancellationToken);
        return Ok(result);
    }

    [HttpPost]
    [ProducesResponseType(typeof(SystemBannerDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CreateBanner(
        [FromBody] SaveSystemBannerRequest request,
        CancellationToken cancellationToken)
    {
        var created = await _mediator.Send(new CreateBannerCommand(
            request.Title,
            request.ImageUrl,
            request.TargetUrl,
            request.TargetPlanCode,
            request.ValidFromUtc,
            request.ValidToUtc,
            request.IsActive), cancellationToken);

        return Created($"/api/admin/banners/{created.Id}", created);
    }

    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(SystemBannerDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateBanner(
        Guid id,
        [FromBody] SaveSystemBannerRequest request,
        CancellationToken cancellationToken)
    {
        var updated = await _mediator.Send(new UpdateBannerCommand(
            id,
            request.Title,
            request.ImageUrl,
            request.TargetUrl,
            request.TargetPlanCode,
            request.ValidFromUtc,
            request.ValidToUtc,
            request.IsActive), cancellationToken);

        return Ok(updated);
    }

    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteBanner(Guid id, CancellationToken cancellationToken)
    {
        await _mediator.Send(new DeleteBannerCommand(id), cancellationToken);
        return NoContent();
    }
}

public sealed record SaveSystemBannerRequest(
    string Title,
    string ImageUrl,
    string? TargetUrl = null,
    string? TargetPlanCode = null,
    DateTime? ValidFromUtc = null,
    DateTime? ValidToUtc = null,
    bool IsActive = true
);
