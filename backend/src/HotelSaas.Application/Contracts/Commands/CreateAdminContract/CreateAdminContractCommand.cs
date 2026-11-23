using System;
using HotelSaas.Application.Contracts.DTOs;
using MediatR;

namespace HotelSaas.Application.Contracts.Commands.CreateAdminContract;

public sealed record CreateAdminContractCommand(
    Guid TenantId,
    string? ContractNumber,
    string PlanCode,
    string PlanName,
    string ContractType,
    string RepresentativeName,
    string RepresentativeEmail,
    string? RepresentativePhone,
    DateOnly StartDate,
    DateOnly EndDate,
    string BillingCycle,
    decimal ContractValue,
    string? TermsAndConditions,
    string? Notes
) : IRequest<AdminContractDetailDto>;
