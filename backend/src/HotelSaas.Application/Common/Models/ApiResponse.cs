namespace HotelSaas.Application.Common.Models;

/// <summary>
/// Khuôn mẫu chuẩn cho mọi response API trả về client.
/// Hỗ trợ trả mã lỗi ErrorCode để Frontend tự dịch đa ngôn ngữ.
/// </summary>
/// <typeparam name="T">Kiểu dữ liệu của dữ liệu phản hồi.</typeparam>
public sealed class ApiResponse<T>
{
    /// <summary>
    /// Trạng thái thành công của yêu cầu.
    /// </summary>
    public bool Success { get; init; }

    /// <summary>
    /// Dữ liệu phản hồi gửi về cho client.
    /// </summary>
    public T? Data { get; init; }

    /// <summary>
    /// Thông điệp phản hồi người dùng (tùy chọn).
    /// </summary>
    public string? Message { get; init; }

    /// <summary>
    /// Mã lỗi chuẩn hóa cho client dịch đa ngôn ngữ.
    /// </summary>
    public string? ErrorCode { get; init; }

    /// <summary>
    /// Danh sách chi tiết các lỗi xác thực dữ liệu đầu vào.
    /// </summary>
    public IDictionary<string, string[]>? Errors { get; init; }

    /// <summary>
    /// Thời điểm phản hồi được tạo theo giờ chuẩn UTC.
    /// </summary>
    public DateTime Timestamp { get; init; } = DateTime.UtcNow;
}

/// <summary>
/// Lớp tiện ích cung cấp các phương thức khởi tạo nhanh đối tượng <see cref="ApiResponse{T}"/>.
/// </summary>
public static class ApiResponse
{
    /// <summary>
    /// Tạo phản hồi thành công kèm dữ liệu.
    /// </summary>
    /// <typeparam name="T">Kiểu dữ liệu phản hồi.</typeparam>
    /// <param name="data">Dữ liệu cần trả về.</param>
    /// <param name="message">Thông điệp thành công tùy chọn.</param>
    /// <returns>Đối tượng ApiResponse thành công.</returns>
    public static ApiResponse<T> Ok<T>(T data, string? message = null) => new() { Success = true, Data = data, Message = message };

    /// <summary>
    /// Tạo phản hồi thành công không kèm dữ liệu.
    /// </summary>
    /// <param name="message">Thông điệp thành công tùy chọn.</param>
    /// <returns>Đối tượng ApiResponse thành công.</returns>
    public static ApiResponse<object?> Ok(string? message = null) => new() { Success = true, Data = null, Message = message };

    /// <summary>
    /// Tạo phản hồi thất bại với mã lỗi và thông điệp.
    /// </summary>
    /// <param name="errorCode">Mã lỗi chuẩn hóa.</param>
    /// <param name="message">Thông điệp lỗi chi tiết.</param>
    /// <returns>Đối tượng ApiResponse thất bại.</returns>
    public static ApiResponse<object?> Fail(string errorCode, string message) => new() { Success = false, ErrorCode = errorCode, Message = message };

    /// <summary>
    /// Tạo phản hồi thất bại do dữ liệu đầu vào không hợp lệ.
    /// </summary>
    /// <param name="errors">Bảng ánh xạ các trường dữ liệu và danh sách lỗi tương ứng.</param>
    /// <returns>Đối tượng ApiResponse lỗi xác thực.</returns>
    public static ApiResponse<object?> ValidationFail(IDictionary<string, string[]> errors) => new() { Success = false, ErrorCode = "ERR_VALIDATION", Message = "Dữ liệu đầu vào không hợp lệ.", Errors = errors };
}
