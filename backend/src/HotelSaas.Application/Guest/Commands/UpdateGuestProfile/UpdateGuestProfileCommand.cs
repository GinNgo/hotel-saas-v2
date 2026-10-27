using HotelSaas.Application.Guest.DTOs;
using MediatR;

namespace HotelSaas.Application.Guest.Commands.UpdateGuestProfile;

public sealed record UpdateGuestProfileCommand(string FullName) : IRequest<GuestMeDto>;
