using HotelSaas.Application.Loyalty.DTOs;
using MediatR;

namespace HotelSaas.Application.Loyalty.Queries.GetMyGuestProfile;

public sealed record GetMyGuestProfileQuery : IRequest<GuestProfileResponseDto>;
