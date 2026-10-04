using Microsoft.AspNetCore.Authorization;

namespace HotelSaas.WebApi.Authorization;

/// <summary>
/// Authorization requirement that demands a specific bitmask action
/// on a named permission function (e.g., ROOMS + Read).
/// </summary>
public sealed class PermissionRequirement : IAuthorizationRequirement
{
    /// <summary>
    /// Initializes a new <see cref="PermissionRequirement"/>.
    /// </summary>
    /// <param name="functionCode">The permission function code (e.g., "ROOMS").</param>
    /// <param name="requiredAction">The bitmask action required (e.g., <see cref="PermissionAction.Read"/>).</param>
    public PermissionRequirement(string functionCode, int requiredAction)
    {
        FunctionCode = functionCode;
        RequiredAction = requiredAction;
    }

    /// <summary>
    /// The permission function code that must be granted to the user's role.
    /// </summary>
    public string FunctionCode { get; }

    /// <summary>
    /// The bitmask action that must be present in the role's <c>ActionMask</c>.
    /// </summary>
    public int RequiredAction { get; }
}
