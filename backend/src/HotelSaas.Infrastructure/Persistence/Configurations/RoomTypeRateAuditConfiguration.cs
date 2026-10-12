using HotelSaas.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HotelSaas.Infrastructure.Persistence.Configurations;

/// <summary>
/// Entity configuration for <see cref="RoomTypeRateAudit"/> ensuring composite foreign key partitioning
/// and non-destructive audit history retention.
/// </summary>
public class RoomTypeRateAuditConfiguration : IEntityTypeConfiguration<RoomTypeRateAudit>
{
    public void Configure(EntityTypeBuilder<RoomTypeRateAudit> builder)
    {
        builder.ToTable("RoomTypeRateAudits");

        builder.HasKey(a => a.Id);

        builder.Property(a => a.TenantId).IsConcurrencyToken();
        builder.Property(a => a.PropertyId).IsConcurrencyToken();

        builder.Property(a => a.OldNightlyPrice)
            .HasPrecision(18, 2);

        builder.Property(a => a.NewNightlyPrice)
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(a => a.ActionType)
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(a => a.ChangeReason)
            .HasMaxLength(500);

        builder.Property(a => a.ChangedAtUtc)
            .IsRequired();

        // Direct foreign key to Property: ON DELETE RESTRICT
        builder.HasOne(a => a.Property)
            .WithMany()
            .HasForeignKey(a => a.PropertyId)
            .OnDelete(DeleteBehavior.Restrict)
            .HasConstraintName("FK_RoomTypeRateAudits_Properties_PropertyId");

        // Direct foreign key to RoomType: ON DELETE RESTRICT
        builder.HasOne(a => a.RoomType)
            .WithMany(rt => rt.RateAudits)
            .HasForeignKey(a => a.RoomTypeId)
            .OnDelete(DeleteBehavior.Restrict)
            .HasConstraintName("FK_RoomTypeRateAudits_RoomTypes_RoomTypeId");

        // Foreign key to Rate: ON DELETE RESTRICT
        builder.HasOne(a => a.Rate)
            .WithMany(r => r.Audits)
            .HasForeignKey(a => a.RateId)
            .OnDelete(DeleteBehavior.Restrict)
            .HasConstraintName("FK_RoomTypeRateAudits_RoomTypeRates_RateId");

        // Composite cross-scope foreign key: (TenantId, PropertyId, RoomTypeId) -> RoomTypes(TenantId, PropertyId, Id)
        builder.HasOne<RoomType>()
            .WithMany()
            .HasForeignKey("TenantId", "PropertyId", "RoomTypeId")
            .HasPrincipalKey("TenantId", "PropertyId", "Id")
            .OnDelete(DeleteBehavior.Restrict)
            .HasConstraintName("FK_RoomTypeRateAudits_RoomTypes_Composite");

        // Index for rate audit history lookup
        builder.HasIndex(a => new { a.PropertyId, a.RoomTypeId, a.ChangedAtUtc })
            .HasDatabaseName("IX_RoomTypeRateAudits_Property_RoomType_ChangedAt");
    }
}
