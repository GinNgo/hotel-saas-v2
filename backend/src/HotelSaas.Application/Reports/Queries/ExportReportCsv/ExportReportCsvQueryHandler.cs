using System;
using System.Globalization;
using System.Linq;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Reports.Common;
using HotelSaas.Application.Reports.DTOs;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Reports.Queries.ExportReportCsv;

public sealed class ExportReportCsvQueryHandler : IRequestHandler<ExportReportCsvQuery, ExportedReportFileDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserContext _currentUser;

    public ExportReportCsvQueryHandler(IApplicationDbContext context, ICurrentUserContext currentUser)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _currentUser = currentUser ?? throw new ArgumentNullException(nameof(currentUser));
    }

    public async Task<ExportedReportFileDto> Handle(ExportReportCsvQuery request, CancellationToken cancellationToken)
    {
        var tenantId = ReportScopeHelper.EnsureTenantId(_currentUser);
        var effectivePropertyId = ReportScopeHelper.ResolveScopedPropertyId(_currentUser, request.PropertyId);

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var effectiveFrom = request.FromDate ?? today.AddDays(-30);
        var effectiveTo = request.ToDate ?? today;

        var query = _context.Reservations
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Include(r => r.Property)
            .Include(r => r.Room)
            .Where(r => r.TenantId == tenantId &&
                        r.CheckInDate <= effectiveTo &&
                        r.CheckOutDate >= effectiveFrom);

        if (effectivePropertyId.HasValue)
        {
            query = query.Where(r => r.PropertyId == effectivePropertyId.Value);
        }

        var list = await query
            .OrderByDescending(r => r.CreatedAtUtc)
            .ToListAsync(cancellationToken);

        var sb = new StringBuilder();
        sb.AppendLine("Mã Đặt Phòng,Khách Hàng,Email,Số Điện Thoại,Chi Nhánh,Số Phòng,Ngày Nhận Phòng,Ngày Trả Phòng,Số Khách,Tổng Tiền (VND),Trạng Thái,Ngày Tạo");

        foreach (var r in list)
        {
            var statusText = r.Status switch
            {
                ReservationStatus.PendingPayment => "Chờ thanh toán",
                ReservationStatus.Confirmed => "Đã xác nhận",
                ReservationStatus.CheckedIn => "Đang ở",
                ReservationStatus.CheckedOut => "Đã trả phòng",
                ReservationStatus.Cancelled => "Đã hủy",
                ReservationStatus.NoShow => "Vắng mặt",
                _ => r.Status.ToString()
            };

            var line = string.Format(
                CultureInfo.InvariantCulture,
                "\"{0}\",\"{1}\",\"{2}\",\"{3}\",\"{4}\",\"{5}\",\"{6}\",\"{7}\",{8},{9},\"{10}\",\"{11}\"",
                ReportScopeHelper.EscapeCsv(r.ConfirmationCode),
                ReportScopeHelper.EscapeCsv(r.GuestName),
                ReportScopeHelper.EscapeCsv(r.GuestEmail),
                ReportScopeHelper.EscapeCsv(r.GuestPhone ?? string.Empty),
                ReportScopeHelper.EscapeCsv(r.Property?.Name ?? "Chi nhánh"),
                ReportScopeHelper.EscapeCsv(r.Room?.RoomNumber ?? "Chưa chỉ định"),
                r.CheckInDate.ToString("dd/MM/yyyy"),
                r.CheckOutDate.ToString("dd/MM/yyyy"),
                r.NumberOfGuests,
                r.TotalAmount.ToString("F0", CultureInfo.InvariantCulture),
                statusText,
                r.CreatedAtUtc.ToString("dd/MM/yyyy HH:mm")
            );

            sb.AppendLine(line);
        }

        var preamble = Encoding.UTF8.GetPreamble();
        var contentBytes = Encoding.UTF8.GetBytes(sb.ToString());
        var fullBytes = new byte[preamble.Length + contentBytes.Length];
        Buffer.BlockCopy(preamble, 0, fullBytes, 0, preamble.Length);
        Buffer.BlockCopy(contentBytes, 0, fullBytes, preamble.Length, contentBytes.Length);

        var filename = $"BaoCao_DoanhThu_{effectiveFrom:yyyyMMdd}_{effectiveTo:yyyyMMdd}.csv";
        return new ExportedReportFileDto(fullBytes, "text/csv; charset=utf-8", filename);
    }
}
