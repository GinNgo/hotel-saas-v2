using HotelSaas.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HotelSaas.Infrastructure.Persistence.Configurations;

/// <summary>
/// Entity configuration for <see cref="Payment"/> with property-scoping and composite cross-scope guards.
/// </summary>
public class PaymentConfiguration : IEntityTypeConfiguration<Payment>
{
    public void Configure(EntityTypeBuilder<Payment> builder)
    {
        builder.ToTable("Payments");

        builder.HasKey(pay => pay.Id);

        // Concurrency tokens for partition scope mutation guard
        builder.Property(pay => pay.TenantId).IsConcurrencyToken();
        builder.Property(pay => pay.PropertyId).IsConcurrencyToken();

        // Direct foreign key to Property: ON DELETE RESTRICT
        builder.HasOne(pay => pay.Property)
            .WithMany(p => p.Payments)
            .HasForeignKey(pay => pay.PropertyId)
            .OnDelete(DeleteBehavior.Restrict)
            .HasConstraintName("FK_Payments_Properties_PropertyId");

        // Composite cross-scope guard: Payment(TenantId, PropertyId) -> Properties(TenantId, Id)
        builder.HasOne<Property>()
            .WithMany()
            .HasForeignKey("TenantId", "PropertyId")
            .HasPrincipalKey("TenantId", "Id")
            .OnDelete(DeleteBehavior.Restrict)
            .HasConstraintName("FK_Payments_Properties_Tenant_Property");

        // Composite cross-scope guard: Payment(PropertyId, ReservationId) -> Reservations(PropertyId, Id)
        builder.HasOne<Reservation>()
            .WithMany()
            .HasForeignKey("PropertyId", "ReservationId")
            .HasPrincipalKey("PropertyId", "Id")
            .OnDelete(DeleteBehavior.Restrict)
            .HasConstraintName("FK_Payments_Reservations_Property_Res");
    }
}
