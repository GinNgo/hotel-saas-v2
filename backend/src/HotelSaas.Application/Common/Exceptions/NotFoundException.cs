namespace HotelSaas.Application.Common.Exceptions;

/// <summary>
/// Ngoại lệ ném ra khi không tìm thấy dữ liệu yêu cầu.
/// </summary>
public sealed class NotFoundException : Exception
{
    /// <summary>
    /// Mã lỗi định danh cho lỗi không tìm thấy dữ liệu.
    /// </summary>
    public string ErrorCode { get; } = "ERR_NOT_FOUND";

    /// <summary>
    /// Khởi tạo instance mới của <see cref="NotFoundException"/>.
    /// </summary>
    /// <param name="message">Thông điệp lỗi chi tiết.</param>
    public NotFoundException(string message = "Không tìm thấy dữ liệu yêu cầu.") : base(message) { }
}
