using ClosedXML.Excel;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace HotelSaas.Infrastructure.Services;

public sealed class ReportExportService(
    IApplicationDbContext context,
    ICurrentUserContext currentUser) : IReportExportService
{
    public async Task<byte[]> ExportReservationsExcelAsync(
        DateOnly fromDate,
        DateOnly toDate,
        Guid? propertyId,
        CancellationToken cancellationToken)
    {
        var tenantId = currentUser.TenantId
            ?? throw new InvalidOperationException("Tenant context is required to export reports.");

        var query = context.Reservations.AsNoTracking()
            .Include(reservation => reservation.Property)
            .Include(reservation => reservation.Room)
            .Include(reservation => reservation.Payments)
            .Where(reservation => reservation.TenantId == tenantId &&
                reservation.CheckInDate <= toDate && reservation.CheckOutDate >= fromDate);

        var effectivePropertyId = ResolvePropertyId(propertyId);
        if (effectivePropertyId.HasValue && effectivePropertyId.Value != Guid.Empty)
            query = query.Where(reservation => reservation.PropertyId == effectivePropertyId.Value);

        var propertiesQuery = context.Properties.AsNoTracking().Where(property => property.TenantId == tenantId);
        if (effectivePropertyId.HasValue && effectivePropertyId.Value != Guid.Empty)
            propertiesQuery = propertiesQuery.Where(property => property.Id == effectivePropertyId.Value);
        var propertyInfo = await propertiesQuery
            .OrderBy(property => property.Name)
            .Select(property => property.Name + " — " + property.Address)
            .ToListAsync(cancellationToken);

        var reservations = await query.OrderBy(reservation => reservation.CheckInDate)
            .ThenBy(reservation => reservation.ConfirmationCode)
            .ToListAsync(cancellationToken);

        var reservationIds = reservations.Select(reservation => reservation.Id).ToArray();
        var invoices = await context.Invoices.AsNoTracking()
            .Where(invoice => invoice.TenantId == tenantId && reservationIds.Contains(invoice.ReservationId))
            .ToDictionaryAsync(invoice => invoice.ReservationId, cancellationToken);

        var rows = reservations.Select(reservation =>
        {
            invoices.TryGetValue(reservation.Id, out var invoice);
            return new RevenueExportRow(
                reservation.ConfirmationCode,
                reservation.GuestName,
                reservation.Property?.Name ?? string.Empty,
                reservation.CheckInDate,
                reservation.CheckOutDate,
                invoice is null ? reservation.TotalAmount : Math.Max(0m, invoice.Subtotal - invoice.ServiceFeeAmount - invoice.DiscountAmount),
                invoice?.ServiceFeeAmount ?? 0m,
                invoice?.TaxAmount ?? 0m,
                invoice?.PaidAmount ?? reservation.Payments
                    .Where(payment => payment.Status == PaymentStatus.Completed)
                    .Sum(payment => payment.Amount),
                reservation.Status.ToString());
        }).ToArray();
        return CreateRevenueWorkbook(fromDate, toDate, rows, propertyInfo.Count == 0 ? "Toàn bộ cơ sở" : string.Join(" | ", propertyInfo));
    }

    public static byte[] CreateRevenueWorkbook(
        DateOnly fromDate,
        DateOnly toDate,
        IReadOnlyCollection<RevenueExportRow> rows,
        string propertyInfo = "Toàn bộ cơ sở")
    {
        using var workbook = new XLWorkbook();
        var sheet = workbook.Worksheets.Add("Doanh thu");
        sheet.Cell(1, 1).Value = "BÁO CÁO DOANH THU & SỔ CÁI";
        sheet.Range(1, 1, 1, 10).Merge();
        sheet.Cell(2, 1).Value = $"Cơ sở: {propertyInfo}";
        sheet.Range(2, 1, 2, 10).Merge();
        sheet.Cell(3, 1).Value = $"Kỳ báo cáo: {fromDate:dd/MM/yyyy} - {toDate:dd/MM/yyyy}    |    Ngày xuất: {DateTime.UtcNow:dd/MM/yyyy HH:mm} UTC";
        sheet.Range(3, 1, 3, 10).Merge();
        var headers = new[] { "Mã đặt phòng", "Khách hàng", "Cơ sở", "Ngày nhận", "Ngày trả", "Tiền phòng", "Phụ thu", "VAT", "Thực thu", "Trạng thái" };
        for (var column = 0; column < headers.Length; column++)
            sheet.Cell(4, column + 1).Value = headers[column];
        var header = sheet.Range(4, 1, 4, headers.Length);
        header.Style.Font.Bold = true;
        header.Style.Fill.BackgroundColor = XLColor.FromHtml("#0D2E28");
        header.Style.Font.FontColor = XLColor.White;

        var row = 5;
        foreach (var item in rows)
        {
            sheet.Cell(row, 1).Value = item.ConfirmationCode;
            sheet.Cell(row, 2).Value = item.GuestName;
            sheet.Cell(row, 3).Value = item.PropertyName;
            sheet.Cell(row, 4).Value = item.CheckInDate.ToDateTime(TimeOnly.MinValue);
            sheet.Cell(row, 5).Value = item.CheckOutDate.ToDateTime(TimeOnly.MinValue);
            sheet.Cell(row, 6).Value = item.RoomAmount;
            sheet.Cell(row, 7).Value = item.SurchargeAmount;
            sheet.Cell(row, 8).Value = item.VatAmount;
            sheet.Cell(row, 9).Value = item.PaidAmount;
            sheet.Cell(row, 10).Value = item.Status;
            row++;
        }

        var columnNames = new[] { "A", "B", "C", "D", "E", "F", "G", "H", "I", "J" };
        sheet.Cell(row, 5).Value = "TỔNG CỘNG";
        for (var column = 6; column <= 9; column++)
            sheet.Cell(row, column).FormulaA1 = $"SUM({columnNames[column - 1]}5:{columnNames[column - 1]}{row - 1})";
        sheet.Range(row, 5, row, 9).Style.Font.Bold = true;
        sheet.Range(5, 6, row, 9).Style.NumberFormat.Format = "#,##0 \u20ab";
        sheet.Range(5, 4, Math.Max(5, row - 1), 5).Style.DateFormat.Format = "dd/mm/yyyy";
        sheet.SheetView.FreezeRows(4);
        sheet.Columns().AdjustToContents();
        sheet.Column(2).Width = Math.Min(34, Math.Max(sheet.Column(2).Width, 20));
        sheet.Column(3).Width = Math.Min(36, Math.Max(sheet.Column(3).Width, 20));
        using var stream = new MemoryStream();
        workbook.SaveAs(stream);
        return stream.ToArray();
    }

    public async Task<byte[]> ExportRevenuePdfAsync(
        DateOnly fromDate,
        DateOnly toDate,
        Guid? propertyId,
        CancellationToken cancellationToken)
    {
        var tenantId = currentUser.TenantId
            ?? throw new InvalidOperationException("Tenant context is required to export reports.");
        var query = context.Reservations.AsNoTracking()
            .Include(reservation => reservation.Property)
            .Include(reservation => reservation.Payments)
            .Where(reservation => reservation.TenantId == tenantId &&
                reservation.CheckInDate <= toDate && reservation.CheckOutDate >= fromDate);
        var effectivePropertyId = ResolvePropertyId(propertyId);
        if (effectivePropertyId.HasValue && effectivePropertyId.Value != Guid.Empty)
            query = query.Where(reservation => reservation.PropertyId == effectivePropertyId.Value);
        var rows = await query.OrderBy(reservation => reservation.CheckInDate)
            .ThenBy(reservation => reservation.ConfirmationCode)
            .Select(reservation => new
            {
                reservation.ConfirmationCode,
                reservation.GuestName,
                PropertyName = reservation.Property!.Name,
                reservation.CheckInDate,
                reservation.CheckOutDate,
                PaidAmount = reservation.Payments
                    .Where(payment => payment.Status == PaymentStatus.Completed)
                    .Sum(payment => payment.Amount)
            })
            .ToListAsync(cancellationToken);

        QuestPDF.Settings.License = LicenseType.Community;
        return Document.Create(document => document.Page(page =>
        {
            page.Size(PageSizes.A4.Landscape());
            page.Margin(30);
            page.DefaultTextStyle(style => style.FontFamily("Lato").FontSize(9));
            page.Header().Column(header =>
            {
                header.Item().Text("BÁO CÁO DOANH THU & SỔ CÁI").FontSize(18).Bold();
                header.Item().Text($"Kỳ báo cáo: {fromDate:dd/MM/yyyy} - {toDate:dd/MM/yyyy}");
                header.Item().Text($"Ngày xuất: {DateTime.UtcNow:dd/MM/yyyy HH:mm} UTC");
            });
            page.Content().PaddingVertical(16).Table(table =>
            {
                table.ColumnsDefinition(columns =>
                {
                    columns.RelativeColumn(1.3f);
                    columns.RelativeColumn(1.3f);
                    columns.RelativeColumn(1.7f);
                    columns.RelativeColumn(1f);
                    columns.RelativeColumn(1f);
                    columns.RelativeColumn(1f);
                });
                table.Header(header =>
                {
                    header.Cell().Text("Mã đơn").Bold();
                    header.Cell().Text("Khách hàng").Bold();
                    header.Cell().Text("Cơ sở").Bold();
                    header.Cell().Text("Nhận phòng").Bold();
                    header.Cell().Text("Trả phòng").Bold();
                    header.Cell().AlignRight().Text("Thực thu").Bold();
                });
                foreach (var row in rows)
                {
                    table.Cell().Text(row.ConfirmationCode);
                    table.Cell().Text(row.GuestName);
                    table.Cell().Text(row.PropertyName);
                    table.Cell().Text(row.CheckInDate.ToString("dd/MM/yyyy"));
                    table.Cell().Text(row.CheckOutDate.ToString("dd/MM/yyyy"));
                    table.Cell().AlignRight().Text(row.PaidAmount.ToString("N0") + " ₫");
                }
            });
            page.Footer().AlignRight().Text($"Tổng thực thu: {rows.Sum(row => row.PaidAmount):N0} ₫");
        })).GeneratePdf();
    }

    public async Task<byte[]?> ExportInvoicePdfAsync(Guid reservationId, CancellationToken cancellationToken)
    {
        var tenantId = currentUser.TenantId
            ?? throw new InvalidOperationException("Tenant context is required to export invoices.");
        if (!currentUser.IsTenantWide && !currentUser.PropertyId.HasValue)
            throw new InvalidOperationException("Property context is required to export invoices.");
        var invoice = await context.Invoices.AsNoTracking()
            .Include(item => item.InvoiceItems)
            .Include(item => item.Reservation)
            .FirstOrDefaultAsync(item => item.TenantId == tenantId && item.ReservationId == reservationId &&
                (currentUser.IsTenantWide || !currentUser.PropertyId.HasValue || item.Reservation!.PropertyId == currentUser.PropertyId.Value),
                cancellationToken);
        if (invoice is null) return null;

        QuestPDF.Settings.License = LicenseType.Community;
        return Document.Create(document => document.Page(page =>
        {
            page.Size(PageSizes.A4);
            page.Margin(36);
            page.DefaultTextStyle(style => style.FontFamily("Lato").FontSize(10));
            page.Header().Column(header =>
            {
                header.Item().Text(invoice.PropertyName).FontSize(18).Bold();
                header.Item().Text(invoice.PropertyAddress);
                header.Item().Text($"MST: {invoice.PropertyTaxCode ?? "Chưa cập nhật"}");
            });
            page.Content().PaddingVertical(18).Column(content =>
            {
                content.Spacing(8);
                content.Item().AlignCenter().Text("HÓA ĐƠN THANH TOÁN").FontSize(20).Bold();
                content.Item().Text($"Số hóa đơn: {invoice.InvoiceNumber}    Ngày xuất: {invoice.IssuedAtUtc:dd/MM/yyyy}");
                content.Item().Text($"Khách hàng: {invoice.GuestName}");
                content.Item().Text($"Mã đặt phòng tra cứu: {invoice.Reservation?.ConfirmationCode ?? invoice.ReservationId.ToString()}");
                content.Item().Table(table =>
                {
                    table.ColumnsDefinition(columns =>
                    {
                        columns.RelativeColumn(4);
                        columns.RelativeColumn(1);
                        columns.RelativeColumn(2);
                        columns.RelativeColumn(2);
                    });
                    table.Header(row =>
                    {
                        row.Cell().Text("Khoản mục").Bold();
                        row.Cell().AlignRight().Text("SL").Bold();
                        row.Cell().AlignRight().Text("Đơn giá").Bold();
                        row.Cell().AlignRight().Text("Thành tiền").Bold();
                    });
                    foreach (var line in invoice.InvoiceItems.OrderBy(line => line.SortOrder))
                    {
                        table.Cell().Text(line.Description);
                        table.Cell().AlignRight().Text(line.Quantity.ToString());
                        table.Cell().AlignRight().Text(line.UnitPrice.ToString("N0") + " ₫");
                        table.Cell().AlignRight().Text(line.Amount.ToString("N0") + " ₫");
                    }
                });
                content.Item().AlignRight().Column(totals =>
                {
                    totals.Item().Text($"Tạm tính: {invoice.Subtotal:N0} ₫");
                    totals.Item().Text($"Phí dịch vụ: {invoice.ServiceFeeAmount:N0} ₫");
                    totals.Item().Text($"VAT: {invoice.TaxAmount:N0} ₫");
                    totals.Item().Text($"Đã thanh toán: {invoice.PaidAmount:N0} ₫");
                    totals.Item().Text($"Còn phải trả: {invoice.Balance:N0} ₫").Bold();
                });
                content.Item().PaddingTop(24).Row(signatures =>
                {
                    signatures.RelativeItem().AlignCenter().Text("Khách hàng\n(Ký và ghi rõ họ tên)");
                    signatures.RelativeItem().AlignCenter().Text("ĐẠI DIỆN KHÁCH SẠN\n(Ký và đóng dấu)").Bold();
                });
            });
            page.Footer().AlignCenter().Text("Cảm ơn Quý khách đã sử dụng dịch vụ.");
        })).GeneratePdf();
    }

    private Guid? ResolvePropertyId(Guid? requestedPropertyId)
    {
        if (currentUser.IsTenantWide) return requestedPropertyId;
        return currentUser.PropertyId
            ?? throw new InvalidOperationException("Property context is required to export reports.");
    }
}

public sealed record RevenueExportRow(
    string ConfirmationCode,
    string GuestName,
    string PropertyName,
    DateOnly CheckInDate,
    DateOnly CheckOutDate,
    decimal RoomAmount,
    decimal SurchargeAmount,
    decimal VatAmount,
    decimal PaidAmount,
    string Status);
