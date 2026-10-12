namespace HotelSaas.Application.Common.Exceptions;

/// <summary>
/// Ngoại lệ ném ra khi yêu cầu không hợp lệ hoặc ngữ cảnh mâu thuẫn (HTTP 400).
/// </summary>
public sealed class BadRequestException : Exception
{
    /// <summary>
    /// Mã lỗi định danh (ví dụ: ERR_CONTEXT_MISMATCH).
    /// </summary>
    public string ErrorCode { get; }

    /// <summary>
    /// Khởi tạo instance mới của <see cref="BadRequestException"/>.
    /// </summary>
    /// <param name="errorCode">Mã lỗi định danh.</param>
    /// <param name="message">Thông điệp lỗi chi tiết.</param>
    public BadRequestException(string errorCode = "ERR_BAD_REQUEST", string message = "Yêu cầu không hợp lệ.")
        : base(message)
    {
        ErrorCode = errorCode;
    }
}
