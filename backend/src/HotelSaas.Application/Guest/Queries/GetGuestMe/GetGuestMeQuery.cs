using HotelSaas.Application.Guest.DTOs;
using MediatR;

namespace HotelSaas.Application.Guest.Queries.GetGuestMe;

public sealed record GetGuestMeQuery : IRequest<GuestMeDto>;
