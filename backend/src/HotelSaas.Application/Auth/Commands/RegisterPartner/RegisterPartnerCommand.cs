using HotelSaas.Application.Auth.DTOs;
using MediatR;

namespace HotelSaas.Application.Auth.Commands.RegisterPartner;

/// <summary>
/// Command to register a new hotel business partner or upgrade an existing customer account,
/// creating the enterprise tenant, the primary property branch with 2-level administrative location mapping,
/// and granting owner administrative privileges.
/// </summary>
public sealed record RegisterPartnerCommand(
    string FullName,
    string Email,
    string? Password,
    string PhoneNumber,
    string PropertyName,
    string Address,
    string ProvinceCode,
    string? WardCode) : IRequest<RegisterPartnerResponse>;
