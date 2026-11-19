using System;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Contracts.Common;
using HotelSaas.Application.Contracts.DTOs;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Contracts.Commands.CreateAdminContract;

public sealed class CreateAdminContractCommandHandler : IRequestHandler<CreateAdminContractCommand, AdminContractDetailDto>
{
    private const string DefaultTermsAndConditions =
        "Bên A cung cấp bản quyền sử dụng Nền tảng Quản trị Khách sạn Hotel SaaS Platform v2 theo định mức cam kết. Bên B chịu trách nhiệm thanh toán đúng kỳ hạn và tuân thủ các quy định vận hành an toàn dữ liệu.";

    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserContext _currentUser;

    public CreateAdminContractCommandHandler(IApplicationDbContext context, ICurrentUserContext currentUser)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _currentUser = currentUser ?? throw new ArgumentNullException(nameof(currentUser));
    }

    public async Task<AdminContractDetailDto> Handle(CreateAdminContractCommand request, CancellationToken cancellationToken)
    {
        AdminContractHelper.EnsureSuperAdmin(_currentUser);

        if (request.TenantId == Guid.Empty)
        {
            throw new BadRequestException("ERR_TENANT_REQUIRED", "Cần chọn Khách sạn / Doanh nghiệp đối tác.");
        }

        var tenant = await _context.Tenants
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(t => t.Id == request.TenantId, cancellationToken);

        if (tenant == null)
        {
            throw new BadRequestException("ERR_TENANT_NOT_FOUND", "Không tìm thấy Khách sạn / Doanh nghiệp đối tác.");
        }

        var contractNo = string.IsNullOrWhiteSpace(request.ContractNumber)
            ? $"HD-{DateTime.UtcNow:yyyyMM}-{Random.Shared.Next(1000, 9999)}"
            : request.ContractNumber.Trim().ToUpperInvariant();

        var now = DateTime.UtcNow;
        var contract = new TenantContract
        {
            Id = Guid.NewGuid(),
            TenantId = request.TenantId,
            ContractNumber = contractNo,
            PlanCode = (request.PlanCode ?? "PRO").Trim().ToUpperInvariant(),
            PlanName = (request.PlanName ?? string.Empty).Trim(),
            ContractType = string.IsNullOrWhiteSpace(request.ContractType) ? "Standard" : request.ContractType.Trim(),
            RepresentativeName = (request.RepresentativeName ?? string.Empty).Trim(),
            RepresentativeEmail = (request.RepresentativeEmail ?? string.Empty).Trim(),
            RepresentativePhone = request.RepresentativePhone?.Trim() ?? string.Empty,
            StartDate = request.StartDate,
            EndDate = request.EndDate > request.StartDate ? request.EndDate : request.StartDate.AddMonths(12),
            BillingCycle = AdminContractHelper.ParseBillingCycle(request.BillingCycle),
            ContractValue = request.ContractValue,
            Status = TenantContractStatus.Active,
            SignedAtUtc = now,
            DigitalSignatureHash = AdminContractHelper.GenerateDigitalSignatureHash(contractNo, request.TenantId),
            TermsAndConditions = string.IsNullOrWhiteSpace(request.TermsAndConditions)
                ? DefaultTermsAndConditions
                : request.TermsAndConditions.Trim(),
            Notes = request.Notes?.Trim(),
            CreatedAtUtc = now
        };

        _context.TenantContracts.Add(contract);
        await _context.SaveChangesAsync(cancellationToken);

        return AdminContractHelper.ToDetailDto(contract, tenant.Name, tenant.Code);
    }
}
