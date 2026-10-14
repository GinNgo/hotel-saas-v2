using System;
using System.Collections.Generic;
using System.Linq;
using Microsoft.AspNetCore.Authorization;

namespace HotelSaas.WebApi.Authorization;

/// <summary>
/// Declarative attribute that enforces an OR permission check on an endpoint.
/// The user must possess at least one of the specified (FunctionCode, RequiredAction) pairs.
/// </summary>
/// <example>
/// <code>[RequireAnyPermission("ROOMS", PermissionAction.Read, "RESERVATIONS", PermissionAction.Read)]</code>
/// </example>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = true)]
public sealed class RequireAnyPermissionAttribute : AuthorizeAttribute, IAuthorizationRequirementData
{
    private readonly (string FunctionCode, int RequiredAction)[] _permissions;

    /// <summary>
    /// Enforces that the user has either (func1 with action1) OR (func2 with action2).
    /// </summary>
    public RequireAnyPermissionAttribute(string func1, int action1, string func2, int action2)
    {
        _permissions = new[] { (func1, action1), (func2, action2) };
    }

    /// <summary>
    /// Enforces that the user has Read permission on ANY of the specified function codes.
    /// </summary>
    public RequireAnyPermissionAttribute(params string[] functionCodes)
    {
        _permissions = functionCodes.Select(code => (code, PermissionAction.Read)).ToArray();
    }

    /// <summary>
    /// Returns the composite <see cref="PermissionRequirement"/> representing the OR condition.
    /// </summary>
    public IEnumerable<IAuthorizationRequirement> GetRequirements()
    {
        yield return new PermissionRequirement(_permissions);
    }
}
