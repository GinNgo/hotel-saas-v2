namespace HotelSaas.Application.Common.Exceptions;

/// <summary>
/// Exception thrown when a business rule precondition is not met (HTTP 422 Unprocessable Entity).
/// Standardized for scenarios like ERR_PRICING_NOT_CONFIGURED, ERR_SURCHARGE_NOT_CONFIGURED, and ERR_HOURLY_LIMIT_EXCEEDED.
/// </summary>
public sealed class UnprocessableEntityException : Exception
{
    /// <summary>
    /// Standardized error code identifier.
    /// </summary>
    public string ErrorCode { get; }

    /// <summary>
    /// Initializes a new instance of <see cref="UnprocessableEntityException"/>.
    /// </summary>
    /// <param name="errorCode">Machine-readable error code.</param>
    /// <param name="message">User-friendly error message.</param>
    public UnprocessableEntityException(string errorCode, string message)
        : base(message)
    {
        ErrorCode = errorCode;
    }
}
