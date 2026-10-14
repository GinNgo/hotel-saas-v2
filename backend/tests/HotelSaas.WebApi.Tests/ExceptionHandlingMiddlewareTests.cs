using System.IO;
using System.Text.Json;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Models;
using HotelSaas.WebApi.Middleware;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace HotelSaas.WebApi.Tests;

/// <summary>
/// Unit and integration tests for ExceptionHandlingMiddleware verifying proper HTTP status code mapping
/// for client context exceptions (Finding 2).
/// </summary>
public sealed class ExceptionHandlingMiddlewareTests
{
    private static async Task<(int StatusCode, string ResponseBody)> InvokeMiddlewareWithException(Exception thrownException)
    {
        var middleware = new ExceptionHandlingMiddleware(
            next: _ => throw thrownException,
            logger: NullLogger<ExceptionHandlingMiddleware>.Instance);

        var context = new DefaultHttpContext();
        var responseStream = new MemoryStream();
        context.Response.Body = responseStream;

        await middleware.InvokeAsync(context);

        responseStream.Seek(0, SeekOrigin.Begin);
        using var reader = new StreamReader(responseStream);
        var body = await reader.ReadToEndAsync();

        return (context.Response.StatusCode, body);
    }

    [Fact]
    public async Task WhenInactiveProperty_ThrowsConflictException_ReturnsHttp409Conflict()
    {
        var ex = new ConflictException("ERR_PROPERTY_INACTIVE", "Chi nhánh hiện không ở trạng thái hoạt động.");
        var (statusCode, body) = await InvokeMiddlewareWithException(ex);

        Assert.Equal(StatusCodes.Status409Conflict, statusCode);
        var doc = JsonDocument.Parse(body);
        Assert.False(doc.RootElement.GetProperty("success").GetBoolean());
        Assert.Equal("ERR_PROPERTY_INACTIVE", doc.RootElement.GetProperty("errorCode").GetString());
        Assert.Contains("hoạt động", doc.RootElement.GetProperty("message").GetString());
    }

    [Fact]
    public async Task WhenMultiplePropertiesWithoutPropertyId_ThrowsConflictException_ReturnsHttp409Conflict()
    {
        var ex = new ConflictException("ERR_PROPERTY_REQUIRED", "Tenant có nhiều chi nhánh. Bắt buộc phải chỉ định PropertyId cụ thể.");
        var (statusCode, body) = await InvokeMiddlewareWithException(ex);

        Assert.Equal(StatusCodes.Status409Conflict, statusCode);
        var doc = JsonDocument.Parse(body);
        Assert.False(doc.RootElement.GetProperty("success").GetBoolean());
        Assert.Equal("ERR_PROPERTY_REQUIRED", doc.RootElement.GetProperty("errorCode").GetString());
        Assert.Contains("Bắt buộc phải chỉ định PropertyId", doc.RootElement.GetProperty("message").GetString());
    }

    [Fact]
    public async Task WhenMismatchedProperty_ThrowsConflictException_ReturnsHttp409Conflict()
    {
        var ex = new ConflictException("ERR_PROPERTY_MISMATCH", "Phòng phải thuộc cùng chi nhánh với loại phòng được chọn.");
        var (statusCode, body) = await InvokeMiddlewareWithException(ex);

        Assert.Equal(StatusCodes.Status409Conflict, statusCode);
        var doc = JsonDocument.Parse(body);
        Assert.False(doc.RootElement.GetProperty("success").GetBoolean());
        Assert.Equal("ERR_PROPERTY_MISMATCH", doc.RootElement.GetProperty("errorCode").GetString());
        Assert.Contains("cùng chi nhánh", doc.RootElement.GetProperty("message").GetString());
    }

    [Fact]
    public async Task WhenDuplicateRoomNumber_ThrowsConflictException_ReturnsHttp409Conflict()
    {
        var ex = new ConflictException("ERR_CONFLICT", "Số phòng đã tồn tại trong chi nhánh này.");
        var (statusCode, body) = await InvokeMiddlewareWithException(ex);

        Assert.Equal(StatusCodes.Status409Conflict, statusCode);
        var doc = JsonDocument.Parse(body);
        Assert.False(doc.RootElement.GetProperty("success").GetBoolean());
        Assert.Equal("ERR_CONFLICT", doc.RootElement.GetProperty("errorCode").GetString());
    }

    [Fact]
    public async Task WhenCrossTenantProperty_ThrowsForbiddenException_ReturnsHttp403Forbidden()
    {
        var ex = new ForbiddenException("ERR_FORBIDDEN", "Chi nhánh không thuộc quyền quản lý của Tenant hiện tại.");
        var (statusCode, body) = await InvokeMiddlewareWithException(ex);

        Assert.Equal(StatusCodes.Status403Forbidden, statusCode);
        var doc = JsonDocument.Parse(body);
        Assert.False(doc.RootElement.GetProperty("success").GetBoolean());
        Assert.Equal("ERR_FORBIDDEN", doc.RootElement.GetProperty("errorCode").GetString());
    }

    [Fact]
    public async Task WhenPropertyNotFound_ThrowsNotFoundException_ReturnsHttp404NotFound()
    {
        var ex = new NotFoundException("Chi nhánh không tồn tại.");
        var (statusCode, body) = await InvokeMiddlewareWithException(ex);

        Assert.Equal(StatusCodes.Status404NotFound, statusCode);
        var doc = JsonDocument.Parse(body);
        Assert.False(doc.RootElement.GetProperty("success").GetBoolean());
        Assert.Equal("ERR_NOT_FOUND", doc.RootElement.GetProperty("errorCode").GetString());
    }

    [Fact]
    public async Task WhenInvalidOperation_WithBranchKeyword_ReturnsHttp409Conflict_Not500()
    {
        var ex = new InvalidOperationException("Tenant có nhiều chi nhánh. Cần chọn chi nhánh cụ thể.");
        var (statusCode, body) = await InvokeMiddlewareWithException(ex);

        Assert.Equal(StatusCodes.Status409Conflict, statusCode);
        var doc = JsonDocument.Parse(body);
        Assert.False(doc.RootElement.GetProperty("success").GetBoolean());
        Assert.Equal("ERR_CONFLICT", doc.RootElement.GetProperty("errorCode").GetString());
    }

    [Fact]
    public async Task WhenPostgresUniqueViolation_RoomNumberConstraint_ReturnsHttp409Conflict()
    {
        var pgEx = new Npgsql.PostgresException(
            messageText: "duplicate key value violates unique constraint",
            severity: "ERROR",
            invariantSeverity: "ERROR",
            sqlState: "23505",
            constraintName: "UX_Room_PropertyId_RoomNumber");

        var dbEx = new Microsoft.EntityFrameworkCore.DbUpdateException("Database error", pgEx);
        var (statusCode, body) = await InvokeMiddlewareWithException(dbEx);

        Assert.Equal(StatusCodes.Status409Conflict, statusCode);
        var doc = JsonDocument.Parse(body);
        Assert.False(doc.RootElement.GetProperty("success").GetBoolean());
        Assert.Equal("ERR_CONFLICT", doc.RootElement.GetProperty("errorCode").GetString());
        Assert.Contains("Số phòng đã tồn tại", doc.RootElement.GetProperty("message").GetString());
    }

    [Fact]
    public async Task WhenPostgresUniqueViolation_RoomTypeCodeConstraint_ReturnsHttp409Conflict()
    {
        var pgEx = new Npgsql.PostgresException(
            messageText: "duplicate key value violates unique constraint",
            severity: "ERROR",
            invariantSeverity: "ERROR",
            sqlState: "23505",
            constraintName: "UX_RoomType_PropertyId_Code");

        var dbEx = new Microsoft.EntityFrameworkCore.DbUpdateException("Database error", pgEx);
        var (statusCode, body) = await InvokeMiddlewareWithException(dbEx);

        Assert.Equal(StatusCodes.Status409Conflict, statusCode);
        var doc = JsonDocument.Parse(body);
        Assert.False(doc.RootElement.GetProperty("success").GetBoolean());
        Assert.Equal("ERR_CONFLICT", doc.RootElement.GetProperty("errorCode").GetString());
        Assert.Contains("Mã loại phòng đã tồn tại", doc.RootElement.GetProperty("message").GetString());
    }

    [Fact]
    public async Task WhenPostgresUniqueViolation_OtherConstraint_ReturnsHttp500SystemError()
    {
        var pgEx = new Npgsql.PostgresException(
            messageText: "duplicate key value violates unique constraint",
            severity: "ERROR",
            invariantSeverity: "ERROR",
            sqlState: "23505",
            constraintName: "UX_Users_Email");

        var dbEx = new Microsoft.EntityFrameworkCore.DbUpdateException("Database error", pgEx);
        var (statusCode, body) = await InvokeMiddlewareWithException(dbEx);

        Assert.Equal(StatusCodes.Status500InternalServerError, statusCode);
        var doc = JsonDocument.Parse(body);
        Assert.False(doc.RootElement.GetProperty("success").GetBoolean());
        Assert.Equal("ERR_SYSTEM", doc.RootElement.GetProperty("errorCode").GetString());
    }

    [Fact]
    public async Task WhenPostgresForeignKeyViolation_ReturnsHttp500SystemError()
    {
        var pgEx = new Npgsql.PostgresException(
            messageText: "insert or update violates foreign key constraint",
            severity: "ERROR",
            invariantSeverity: "ERROR",
            sqlState: "23503",
            constraintName: "FK_Rooms_RoomTypes_RoomTypeId");

        var dbEx = new Microsoft.EntityFrameworkCore.DbUpdateException("Database error", pgEx);
        var (statusCode, body) = await InvokeMiddlewareWithException(dbEx);

        Assert.Equal(StatusCodes.Status500InternalServerError, statusCode);
        var doc = JsonDocument.Parse(body);
        Assert.False(doc.RootElement.GetProperty("success").GetBoolean());
        Assert.Equal("ERR_SYSTEM", doc.RootElement.GetProperty("errorCode").GetString());
    }

    [Fact]
    public async Task WhenUnhandledSystemException_ReturnsHttp500InternalServerError()
    {
        var ex = new Exception("Unhandled database connection failure");
        var (statusCode, body) = await InvokeMiddlewareWithException(ex);

        Assert.Equal(StatusCodes.Status500InternalServerError, statusCode);
        var doc = JsonDocument.Parse(body);
        Assert.False(doc.RootElement.GetProperty("success").GetBoolean());
        Assert.Equal("ERR_SYSTEM", doc.RootElement.GetProperty("errorCode").GetString());
    }
}
