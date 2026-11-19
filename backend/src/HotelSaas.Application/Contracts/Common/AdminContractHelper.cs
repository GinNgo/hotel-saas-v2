using System;
using System.Security.Cryptography;
using System.Text;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Contracts.DTOs;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;

namespace HotelSaas.Application.Contracts.Common;

internal static class AdminContractHelper
{
    internal static void EnsureSuperAdmin(ICurrentUserContext currentUser)
    {
        if (currentUser.IsAuthenticated && currentUser.GlobalRole != GlobalUserRole.SuperAdmin)
        {
            throw new ForbiddenException("ERR_FORBIDDEN", "Chỉ Quản trị viên Nền tảng (SuperAdmin) mới có quyền quản lý hợp đồng đối tác.");
        }
    }

    internal static AdminContractSummaryDto ToSummaryDto(TenantContract contract) => new()
    {
        Id = contract.Id,
        TenantId = contract.TenantId,
        TenantName = contract.Tenant?.Name ?? "Đối tác chưa đặt tên",
        ContractNumber = contract.ContractNumber,
        PlanCode = contract.PlanCode,
        PlanName = contract.PlanName,
        ContractType = contract.ContractType,
        RepresentativeName = contract.RepresentativeName,
        RepresentativeEmail = contract.RepresentativeEmail,
        RepresentativePhone = contract.RepresentativePhone,
        StartDate = contract.StartDate,
        EndDate = contract.EndDate,
        BillingCycle = contract.BillingCycle.ToString(),
        ContractValue = contract.ContractValue,
        Status = contract.Status.ToString(),
        SignedAtUtc = contract.SignedAtUtc,
        HasDigitalSignature = !string.IsNullOrEmpty(contract.DigitalSignatureHash),
        DigitalSignatureHash = contract.DigitalSignatureHash,
        Notes = contract.Notes,
        CreatedAtUtc = contract.CreatedAtUtc
    };

    internal static AdminContractDetailDto ToDetailDto(
        TenantContract contract,
        string? tenantName,
        string? tenantCode,
        int activePropertiesCount = 0,
        int activeRoomsCount = 0) => new()
    {
        Id = contract.Id,
        TenantId = contract.TenantId,
        TenantName = tenantName ?? "Đối tác",
        TenantCode = tenantCode ?? string.Empty,
        ContractNumber = contract.ContractNumber,
        PlanCode = contract.PlanCode,
        PlanName = contract.PlanName,
        ContractType = contract.ContractType,
        RepresentativeName = contract.RepresentativeName,
        RepresentativeEmail = contract.RepresentativeEmail,
        RepresentativePhone = contract.RepresentativePhone,
        StartDate = contract.StartDate,
        EndDate = contract.EndDate,
        BillingCycle = contract.BillingCycle.ToString(),
        ContractValue = contract.ContractValue,
        Status = contract.Status.ToString(),
        SignedAtUtc = contract.SignedAtUtc,
        DigitalSignatureHash = contract.DigitalSignatureHash,
        TermsAndConditions = contract.TermsAndConditions,
        Notes = contract.Notes,
        ActivePropertiesCount = activePropertiesCount,
        ActiveRoomsCount = activeRoomsCount,
        CreatedAtUtc = contract.CreatedAtUtc
    };

    internal static BillingCycle ParseBillingCycle(string? rawCycle)
    {
        return rawCycle?.Trim().ToUpperInvariant() switch
        {
            "YEARLY" or "ANNUAL" => BillingCycle.Annual,
            "MONTHLY" => BillingCycle.Monthly,
            _ => Enum.TryParse<BillingCycle>(rawCycle, true, out var cycle) ? cycle : BillingCycle.Monthly
        };
    }

    internal static string GenerateDigitalSignatureHash(string contractNumber, Guid tenantId)
    {
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes($"{contractNumber}-{tenantId}-{DateTime.UtcNow:O}")));
    }
}
