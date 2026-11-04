using ClosedXML.Excel;
using HotelSaas.Infrastructure.Services;

namespace HotelSaas.Application.Tests.Reports;

public sealed class ReportExportServiceTests
{
    [Fact]
    public void CreateRevenueWorkbook_WritesRowsAndSumFormulas()
    {
        var bytes = ReportExportService.CreateRevenueWorkbook(
            new DateOnly(2026, 10, 1),
            new DateOnly(2026, 10, 31),
            [new RevenueExportRow(
                "RES-001", "Nguyen Van A", "Hotel Demo",
                new DateOnly(2026, 10, 2), new DateOnly(2026, 10, 4),
                2_000_000m, 200_000m, 220_000m, 1_500_000m, "Confirmed")]);

        Assert.NotEmpty(bytes);
        using var workbook = new XLWorkbook(new MemoryStream(bytes));
        var sheet = workbook.Worksheet("Doanh thu");
        Assert.Equal("RES-001", sheet.Cell("A5").GetString());
        Assert.Equal(2_000_000m, sheet.Cell("F5").GetValue<decimal>());
        Assert.Equal(200_000m, sheet.Cell("G5").GetValue<decimal>());
        Assert.Equal(220_000m, sheet.Cell("H5").GetValue<decimal>());
        Assert.Equal(1_500_000m, sheet.Cell("I5").GetValue<decimal>());
        Assert.Equal("SUM(F5:F5)", sheet.Cell("F6").FormulaA1);
        Assert.Equal("SUM(G5:G5)", sheet.Cell("G6").FormulaA1);
        Assert.Equal("SUM(H5:H5)", sheet.Cell("H6").FormulaA1);
        Assert.Equal("SUM(I5:I5)", sheet.Cell("I6").FormulaA1);
    }
}
