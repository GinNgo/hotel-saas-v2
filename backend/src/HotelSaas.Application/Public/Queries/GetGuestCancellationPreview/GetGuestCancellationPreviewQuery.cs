using HotelSaas.Application.Public.DTOs;
using MediatR;

namespace HotelSaas.Application.Public.Queries.GetGuestCancellationPreview;

/// <summary>
/// Previews the financial and policy impact of cancelling a booking via lookup token.
/// Completely read-only (no DB writes or financial side effects).
/// </summary>
public sealed record GetGuestCancellationPreviewQuery(string LookupToken) : IRequest<GuestCancellationPreviewDto>;

