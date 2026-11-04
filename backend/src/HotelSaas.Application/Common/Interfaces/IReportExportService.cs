namespace HotelSaas.Application.Common.Interfaces;

public interface IReportExportService
{
    Task<byte[]> ExportReservationsExcelAsync(
        DateOnly fromDate,
        DateOnly toDate,
        Guid? propertyId,
        CancellationToken cancellationToken);

    Task<byte[]> ExportRevenuePdfAsync(
        DateOnly fromDate,
        DateOnly toDate,
        Guid? propertyId,
        CancellationToken cancellationToken);

    Task<byte[]?> ExportInvoicePdfAsync(Guid reservationId, CancellationToken cancellationToken);
}
