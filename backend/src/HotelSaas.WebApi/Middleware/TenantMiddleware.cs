using HotelSaas.Application.Common.Interfaces;
using Microsoft.AspNetCore.Http;

namespace HotelSaas.WebApi.Middleware;

/// <summary>
/// Middleware trích xuất TenantId từ JWT và đưa vào Context.
/// Cực kỳ quan trọng để Database tự động lọc dữ liệu của khách sạn.
/// </summary>
public sealed class TenantMiddleware
{
    private readonly RequestDelegate _next;

    /// <summary>
    /// Khởi tạo instance mới của <see cref="TenantMiddleware"/>.
    /// </summary>
    /// <param name="next">Request delegate kế tiếp.</param>
    public TenantMiddleware(RequestDelegate next) => _next = next;

    /// <summary>
    /// Xử lý HTTP request và trích xuất thông tin TenantId từ JWT claims.
    /// </summary>
    /// <param name="context">Http context của request hiện tại.</param>
    /// <param name="tenantService">Dịch vụ cung cấp thông tin tenant hiện tại.</param>
    public async Task InvokeAsync(HttpContext context, ICurrentTenantService tenantService)
    {
        if (context.User.Identity?.IsAuthenticated == true)
        {
            var tenantIdClaim = context.User.FindFirst("tenantId")?.Value;
            if (Guid.TryParse(tenantIdClaim, out var tenantId))
            {
                tenantService.TenantId = tenantId;
            }
        }

        await _next(context);
    }
}
