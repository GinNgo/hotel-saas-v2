namespace HotelSaas.Application.Common.Exceptions;

/// <summary>
/// Ngoại lệ ném ra khi dữ liệu bị trùng lặp hoặc xung đột.
/// </summary>
public sealed class ConflictException : Exception
{
    /// <summary>
    /// Mã lỗi định danh cho lỗi xung đột dữ liệu.
    /// </summary>
    public string ErrorCode { get; } = "ERR_CONFLICT";

    /// <summary>
    /// Khởi tạo instance mới của <see cref="ConflictException"/>.
    /// </summary>
    /// <param name="message">Thông điệp lỗi chi tiết.</param>
    public ConflictException(string message = "Dữ liệu bị xung đột hoặc đã tồn tại.") : base(message) { }

    /// <summary>
    /// Khởi tạo instance mới của <see cref="ConflictException"/> với mã lỗi tùy chỉnh.
    /// </summary>
    /// <param name="errorCode">Mã lỗi định danh cho lỗi xung đột.</param>
    /// <param name="message">Thông điệp lỗi chi tiết.</param>
    public ConflictException(string errorCode, string message) : base(message)
    {
        ErrorCode = errorCode;
    }
}
