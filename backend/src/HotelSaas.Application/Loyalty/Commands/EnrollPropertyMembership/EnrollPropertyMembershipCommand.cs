using System;
using HotelSaas.Application.Loyalty.DTOs;
using MediatR;

namespace HotelSaas.Application.Loyalty.Commands.EnrollPropertyMembership;

public sealed record EnrollPropertyMembershipCommand(Guid PropertyId) : IRequest<GuestLoyaltyMembershipDto>;
