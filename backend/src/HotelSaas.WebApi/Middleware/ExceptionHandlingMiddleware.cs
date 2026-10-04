using System.Text.Json;
using HotelSaas.Application.Common.Exceptions;

namespace HotelSaas.WebApi.Middleware;

/// <summary>
/// Global exception handling middleware that translates known application exceptions
/// into structured HTTP error responses with appropriate status codes.
/// </summary>
public sealed class ExceptionHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionHandlingMiddleware> _logger;

    /// <summary>
    /// Initializes a new instance of <see cref="ExceptionHandlingMiddleware"/>.
    /// </summary>
    /// <param name="next">The next middleware in the pipeline.</param>
    /// <param name="logger">Logger for recording unhandled exceptions.</param>
    public ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    /// <summary>
    /// Invokes the middleware, catching and mapping exceptions to HTTP responses.
    /// </summary>
    /// <param name="context">The current HTTP context.</param>
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (ValidationException ex)
        {
            _logger.LogWarning(ex, "Validation failed for request {Path}", context.Request.Path);
            context.Response.StatusCode = StatusCodes.Status400BadRequest;
            context.Response.ContentType = "application/json";

            var errors = ex.Errors;

            var response = new
            {
                type = "ValidationError",
                title = "One or more validation errors occurred.",
                status = 400,
                errors
            };

            await context.Response.WriteAsync(JsonSerializer.Serialize(response, _jsonOptions));
        }
        catch (InvalidOperationException ex) when (
            ex.Message.Contains("already exists", StringComparison.OrdinalIgnoreCase) ||
            ex.Message.Contains("đã được sử dụng", StringComparison.OrdinalIgnoreCase))
        {
            _logger.LogWarning(ex, "Conflict for request {Path}", context.Request.Path);
            context.Response.StatusCode = StatusCodes.Status409Conflict;
            context.Response.ContentType = "application/json";

            var response = new
            {
                type = "Conflict",
                title = ex.Message,
                status = 409
            };

            await context.Response.WriteAsync(JsonSerializer.Serialize(response, _jsonOptions));
        }
        catch (UnauthorizedAccessException ex)
        {
            _logger.LogWarning(ex, "Unauthorized access for request {Path}", context.Request.Path);
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            context.Response.ContentType = "application/json";

            var response = new
            {
                type = "Unauthorized",
                title = "Authentication is required to access this resource.",
                status = 401
            };

            await context.Response.WriteAsync(JsonSerializer.Serialize(response, _jsonOptions));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unhandled exception for request {Path}", context.Request.Path);
            context.Response.StatusCode = StatusCodes.Status500InternalServerError;
            context.Response.ContentType = "application/json";

            var response = new
            {
                type = "InternalServerError",
                title = "An unexpected error occurred. Please try again later.",
                status = 500
            };

            await context.Response.WriteAsync(JsonSerializer.Serialize(response, _jsonOptions));
        }
    }

    private static readonly JsonSerializerOptions _jsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };
}
