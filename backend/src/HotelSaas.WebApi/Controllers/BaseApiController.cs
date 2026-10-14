using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Common.Models;
using MediatR;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;

namespace HotelSaas.WebApi.Controllers;

/// <summary>
/// Lớp Controller cơ sở (Base Controller) cho toàn bộ API Controllers trong hệ thống Hotel SaaS.
/// Cung cấp ISender Mediator, các helper methods chuẩn hóa phản hồi ApiResponse{T} và truy cập Tenant/Property context an toàn.
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public abstract class BaseApiController : ControllerBase
{
    private ISender? _mediator;

    /// <summary>
    /// ISender MediatR instance được inject tự động qua Service Locator từ HttpContext.
    /// </summary>
    protected ISender Mediator => _mediator ??= HttpContext.RequestServices.GetRequiredService<ISender>();

    /// <summary>
    /// Mã định danh Tenant của ngữ cảnh yêu cầu hiện tại (nếu có).
    /// </summary>
    protected Guid? CurrentTenantId =>
        HttpContext.RequestServices.GetService<ICurrentTenantService>()?.TenantId;

    /// <summary>
    /// Mã định danh Property của ngữ cảnh yêu cầu hiện tại (nếu có).
    /// </summary>
    protected Guid? CurrentPropertyId =>
        HttpContext.RequestServices.GetService<ICurrentPropertyService>()?.PropertyId;

    /// <summary>
    /// Trả về phản hồi HTTP 200 OK bọc trong <see cref="ApiResponse{T}"/>.
    /// </summary>
    /// <typeparam name="T">Kiểu dữ liệu của phản hồi.</typeparam>
    /// <param name="data">Dữ liệu cần trả về.</param>
    /// <param name="message">Thông điệp thành công tùy chọn.</param>
    /// <returns>ActionResult chứa ApiResponse chuẩn.</returns>
    protected ActionResult<ApiResponse<T>> OkResponse<T>(T data, string? message = null)
    {
        return Ok(ApiResponse.Ok(data, message));
    }

    /// <summary>
    /// Trả về phản hồi HTTP 201 Created bọc trong <see cref="ApiResponse{T}"/>.
    /// </summary>
    /// <typeparam name="T">Kiểu dữ liệu của phản hồi.</typeparam>
    /// <param name="uri">URI của tài nguyên vừa tạo.</param>
    /// <param name="data">Dữ liệu tài nguyên vừa tạo.</param>
    /// <param name="message">Thông điệp thành công tùy chọn.</param>
    /// <returns>ActionResult chứa ApiResponse chuẩn.</returns>
    protected ActionResult<ApiResponse<T>> CreatedResponse<T>(string uri, T data, string? message = null)
    {
        return Created(uri, ApiResponse.Ok(data, message));
    }
}
