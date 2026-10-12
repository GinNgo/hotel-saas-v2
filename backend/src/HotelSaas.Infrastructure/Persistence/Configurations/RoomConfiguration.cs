using HotelSaas.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HotelSaas.Infrastructure.Persistence.Configurations;

/// <summary>
/// Entity configuration for <see cref="Room"/> with property-scoping and composite cross-scope guards.
/// </summary>
public class RoomConfiguration : IEntityTypeConfiguration<Room>
{
    public void Configure(EntityTypeBuilder<Room> builder)
    {
        builder.ToTable("Rooms");

        builder.HasKey(r => r.Id);

        // Concurrency tokens for partition scope mutation guard
        builder.Property(r => r.TenantId).IsConcurrencyToken();
        builder.Property(r => r.PropertyId).IsConcurrencyToken();

        // Direct foreign key to Property: ON DELETE RESTRICT
        builder.HasOne(r => r.Property)
            .WithMany(p => p.Rooms)
            .HasForeignKey(r => r.PropertyId)
            .OnDelete(DeleteBehavior.Restrict)
            .HasConstraintName("FK_Rooms_Properties_PropertyId");

        // Unique room number per property
        builder.HasIndex(r => new { r.PropertyId, r.RoomNumber })
            .HasDatabaseName("UX_Room_PropertyId_RoomNumber")
            .IsUnique();

        // Alternate key for composite reservation validation
        builder.HasAlternateKey(r => new { r.PropertyId, r.Id })
            .HasName("UX_Rooms_PropertyId_Id");

        // Composite cross-scope guard: Room(TenantId, PropertyId) -> Properties(TenantId, Id)
        builder.HasOne<Property>()
            .WithMany()
            .HasForeignKey("TenantId", "PropertyId")
            .HasPrincipalKey("TenantId", "Id")
            .OnDelete(DeleteBehavior.Restrict)
            .HasConstraintName("FK_Rooms_Properties_Tenant_Property");

        // Composite cross-scope guard: Room(PropertyId, RoomTypeId) -> RoomTypes(PropertyId, Id)
        builder.HasOne<RoomType>()
            .WithMany()
            .HasForeignKey("PropertyId", "RoomTypeId")
            .HasPrincipalKey("PropertyId", "Id")
            .OnDelete(DeleteBehavior.Restrict)
            .HasConstraintName("FK_Rooms_RoomTypes_Property_RoomType");
    }
}
