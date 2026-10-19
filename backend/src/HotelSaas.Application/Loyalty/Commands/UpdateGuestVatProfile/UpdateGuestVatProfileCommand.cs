using MediatR;

namespace HotelSaas.Application.Loyalty.Commands.UpdateGuestVatProfile;

public sealed record UpdateGuestVatProfileCommand(
    string? CompanyName,
    string? CompanyTaxCode,
    string? CompanyAddress
) : IRequest<bool>;
