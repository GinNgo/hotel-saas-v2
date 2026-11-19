using System;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;

namespace HotelSaas.Application.Reports.Common;

internal static class ReportScopeHelper
{
    internal static Guid EnsureTenantId(ICurrentUserContext currentUser, string message = "Yêu cầu ngữ cảnh khách sạn hợp lệ.")
    {
        var tenantId = currentUser.TenantId;
        if (!tenantId.HasValue || tenantId.Value == Guid.Empty)
        {
            throw new BadRequestException("ERR_TENANT_REQUIRED", message);
        }

        return tenantId.Value;
    }

    internal static Guid? ResolveScopedPropertyId(ICurrentUserContext currentUser, Guid? propertyId)
    {
        if (currentUser.IsTenantWide)
        {
            return propertyId.HasValue && propertyId.Value != Guid.Empty
                ? propertyId.Value
                : null;
        }

        if (!currentUser.PropertyId.HasValue || currentUser.PropertyId.Value == Guid.Empty)
        {
            throw new ForbiddenException(
                "ERR_PROPERTY_REQUIRED",
                "Yêu cầu ngữ cảnh chi nhánh hợp lệ để truy cập báo cáo.");
        }

        if (propertyId.HasValue &&
            propertyId.Value != Guid.Empty &&
            propertyId.Value != currentUser.PropertyId.Value)
        {
            throw new ForbiddenException(
                "ERR_PROPERTY_FORBIDDEN",
                "Nhân viên chi nhánh không được phép truy cập báo cáo của chi nhánh khác.");
        }

        return currentUser.PropertyId.Value;
    }

    internal static string EscapeCsv(string value)
    {
        if (string.IsNullOrEmpty(value)) return string.Empty;
        return value.Replace("\"", "\"\"");
    }
}
