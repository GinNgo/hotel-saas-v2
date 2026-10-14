using System.Collections.Generic;
using HotelSaas.Application.Common.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace HotelSaas.WebApi.Controllers;

/// <summary>
/// Public API endpoints for retrieving standardized 2-level Vietnamese administrative divisions.
/// </summary>
[ApiController]
[Route("api/locations")]
[Produces("application/json")]
[AllowAnonymous]
public sealed class LocationsController : ControllerBase
{
    private readonly ILocationLookupService _locationService;

    /// <summary>
    /// Initializes a new instance of <see cref="LocationsController"/>.
    /// </summary>
    public LocationsController(ILocationLookupService locationService)
    {
        _locationService = locationService;
    }

    /// <summary>
    /// Gets all 63 standardized Vietnamese provinces and centrally-governed cities.
    /// </summary>
    /// <returns>A list of provinces.</returns>
    [HttpGet("provinces")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public IActionResult GetProvinces()
    {
        var provinces = _locationService.GetProvinces();
        return Ok(new { success = true, data = provinces });
    }

    /// <summary>
    /// Gets all administrative wards/communes directly under the specified province.
    /// </summary>
    /// <param name="provinceCode">The unique code of the province.</param>
    /// <returns>A list of wards.</returns>
    [HttpGet("provinces/{provinceCode}/wards")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public IActionResult GetWards([FromRoute] string provinceCode)
    {
        var wards = _locationService.GetWardsByProvince(provinceCode);
        return Ok(new { success = true, data = wards });
    }
}
