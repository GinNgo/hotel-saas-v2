# Prompt: Backend Foundation Sprint — Hotel SaaS Platform

## Bạn là .NET backend developer. Nhiệm vụ của bạn là tạo BỘ NỀN TẢNG CHUNG cho toàn bộ API trước khi làm bất kỳ chức năng CRUD nào.

---

## 1. PROJECT CONTEXT & RULES (ĐỌC KỸ BẮT BUỘC)

- **.NET 10**, PostgreSQL, MediatR, FluentValidation, EF Core 10.0.12.
- **Quy tắc 1:** Tất cả XML Comments (`/// <summary>`) BẮT BUỘC phải viết bằng Tiếng Việt.
- **Quy tắc 2:** Sử dụng File-scoped namespaces, class `sealed`.
- **Quy tắc 3:** Để hỗ trợ đa ngôn ngữ (i18n) cho Frontend, Backend KHÔNG BAO GIỜ trả text lỗi cứng trong HTTP response 4xx, 5xx mà phải trả về `ErrorCode` (VD: `ERR_NOT_FOUND`).

---

## 2. TASK CẦN THỰC HIỆN

### TASK 1: Custom Exception Types (3 files)
Tạo thư mục `Application/Common/Exceptions/` và tạo 3 file:

**1. `NotFoundException.cs`**
```csharp
namespace HotelSaas.Application.Common.Exceptions;

/// <summary>
/// Exception ném ra khi không tìm thấy dữ liệu.
/// </summary>
public sealed class NotFoundException : Exception
{
    public string ErrorCode { get; } = "ERR_NOT_FOUND";
    public NotFoundException(string message = "Không tìm thấy dữ liệu yêu cầu.") : base(message) { }
}
```

**2. `ConflictException.cs`**
```csharp
namespace HotelSaas.Application.Common.Exceptions;

/// <summary>
/// Exception ném ra khi dữ liệu bị trùng lặp hoặc xung đột.
/// </summary>
public sealed class ConflictException : Exception
{
    public string ErrorCode { get; } = "ERR_CONFLICT";
    public ConflictException(string message = "Dữ liệu bị xung đột hoặc đã tồn tại.") : base(message) { }
}
```

**3. `ForbiddenException.cs`**
```csharp
namespace HotelSaas.Application.Common.Exceptions;

/// <summary>
/// Exception ném ra khi người dùng không có quyền hoặc vượt quá hạn mức gói dịch vụ.
/// </summary>
public sealed class ForbiddenException : Exception
{
    public string ErrorCode { get; }
    public ForbiddenException(string errorCode = "ERR_FORBIDDEN", string message = "Bạn không có quyền hoặc đã vượt giới hạn gói.") : base(message)
    {
        ErrorCode = errorCode;
    }
}
```

---

### TASK 2: API Response Wrapper & Paging (2 files)
Tạo thư mục `Application/Common/Models/` và tạo 2 file:

**1. `ApiResponse.cs`**
```csharp
namespace HotelSaas.Application.Common.Models;

/// <summary>
/// Khuôn mẫu chuẩn cho mọi response API trả về client.
/// Hỗ trợ trả mã lỗi ErrorCode để Frontend tự dịch đa ngôn ngữ.
/// </summary>
public sealed class ApiResponse<T>
{
    public bool Success { get; init; }
    public T? Data { get; init; }
    public string? Message { get; init; }
    public string? ErrorCode { get; init; }
    public IDictionary<string, string[]>? Errors { get; init; }
    public DateTime Timestamp { get; init; } = DateTime.UtcNow;
}

public static class ApiResponse
{
    public static ApiResponse<T> Ok<T>(T data, string? message = null) => new() { Success = true, Data = data, Message = message };
    public static ApiResponse<object?> Ok(string? message = null) => new() { Success = true, Data = null, Message = message };
    public static ApiResponse<object?> Fail(string errorCode, string message) => new() { Success = false, ErrorCode = errorCode, Message = message };
    public static ApiResponse<object?> ValidationFail(IDictionary<string, string[]> errors) => new() { Success = false, ErrorCode = "ERR_VALIDATION", Message = "Dữ liệu đầu vào không hợp lệ.", Errors = errors };
}
```

**2. `PagedResult.cs`**
```csharp
namespace HotelSaas.Application.Common.Models;

/// <summary>
/// Khuôn mẫu chuẩn cho kết quả phân trang.
/// </summary>
public sealed record PagedResult<T>(IReadOnlyList<T> Items, int TotalCount, int Page, int PageSize)
{
    public int TotalPages => (int)Math.Ceiling(TotalCount / (double)PageSize);
    public bool HasPreviousPage => Page > 1;
    public bool HasNextPage => Page < TotalPages;
}
```

---

### TASK 3: REWRITE Middleware Xử Lý Lỗi (Sửa file cũ)
Viết lại file `WebApi/Middleware/ExceptionHandlingMiddleware.cs` bằng code sau:

```csharp
using System.Text.Json;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;

namespace HotelSaas.WebApi.Middleware;

/// <summary>
/// Middleware bắt mọi exception và map thành chuẩn ApiResponse.
/// </summary>
public sealed class ExceptionHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionHandlingMiddleware> _logger;
    private static readonly JsonSerializerOptions _jsonOptions = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase, DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull };

    public ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try { await _next(context); }
        catch (Exception ex) { await HandleExceptionAsync(context, ex); }
    }

    private async Task HandleExceptionAsync(HttpContext context, Exception exception)
    {
        context.Response.ContentType = "application/json";

        var (statusCode, response) = exception switch
        {
            ValidationException ex => (StatusCodes.Status400BadRequest, ApiResponse.ValidationFail(ex.Errors)),
            NotFoundException ex => (StatusCodes.Status404NotFound, ApiResponse.Fail(ex.ErrorCode, ex.Message)),
            ConflictException ex => (StatusCodes.Status409Conflict, ApiResponse.Fail(ex.ErrorCode, ex.Message)),
            ForbiddenException ex => (StatusCodes.Status403Forbidden, ApiResponse.Fail(ex.ErrorCode, ex.Message)),
            UnauthorizedAccessException ex => (StatusCodes.Status401Unauthorized, ApiResponse.Fail("ERR_UNAUTHORIZED", ex.Message)),
            _ => (StatusCodes.Status500InternalServerError, ApiResponse.Fail("ERR_SYSTEM", "Đã xảy ra lỗi hệ thống."))
        };

        if (statusCode >= 500) _logger.LogError(exception, "System error");
        else _logger.LogWarning(exception, "Client error");

        context.Response.StatusCode = statusCode;
        await context.Response.WriteAsync(JsonSerializer.Serialize(response, _jsonOptions));
    }
}
```

---

### TASK 4: TenantMiddleware (Trọng yếu) (1 file mới)
Tạo file `WebApi/Middleware/TenantMiddleware.cs`:

```csharp
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
    public TenantMiddleware(RequestDelegate next) => _next = next;

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
```

---

### TASK 5: Cấu trúc Entity Mới (SaaS Config & Banners)
Tạo 3 class sau trong `Domain/Entities/`:

**1. `SubscriptionPlan.cs`**
```csharp
using HotelSaas.Domain.Common;

namespace HotelSaas.Domain.Entities;

/// <summary>
/// Bảng cấu hình Gói Dịch Vụ (Động) thay cho Enum, do SuperAdmin quản lý.
/// </summary>
public class SubscriptionPlan : BaseEntity
{
    public string Code { get; set; } = string.Empty; // BASIC, PRO, ENT
    public string Name { get; set; } = string.Empty;
    public decimal MonthlyPrice { get; set; }
    public decimal YearlyPrice { get; set; }
    public int MaxRooms { get; set; }
    public int MaxStaff { get; set; }
    public bool HasVnPay { get; set; }
    public bool HasAdvancedReports { get; set; }
    public bool IsActive { get; set; } = true;
}
```

**2. `SystemBanner.cs`**
```csharp
using HotelSaas.Domain.Common;

namespace HotelSaas.Domain.Entities;

/// <summary>
/// Banner quảng cáo hoặc thông báo toàn hệ thống.
/// Hỗ trợ target hiển thị theo ngày và theo gói dịch vụ (để upsell).
/// </summary>
public class SystemBanner : BaseEntity
{
    public string Title { get; set; } = string.Empty;
    public string ImageUrl { get; set; } = string.Empty;
    public string? TargetUrl { get; set; }
    public string? TargetPlanCode { get; set; } // Nếu null = hiển thị cho mọi người
    public DateTime? ValidFromUtc { get; set; }
    public DateTime? ValidToUtc { get; set; }
    public bool IsActive { get; set; } = true;
}
```

*Cập nhật file `Infrastructure/Persistence/ApplicationDbContext.cs`:* Thêm 2 `DbSet<SubscriptionPlan>` và `DbSet<SystemBanner>` vào file.

---

### TASK 6: Update `Program.cs` & `AuthController.cs`

**Trong `Program.cs`:**
1. Sửa `builder.Services.AddControllers()` thành:
```csharp
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter());
        options.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
        options.JsonSerializerOptions.DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull;
    });
```
2. Thêm `app.UseMiddleware<TenantMiddleware>();` vào **NGAY SAU** dòng `app.UseAuthentication();`.

**Trong `Application/Auth/Commands/Register/RegisterCommandHandler.cs`:**
Tìm `throw new InvalidOperationException("Email đã được sử dụng.");` và sửa thành:
`throw new ConflictException("Email đã được sử dụng.");`

---

## 3. HOÀN TẤT
1. Chạy lệnh: `dotnet build C:\Dev\hotel-saas-v2\backend --verbosity minimal`
2. Đảm bảo build thành công 0 Warning, 0 Error.
3. Báo cáo lại kết quả.
