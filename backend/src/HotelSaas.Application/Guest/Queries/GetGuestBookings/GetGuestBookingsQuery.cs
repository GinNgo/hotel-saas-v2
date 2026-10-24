using HotelSaas.Application.Common.Models;
using HotelSaas.Application.Guest.DTOs;
using MediatR;

namespace HotelSaas.Application.Guest.Queries.GetGuestBookings;

public sealed record GetGuestBookingsQuery(int Page = 1, int PageSize = 10) : IRequest<PagedResult<GuestBookingSummaryDto>>;
