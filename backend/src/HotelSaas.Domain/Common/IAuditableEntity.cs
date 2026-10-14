namespace HotelSaas.Domain.Common;

/// <summary>
/// Interface for entities that track which user created and last modified them.
/// </summary>
public interface IAuditableEntity
{
    /// <summary>
    /// Identifier of the user who created this entity.
    /// </summary>
    Guid? CreatedBy { get; set; }

    /// <summary>
    /// Identifier of the user who last updated this entity.
    /// </summary>
    Guid? UpdatedBy { get; set; }
}
