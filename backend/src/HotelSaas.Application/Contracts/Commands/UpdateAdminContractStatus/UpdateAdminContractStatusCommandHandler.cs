using System;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Contracts.Common;
using HotelSaas.Application.Contracts.DTOs;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Contracts.Commands.UpdateAdminContractStatus;

public sealed class UpdateAdminContractStatusCommandHandler : IRequestHandler<UpdateAdminContractStatusCommand, AdminContractSummaryDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserContext _currentUser;

    public UpdateAdminContractStatusCommandHandler(IApplicationDbContext context, ICurrentUserContext currentUser)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _currentUser = currentUser ?? throw new ArgumentNullException(nameof(currentUser));
    }

    public async Task<AdminContractSummaryDto> Handle(UpdateAdminContractStatusCommand request, CancellationToken cancellationToken)
    {
        AdminContractHelper.EnsureSuperAdmin(_currentUser);

        if (string.IsNullOrWhiteSpace(request.Status) ||
            !Enum.TryParse<TenantContractStatus>(request.Status, true, out var newStatus) ||
            !Enum.IsDefined(typeof(TenantContractStatus), newStatus))
        {
            throw new BadRequestException("ERR_INVALID_STATUS", "Trạng thái hợp đồng không hợp lệ.");
        }

        var contract = await _context.TenantContracts
            .IgnoreQueryFilters()
            .Include(c => c.Tenant)
            .FirstOrDefaultAsync(c => c.Id == request.Id, cancellationToken);

        if (contract == null)
        {
            throw new NotFoundException("Không tìm thấy hợp đồng.");
        }

        contract.Status = newStatus;
        if (newStatus == TenantContractStatus.Active && !contract.SignedAtUtc.HasValue)
        {
            contract.SignedAtUtc = DateTime.UtcNow;
            contract.DigitalSignatureHash = AdminContractHelper.GenerateDigitalSignatureHash(contract.ContractNumber, contract.TenantId);
        }

        var effectiveNote = !string.IsNullOrWhiteSpace(request.Note) ? request.Note : request.Notes;
        if (!string.IsNullOrWhiteSpace(effectiveNote))
        {
            var trimmedNote = effectiveNote.Trim();
            contract.Notes = string.IsNullOrWhiteSpace(contract.Notes)
                ? $"[{DateTime.UtcNow:dd/MM/yyyy HH:mm}] {trimmedNote}"
                : $"{contract.Notes}\n[{DateTime.UtcNow:dd/MM/yyyy HH:mm}] {trimmedNote}";
        }

        contract.UpdatedAtUtc = DateTime.UtcNow;
        await _context.SaveChangesAsync(cancellationToken);

        return AdminContractHelper.ToSummaryDto(contract);
    }
}
