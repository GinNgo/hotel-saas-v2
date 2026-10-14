using HotelSaas.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HotelSaas.Infrastructure.Persistence.Configurations;

/// <summary>
/// Entity configuration for <see cref="RoomTypeRate"/> enforcing composite foreign key boundaries
/// and date range pricing schedules.
/// </summary>
public class RoomTypeRateConfiguration : IEntityTypeConfiguration<RoomTypeRate>
{
    public void Configure(EntityTypeBuilder<RoomTypeRate> builder)
    {
        builder.ToTable("RoomTypeRates");

        builder.HasKey(r => r.Id);

        builder.Property(r => r.TenantId).IsConcurrencyToken();
        builder.Property(r => r.PropertyId).IsConcurrencyToken();

        builder.Property(r => r.FirstHours)
            .HasDefaultValue(2);

        builder.Property(r => r.FirstHoursPrice)
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(r => r.AdditionalHourPrice)
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(r => r.NightlyPrice)
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(r => r.Currency)
            .HasMaxLength(10)
            .HasDefaultValue("VND")
            .IsRequired();

        builder.Property(r => r.EffectiveFrom)
            .IsRequired();

        builder.Property(r => r.EffectiveTo)
            .IsRequired();

        builder.Property(r => r.ChangeReason)
            .HasMaxLength(500);

        builder.Property(r => r.IsActive)
            .HasDefaultValue(true);

        // Direct foreign key to Property: ON DELETE RESTRICT
        builder.HasOne(r => r.Property)
            .WithMany(p => p.RoomTypeRates)
            .HasForeignKey(r => r.PropertyId)
            .OnDelete(DeleteBehavior.Restrict)
            .HasConstraintName("FK_RoomTypeRates_Properties_PropertyId");

        // Direct foreign key to RoomType: ON DELETE RESTRICT
        builder.HasOne(r => r.RoomType)
            .WithMany(rt => rt.Rates)
            .HasForeignKey(r => r.RoomTypeId)
            .OnDelete(DeleteBehavior.Restrict)
            .HasConstraintName("FK_RoomTypeRates_RoomTypes_RoomTypeId");

        // Composite cross-scope foreign key: (TenantId, PropertyId, RoomTypeId) -> RoomTypes(TenantId, PropertyId, Id)
        builder.HasOne<RoomType>()
            .WithMany()
            .HasForeignKey("TenantId", "PropertyId", "RoomTypeId")
            .HasPrincipalKey("TenantId", "PropertyId", "Id")
            .OnDelete(DeleteBehavior.Restrict)
            .HasConstraintName("FK_RoomTypeRates_RoomTypes_Composite");

        // Index for pricing queries
        builder.HasIndex(r => new { r.PropertyId, r.RoomTypeId, r.IsActive })
            .HasDatabaseName("IX_RoomTypeRates_Property_RoomType_Active");
    }
}
