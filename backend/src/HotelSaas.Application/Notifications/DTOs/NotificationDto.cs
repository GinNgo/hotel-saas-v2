using System;
using HotelSaas.Domain.Enums;

namespace HotelSaas.Application.Notifications.DTOs;

public sealed record NotificationDto(
    Guid Id,
    Guid TenantId,
    Guid UserId,
    NotificationType Type,
    string TypeName,
    string Title,
    string Message,
    bool IsRead,
    DateTime? ReadAtUtc,
    string? Data,
    Guid? RelatedEntityId,
    string? RelatedEntityType,
    DateTime CreatedAtUtc
);

public sealed record UnreadNotificationCountDto(int UnreadCount);

public sealed record MarkAllNotificationsReadResultDto(int UpdatedCount);
