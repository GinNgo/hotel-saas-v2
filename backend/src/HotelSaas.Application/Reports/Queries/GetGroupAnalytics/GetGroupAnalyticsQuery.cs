using System;
using HotelSaas.Application.Common.Models;
using MediatR;

namespace HotelSaas.Application.Reports.Queries.GetGroupAnalytics;

/// <summary>
/// Truy vấn chỉ số kinh doanh, công suất và doanh thu hợp nhất cho toàn chuỗi khách sạn của Tenant.
/// </summary>
public sealed record GetGroupAnalyticsQuery(
    DateOnly? FromDate = null,
    DateOnly? ToDate = null
) : IRequest<ApiResponse<GroupAnalyticsDto>>;
