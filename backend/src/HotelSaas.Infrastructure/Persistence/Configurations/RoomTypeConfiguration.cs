using HotelSaas.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HotelSaas.Infrastructure.Persistence.Configurations;

/// <summary>
/// Entity configuration for <see cref="RoomType"/> with property-scoping and composite cross-scope guards.
/// </summary>
public class RoomTypeConfiguration : IEntityTypeConfiguration<RoomType>
{
    public void Configure(EntityTypeBuilder<RoomType> builder)
    {
        builder.ToTable("RoomTypes");

        builder.HasKey(rt => rt.Id);

        // Concurrency tokens for partition scope mutation guard
        builder.Property(rt => rt.TenantId).IsConcurrencyToken();
        builder.Property(rt => rt.PropertyId).IsConcurrencyToken();

        // Direct foreign key to Property: ON DELETE RESTRICT
        builder.HasOne(rt => rt.Property)
            .WithMany(p => p.RoomTypes)
            .HasForeignKey(rt => rt.PropertyId)
            .OnDelete(DeleteBehavior.Restrict)
            .HasConstraintName("FK_RoomTypes_Properties_PropertyId");

        // Unique code per property
        builder.HasIndex(rt => new { rt.PropertyId, rt.Code })
            .HasDatabaseName("UX_RoomType_PropertyId_Code")
            .IsUnique();

        // Alternate key for composite room assignment validation
        builder.HasAlternateKey(rt => new { rt.PropertyId, rt.Id })
            .HasName("UX_RoomTypes_PropertyId_Id");

        // Alternate key for rate schedules and audit composite foreign keys
        builder.HasAlternateKey(rt => new { rt.TenantId, rt.PropertyId, rt.Id })
            .HasName("UQ_RoomTypes_Tenant_Property_Id");

        // Composite cross-scope guard: RoomType(TenantId, PropertyId) -> Properties(TenantId, Id)
        builder.HasOne<Property>()
            .WithMany()
            .HasForeignKey("TenantId", "PropertyId")
            .HasPrincipalKey("TenantId", "Id")
            .OnDelete(DeleteBehavior.Restrict)
            .HasConstraintName("FK_RoomTypes_Properties_Tenant_Property");
    }
}
