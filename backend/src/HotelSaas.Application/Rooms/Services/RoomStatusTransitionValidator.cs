using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Domain.Enums;

namespace HotelSaas.Application.Rooms.Services;

/// <summary>
/// Validates room housekeeping and readiness state transitions according to P2A business specifications.
/// </summary>
public static class RoomStatusTransitionValidator
{
    /// <summary>
    /// Checks whether a transition between two room statuses is allowed for direct housekeeping / operations.
    /// </summary>
    /// <param name="currentStatus">The current status of the room.</param>
    /// <param name="newStatus">The proposed new status for the room.</param>
    /// <returns><c>true</c> if valid; otherwise <c>false</c>.</returns>
    public static bool IsValidTransition(RoomStatus currentStatus, RoomStatus newStatus)
    {
        // Direct operational update can NEVER transition to or from Occupied.
        // Occupied is strictly managed by P3 Check-In and Check-Out reservation workflows.
        if (currentStatus == RoomStatus.Occupied || newStatus == RoomStatus.Occupied)
        {
            return false;
        }

        if (currentStatus == newStatus)
        {
            return true;
        }

        return currentStatus switch
        {
            RoomStatus.Clean => newStatus is RoomStatus.Dirty or RoomStatus.Cleaning or RoomStatus.OutOfService,
            RoomStatus.Dirty => newStatus is RoomStatus.Cleaning or RoomStatus.OutOfService,
            RoomStatus.Cleaning => newStatus is RoomStatus.Clean or RoomStatus.Dirty or RoomStatus.OutOfService,
            RoomStatus.OutOfService => newStatus is RoomStatus.Dirty,
            _ => false
        };
    }

    /// <summary>
    /// Validates the transition and throws a <see cref="BadRequestException"/> if the transition is prohibited.
    /// </summary>
    /// <param name="currentStatus">The current status of the room.</param>
    /// <param name="newStatus">The proposed new status.</param>
    public static void Validate(RoomStatus currentStatus, RoomStatus newStatus)
    {
        if (currentStatus == RoomStatus.Occupied)
        {
            throw new BadRequestException(
                "ERR_INVALID_STATUS_TRANSITION",
                "Phòng đang có khách lưu trú (Occupied). Trạng thái chỉ được thay đổi khi thực hiện thủ tục trả phòng (Check-out).");
        }

        if (newStatus == RoomStatus.Occupied)
        {
            throw new BadRequestException(
                "ERR_INVALID_STATUS_TRANSITION",
                "Không thể chuyển trực tiếp sang trạng thái Đang có khách (Occupied). Trạng thái này chỉ được kích hoạt khi nhận phòng (Check-in).");
        }

        if (currentStatus == RoomStatus.Dirty && newStatus == RoomStatus.Clean)
        {
            throw new BadRequestException(
                "ERR_INVALID_STATUS_TRANSITION",
                "Phòng bẩn (Dirty) không thể chuyển thẳng sang Phòng sạch (Clean). Bắt buộc phải qua trạng thái Đang dọn dẹp (Cleaning).");
        }

        if (currentStatus == RoomStatus.OutOfService && newStatus == RoomStatus.Clean)
        {
            throw new BadRequestException(
                "ERR_INVALID_STATUS_TRANSITION",
                "Phòng ngừng phục vụ (OutOfService) không thể chuyển thẳng sang Phòng sạch (Clean). Bắt buộc chuyển sang Phòng bẩn (Dirty) để dọn dẹp trước.");
        }

        if (currentStatus == RoomStatus.OutOfService && newStatus == RoomStatus.Cleaning)
        {
            throw new BadRequestException(
                "ERR_INVALID_STATUS_TRANSITION",
                "Phòng ngừng phục vụ (OutOfService) không thể chuyển thẳng sang Đang dọn dẹp (Cleaning). Bắt buộc chuyển sang Phòng bẩn (Dirty) để ghi nhận dọn dẹp.");
        }

        if (!IsValidTransition(currentStatus, newStatus))
        {
            throw new BadRequestException(
                "ERR_INVALID_STATUS_TRANSITION",
                $"Không được phép chuyển trạng thái phòng từ '{currentStatus}' sang '{newStatus}'.");
        }
    }
}
