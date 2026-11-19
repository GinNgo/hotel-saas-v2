using System;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Print.DTOs;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Print.Queries.GetPrintableContract;

public sealed class GetPrintableContractQueryHandler : IRequestHandler<GetPrintableContractQuery, PrintableContractDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserContext _currentUser;

    public GetPrintableContractQueryHandler(IApplicationDbContext context, ICurrentUserContext currentUser)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _currentUser = currentUser ?? throw new ArgumentNullException(nameof(currentUser));
    }

    public async Task<PrintableContractDto> Handle(GetPrintableContractQuery request, CancellationToken cancellationToken)
    {
        var contract = await _context.TenantContracts
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Include(c => c.Tenant)
            .FirstOrDefaultAsync(c => c.Id == request.ContractId, cancellationToken);

        if (contract == null)
        {
            throw new NotFoundException("Không tìm thấy hợp đồng.");
        }

        if (_currentUser.GlobalRole != GlobalUserRole.SuperAdmin &&
            (!_currentUser.TenantId.HasValue || _currentUser.TenantId.Value != contract.TenantId))
        {
            throw new ForbiddenException("ERR_FORBIDDEN", "Bạn không có quyền truy cập hợp đồng của doanh nghiệp khác.");
        }

        var propertiesCount = await _context.Properties
            .IgnoreQueryFilters()
            .AsNoTracking()
            .CountAsync(p => p.TenantId == contract.TenantId, cancellationToken);

        var roomsCount = await _context.Rooms
            .IgnoreQueryFilters()
            .AsNoTracking()
            .CountAsync(r => r.TenantId == contract.TenantId, cancellationToken);

        var isSigned = contract.SignedAtUtc.HasValue && !string.IsNullOrWhiteSpace(contract.DigitalSignatureHash);

        return new PrintableContractDto
        {
            ContractId = contract.Id,
            ContractNumber = contract.ContractNumber,
            CreatedAtUtc = contract.CreatedAtUtc,
            SignedDate = contract.SignedAtUtc ?? contract.CreatedAtUtc,
            SignedAtUtc = contract.SignedAtUtc,
            Status = contract.Status.ToString(),
            IsSigned = isSigned,
            StartDate = contract.StartDate,
            EndDate = contract.EndDate,
            PlatformCompanyName = "CÔNG TY CỔ PHẦN CÔNG NGHỆ NỀN TẢNG KHÁCH SẠN HOTEL SAAS VIỆT NAM",
            PlatformAddress = "Tầng 18, Tòa nhà Innovation Hub, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh",
            PlatformTaxCode = "0318889999",
            PlatformHotline = "1900 8899",
            PlatformRepresentative = "Đại diện Pháp luật Nền tảng Hotel SaaS",
            TenantCompanyName = contract.Tenant?.Name ?? "Doanh Nghiệp Đối Tác",
            TenantCode = contract.Tenant?.Code ?? "TENANT",
            TenantRepresentative = contract.RepresentativeName,
            TenantEmail = contract.RepresentativeEmail,
            TenantPhone = contract.RepresentativePhone,
            TenantAddress = !string.IsNullOrWhiteSpace(contract.Tenant?.Address)
                ? contract.Tenant!.Address
                : "Địa chỉ trụ sở chính theo Giấy chứng nhận đăng ký doanh nghiệp",
            PlanCode = contract.PlanCode,
            PlanName = contract.PlanName,
            ContractType = contract.ContractType,
            BillingCycle = contract.BillingCycle.ToString(),
            ContractValue = contract.ContractValue,
            MaxPropertiesAllowed = propertiesCount > 0 ? propertiesCount : 3,
            MaxRoomsAllowed = roomsCount > 0 ? roomsCount : 50,
            DigitalSignatureHash = isSigned ? contract.DigitalSignatureHash! : string.Empty,
            TermsAndConditions = contract.TermsAndConditions ?? "Toàn bộ điều khoản cam kết mức độ dịch vụ (SLA 99.9%) và chính sách bảo mật dữ liệu khách sạn."
        };
    }
}
