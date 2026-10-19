namespace HotelSaas.Domain.Enums;

/// <summary>
/// Trạng thái vòng đời của Hợp đồng dịch vụ phần mềm ký kết giữa Nền tảng SaaS và Khách sạn / Doanh nghiệp.
/// </summary>
public enum TenantContractStatus
{
    /// <summary>Bản nháp hợp đồng đang soạn thảo / thương thảo điều khoản.</summary>
    Draft = 0,

    /// <summary>Hợp đồng đã ký kết và đang có hiệu lực hoạt động.</summary>
    Active = 1,

    /// <summary>Hợp đồng sắp hết hạn (trong vòng 30 ngày) và đang chờ gia hạn.</summary>
    PendingRenewal = 2,

    /// <summary>Hợp đồng đã quá thời hạn hiệu lực và chưa được gia hạn.</summary>
    Expired = 3,

    /// <summary>Hợp đồng đã bị chấm dứt hoặc thanh lý trước thời hạn.</summary>
    Terminated = 4
}
