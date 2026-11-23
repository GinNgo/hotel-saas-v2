using System;
using HotelSaas.Application.Print.DTOs;
using MediatR;

namespace HotelSaas.Application.Print.Commands.SavePrintTemplateConfig;

public sealed record SavePrintTemplateConfigCommand(
    Guid TenantId,
    Guid? BodyPropertyId,
    Guid? QueryPropertyId,
    string HeaderCompanyName,
    string HeaderAddress,
    string TaxNumber,
    string Hotline,
    string? LogoUrl,
    string BankName,
    string BankAccountNumber,
    string BankAccountHolder,
    string FooterNote,
    string CheckInPolicyText,
    bool ShowVietQrCode,
    string DefaultPaperSize,
    string? SepayApiKey = null
) : IRequest<PrintTemplateSettingsDto>;
