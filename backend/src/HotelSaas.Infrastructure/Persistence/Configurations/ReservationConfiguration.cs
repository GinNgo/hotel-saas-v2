using HotelSaas.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HotelSaas.Infrastructure.Persistence.Configurations;

/// <summary>
/// Entity configuration for <see cref="Reservation"/> with property-scoping and composite cross-scope guards.
/// </summary>
public class ReservationConfiguration : IEntityTypeConfiguration<Reservation>
{
    public void Configure(EntityTypeBuilder<Reservation> builder)
    {
        builder.ToTable("Reservations");

        builder.HasKey(res => res.Id);

        // Concurrency tokens for partition scope mutation guard
        builder.Property(res => res.TenantId).IsConcurrencyToken();
        builder.Property(res => res.PropertyId).IsConcurrencyToken();
        builder.Property(res => res.PaymentMethodPreference)
            .HasDefaultValue(HotelSaas.Domain.Enums.PaymentMethodPreference.VNPay);

        // Direct foreign key to Property: ON DELETE RESTRICT
        builder.HasOne(res => res.Property)
            .WithMany(p => p.Reservations)
            .HasForeignKey(res => res.PropertyId)
            .OnDelete(DeleteBehavior.Restrict)
            .HasConstraintName("FK_Reservations_Properties_PropertyId");

        // Direct foreign key to Room: ON DELETE RESTRICT (eliminates dangerous Cascade Delete)
        builder.HasOne(res => res.Room)
            .WithMany(rm => rm.Reservations)
            .HasForeignKey(res => res.RoomId)
            .OnDelete(DeleteBehavior.Restrict)
            .HasConstraintName("FK_Reservations_Rooms_RoomId");

        // Direct foreign key to Tenant: ON DELETE RESTRICT
        builder.HasOne(res => res.Tenant)
            .WithMany(t => t.Reservations)
            .HasForeignKey(res => res.TenantId)
            .OnDelete(DeleteBehavior.Restrict)
            .HasConstraintName("FK_Reservations_Tenants_TenantId");

        // Lookup index on ConfirmationCode for guest portal & front-desk search
        builder.HasIndex(res => res.ConfirmationCode)
            .HasDatabaseName("IX_Reservations_ConfirmationCode");

        // Alternate key for composite payment validation
        builder.HasAlternateKey(res => new { res.PropertyId, res.Id })
            .HasName("UX_Reservations_PropertyId_Id");

        // Composite cross-scope guard: Reservation(TenantId, PropertyId) -> Properties(TenantId, Id)
        builder.HasOne<Property>()
            .WithMany()
            .HasForeignKey("TenantId", "PropertyId")
            .HasPrincipalKey("TenantId", "Id")
            .OnDelete(DeleteBehavior.Restrict)
            .HasConstraintName("FK_Reservations_Properties_Tenant_Property");

        // Composite cross-scope guard: Reservation(PropertyId, RoomId) -> Rooms(PropertyId, Id)
        builder.HasOne<Room>()
            .WithMany()
            .HasForeignKey("PropertyId", "RoomId")
            .HasPrincipalKey("PropertyId", "Id")
            .OnDelete(DeleteBehavior.Restrict)
            .HasConstraintName("FK_Reservations_Rooms_Property_Room");
    }
}
