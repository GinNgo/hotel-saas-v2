namespace HotelSaas.Domain.Enums;

/// <summary>
/// Defines the surcharge category for overnight stays outside standard check-in and check-out windows.
/// </summary>
public enum SurchargeType
{
    /// <summary>
    /// Surcharge applied when guest checks in earlier than standard property CheckInTime.
    /// </summary>
    EarlyCheckIn = 1,

    /// <summary>
    /// Surcharge applied when guest checks out later than standard property CheckOutTime.
    /// </summary>
    LateCheckOut = 2
}
