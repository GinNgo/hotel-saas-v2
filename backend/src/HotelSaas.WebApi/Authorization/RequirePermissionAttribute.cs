using Microsoft.AspNetCore.Authorization;

namespace HotelSaas.WebApi.Authorization;

/// <summary>
/// Declarative attribute that enforces a bitmask permission check on an endpoint.
/// Combines <see cref="AuthorizeAttribute"/> with <see cref="IAuthorizationRequirementData"/>
/// to produce a <see cref="PermissionRequirement"/>.
/// </summary>
/// <example>
/// <code>[RequirePermission("ROOMS", PermissionAction.Create)]</code>
/// </example>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = true)]
public sealed class RequirePermissionAttribute : AuthorizeAttribute, IAuthorizationRequirementData
{
    private readonly (string FunctionCode, int RequiredAction)[]? _alternativePermissions;

    /// <summary>
    /// Initializes a new <see cref="RequirePermissionAttribute"/>.
    /// </summary>
    /// <param name="functionCode">The permission function code (e.g., "ROOMS").</param>
    /// <param name="requiredAction">The bitmask action required (e.g., <see cref="PermissionAction.Read"/>).</param>
    public RequirePermissionAttribute(string functionCode, int requiredAction)
    {
        FunctionCode = functionCode;
        RequiredAction = requiredAction;
    }

    /// <summary>
    /// Initializes a new <see cref="RequirePermissionAttribute"/> allowing any one of two alternative permissions (OR semantics).
    /// </summary>
    public RequirePermissionAttribute(
        string functionCode,
        int requiredAction,
        string alternativeFunctionCode,
        int alternativeRequiredAction)
    {
        FunctionCode = functionCode;
        RequiredAction = requiredAction;
        _alternativePermissions = new[]
        {
            (functionCode, requiredAction),
            (alternativeFunctionCode, alternativeRequiredAction)
        };
    }

    /// <summary>The permission function code.</summary>
    public string FunctionCode { get; }

    /// <summary>The required bitmask action.</summary>
    public int RequiredAction { get; }

    /// <inheritdoc />
    public IEnumerable<IAuthorizationRequirement> GetRequirements()
    {
        yield return _alternativePermissions is { Length: > 1 }
            ? new PermissionRequirement(_alternativePermissions)
            : new PermissionRequirement(FunctionCode, RequiredAction);
    }
}
