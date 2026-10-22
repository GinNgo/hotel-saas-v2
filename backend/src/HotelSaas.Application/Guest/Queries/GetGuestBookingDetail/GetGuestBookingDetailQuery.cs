using System;
using HotelSaas.Application.Guest.DTOs;
using MediatR;

namespace HotelSaas.Application.Guest.Queries.GetGuestBookingDetail;

public sealed record GetGuestBookingDetailQuery(Guid Id) : IRequest<GuestBookingDetailDto>;
