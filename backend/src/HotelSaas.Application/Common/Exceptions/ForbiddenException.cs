namespace HotelSaas.Application.Common.Exceptions;

/// <summary>
/// Ngoại lệ ném ra khi người dùng không có quyền hoặc vượt quá hạn mức gói dịch vụ.
/// </summary>
public sealed class ForbiddenException : Exception
{
    /// <summary>
    /// Mã lỗi định danh cho lỗi bị cấm truy cập hoặc vượt hạn mức.
    /// </summary>
    public string ErrorCode { get; }

    /// <summary>
    /// Khởi tạo instance mới của <see cref="ForbiddenException"/>.
    /// </summary>
    /// <param name="errorCode">Mã lỗi định danh tùy chỉnh.</param>
    /// <param name="message">Thông điệp lỗi chi tiết.</param>
    public ForbiddenException(string errorCode = "ERR_FORBIDDEN", string message = "Bạn không có quyền hoặc đã vượt giới hạn gói.") : base(message)
    {
        ErrorCode = errorCode;
    }
}
