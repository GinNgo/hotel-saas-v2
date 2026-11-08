using HotelSaas.Application.Auth.DTOs;
using MediatR;

namespace HotelSaas.Application.Auth.Commands.VerifyPhoneFirebase;

/// <summary>
/// Authenticates or links a user via Firebase SMS Phone Authentication (Google Identity Platform).
/// </summary>
/// <param name="FirebaseIdToken">The cryptographic ID token issued by Firebase after client SMS OTP confirmation.</param>
/// <param name="FullName">Optional full name when auto-provisioning a new customer account.</param>
public sealed record VerifyPhoneFirebaseCommand(
    string FirebaseIdToken,
    string? FullName = null
) : IRequest<LoginResponse>;
