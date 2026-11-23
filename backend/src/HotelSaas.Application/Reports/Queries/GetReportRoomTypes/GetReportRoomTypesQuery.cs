using System;
using System.Collections.Generic;
using HotelSaas.Application.Reports.DTOs;
using MediatR;

namespace HotelSaas.Application.Reports.Queries.GetReportRoomTypes;

public sealed record GetReportRoomTypesQuery(Guid? PropertyId = null) : IRequest<List<ReportRoomTypeItemDto>>;
