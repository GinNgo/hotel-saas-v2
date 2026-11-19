using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Subscriptions.Common;
using HotelSaas.Application.Subscriptions.DTOs;
using MediatR;

namespace HotelSaas.Application.Subscriptions.Queries.GetSubscriptionPlans;

public sealed record GetSubscriptionPlansQuery : IRequest<IReadOnlyList<SubscriptionPlanCatalogDto>>;

public sealed class GetSubscriptionPlansQueryHandler
    : IRequestHandler<GetSubscriptionPlansQuery, IReadOnlyList<SubscriptionPlanCatalogDto>>
{
    private readonly IApplicationDbContext _context;

    public GetSubscriptionPlansQueryHandler(IApplicationDbContext context)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
    }

    public async Task<IReadOnlyList<SubscriptionPlanCatalogDto>> Handle(
        GetSubscriptionPlansQuery request,
        CancellationToken cancellationToken)
    {
        return await SubscriptionCatalogHelper.LoadCatalogAsync(_context, activeOnly: true, cancellationToken);
    }
}
