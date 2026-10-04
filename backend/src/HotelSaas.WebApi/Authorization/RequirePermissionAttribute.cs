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

    /// <summary>The permission function code.</summary>
    public string FunctionCode { get; }

    /// <summary>The required bitmask action.</summary>
    public int RequiredAction { get; }

    /// <inheritdoc />
    public IEnumerable<IAuthorizationRequirement> GetRequirements()
    {
        yield return new PermissionRequirement(FunctionCode, RequiredAction);
    }
}
