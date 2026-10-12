namespace HotelSaas.Application.Common.Models;

/// <summary>
/// Khuôn mẫu chuẩn cho kết quả phân trang.
/// </summary>
/// <typeparam name="T">Kiểu dữ liệu của các phần tử trong danh sách.</typeparam>
/// <param name="Items">Danh sách phần tử trong trang hiện tại.</param>
/// <param name="TotalCount">Tổng số lượng phần tử tìm thấy.</param>
/// <param name="Page">Chỉ số trang hiện tại (bắt đầu từ 1).</param>
/// <param name="PageSize">Số lượng phần tử tối đa trên mỗi trang.</param>
public sealed record PagedResult<T>(IReadOnlyList<T> Items, int TotalCount, int Page, int PageSize)
{
    /// <summary>
    /// Tổng số trang dựa trên tổng số phần tử và kích thước trang.
    /// </summary>
    public int TotalPages => (int)Math.Ceiling(TotalCount / (double)PageSize);

    /// <summary>
    /// Cho biết có trang trước đó hay không.
    /// </summary>
    public bool HasPreviousPage => Page > 1;

    /// <summary>
    /// Cho biết có trang tiếp theo hay không.
    /// </summary>
    public bool HasNextPage => Page < TotalPages;
}
