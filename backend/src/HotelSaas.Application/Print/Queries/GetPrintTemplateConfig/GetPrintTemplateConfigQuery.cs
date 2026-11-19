using System;
using HotelSaas.Application.Print.DTOs;
using MediatR;

namespace HotelSaas.Application.Print.Queries.GetPrintTemplateConfig;

public sealed record GetPrintTemplateConfigQuery(
    Guid? TenantId = null,
    Guid? PropertyId = null
) : IRequest<PrintTemplateSettingsDto>;
