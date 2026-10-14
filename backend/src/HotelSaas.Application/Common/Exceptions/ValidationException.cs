namespace HotelSaas.Application.Common.Exceptions;

/// <summary>
/// Exception thrown when one or more FluentValidation failures occur.
/// </summary>
public sealed class ValidationException : Exception
{
    /// <summary>
    /// Dictionary mapping property names to their validation error messages.
    /// </summary>
    public IDictionary<string, string[]> Errors { get; }

    /// <summary>
    /// Initializes a new instance of <see cref="ValidationException"/>.
    /// </summary>
    public ValidationException()
        : base("One or more validation failures have occurred.")
    {
        Errors = new Dictionary<string, string[]>();
    }

    /// <summary>
    /// Initializes a new instance with FluentValidation failures.
    /// </summary>
    public ValidationException(IEnumerable<FluentValidation.Results.ValidationFailure> failures)
        : this()
    {
        Errors = failures
            .GroupBy(e => e.PropertyName, e => e.ErrorMessage)
            .ToDictionary(g => g.Key, g => g.ToArray());
    }
}
