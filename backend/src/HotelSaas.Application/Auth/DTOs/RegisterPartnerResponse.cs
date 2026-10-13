using System;

namespace HotelSaas.Application.Auth.DTOs;

/// <summary>
/// Data transfer object returned upon successful partner hotel registration and onboarding.
/// </summary>
public sealed record RegisterPartnerResponse(
    Guid UserId,
    Guid TenantId,
    Guid PropertyId,
    string PropertyName,
    string Message);
