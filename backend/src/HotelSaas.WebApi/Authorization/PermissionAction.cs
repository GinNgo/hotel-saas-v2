namespace HotelSaas.WebApi.Authorization;

/// <summary>
/// Defines bitmask constants for permission actions used in RBAC authorization.
/// Actions can be combined via bitwise OR for multi-action requirements.
/// </summary>
public static class PermissionAction
{
    /// <summary>Read / view access.</summary>
    public const int Read = 1;

    /// <summary>Create new records.</summary>
    public const int Create = 2;

    /// <summary>Update existing records.</summary>
    public const int Update = 4;

    /// <summary>Delete records.</summary>
    public const int Delete = 8;

    /// <summary>Approve pending items (e.g., reservations, refunds).</summary>
    public const int Approve = 16;

    /// <summary>Export data to files or reports.</summary>
    public const int Export = 32;

    /// <summary>Full management including configuration and role assignment.</summary>
    public const int Manage = 64;
}
