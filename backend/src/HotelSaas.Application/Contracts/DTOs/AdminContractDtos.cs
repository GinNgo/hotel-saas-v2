using System;

namespace HotelSaas.Application.Contracts.DTOs;

public sealed class AdminContractSummaryDto
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public string TenantName { get; set; } = string.Empty;
    public string ContractNumber { get; set; } = string.Empty;
    public string PlanCode { get; set; } = string.Empty;
    public string PlanName { get; set; } = string.Empty;
    public string ContractType { get; set; } = string.Empty;
    public string RepresentativeName { get; set; } = string.Empty;
    public string RepresentativeEmail { get; set; } = string.Empty;
    public string RepresentativePhone { get; set; } = string.Empty;
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public string BillingCycle { get; set; } = string.Empty;
    public decimal ContractValue { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime? SignedAtUtc { get; set; }
    public bool HasDigitalSignature { get; set; }
    public string? DigitalSignatureHash { get; set; }
    public string? Notes { get; set; }
    public DateTime CreatedAtUtc { get; set; }
}

public sealed class AdminContractDetailDto
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public string TenantName { get; set; } = string.Empty;
    public string TenantCode { get; set; } = string.Empty;
    public string ContractNumber { get; set; } = string.Empty;
    public string PlanCode { get; set; } = string.Empty;
    public string PlanName { get; set; } = string.Empty;
    public string ContractType { get; set; } = string.Empty;
    public string RepresentativeName { get; set; } = string.Empty;
    public string RepresentativeEmail { get; set; } = string.Empty;
    public string RepresentativePhone { get; set; } = string.Empty;
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public string BillingCycle { get; set; } = string.Empty;
    public decimal ContractValue { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime? SignedAtUtc { get; set; }
    public string? DigitalSignatureHash { get; set; }
    public string? TermsAndConditions { get; set; }
    public string? Notes { get; set; }
    public int ActivePropertiesCount { get; set; }
    public int ActiveRoomsCount { get; set; }
    public DateTime CreatedAtUtc { get; set; }
}
