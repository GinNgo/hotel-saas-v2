using System;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HotelSaas.Infrastructure.Persistence.Configurations;

/// <summary>
/// Entity configuration for <see cref="Property"/> physical branches.
/// Enforces table naming, precision, constraints, and RESTRICT deletion behavior.
/// </summary>
public class PropertyConfiguration : IEntityTypeConfiguration<Property>
{
    public void Configure(EntityTypeBuilder<Property> builder)
    {
        builder.ToTable("Properties");

        builder.HasKey(p => p.Id);

        builder.Property(p => p.Name)
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(p => p.Code)
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(p => p.Slug)
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(p => p.Address)
            .HasMaxLength(500)
            .IsRequired();

        builder.Property(p => p.City)
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(p => p.PhoneNumber)
            .HasMaxLength(20);

        builder.Property(p => p.Email)
            .HasMaxLength(200);

        builder.Property(p => p.PropertyType)
            .HasConversion<int>()
            .HasDefaultValue(PropertyType.Hotel)
            .HasSentinel((PropertyType)(-1));

        builder.Property(p => p.StarRating)
            .HasDefaultValue(0);

        builder.Property(p => p.CheckInTime)
            .HasDefaultValue(new TimeOnly(12, 0, 0));

        builder.Property(p => p.CheckOutTime)
            .HasDefaultValue(new TimeOnly(12, 0, 0));

        builder.Property(p => p.BufferMinutes)
            .HasDefaultValue(30);

        // Decision D14 (Chờ PO phê duyệt / Pending PO Approval): Interim configurable property policy boundary (1..24, default 12)
        builder.Property(p => p.MaxHourlyHours)
            .HasDefaultValue(12);

        builder.ToTable(t => t.HasCheckConstraint("CK_Properties_MaxHourlyHours", "\"MaxHourlyHours\" >= 1 AND \"MaxHourlyHours\" <= 24"));

        builder.Property(p => p.TaxRatePercent)
            .HasPrecision(5, 2)
            .HasDefaultValue(0.00m);

        builder.Property(p => p.ServiceFeeRatePercent)
            .HasPrecision(5, 2)
            .HasDefaultValue(0.00m);

        builder.Property(p => p.TouristZoneSlug)
            .HasMaxLength(100);

        builder.Property(p => p.TouristZoneName)
            .HasMaxLength(200);

        builder.Property(p => p.NearbyLandmarksJson)
            .HasMaxLength(4000);

        builder.Property(p => p.AllowHourlyBooking)
            .HasDefaultValue(true);

        builder.Property(p => p.AllowOvernightBooking)
            .HasDefaultValue(true);

        builder.Property(p => p.AllowDailyBooking)
            .HasDefaultValue(true);

        builder.Property(p => p.IsPublished)
            .HasDefaultValue(false);

        builder.Property(p => p.Status)
            .HasConversion<int>()
            .HasDefaultValue(PropertyStatus.Active)
            .HasSentinel((PropertyStatus)(-1));

        // Foreign key to parent tenant: ON DELETE RESTRICT
        builder.HasOne(p => p.Tenant)
            .WithMany(t => t.Properties)
            .HasForeignKey(p => p.TenantId)
            .OnDelete(DeleteBehavior.Restrict)
            .HasConstraintName("FK_Properties_Tenants_TenantId");

        // Unique indexes
        builder.HasIndex(p => new { p.TenantId, p.Code })
            .HasDatabaseName("UX_Property_TenantId_Code")
            .IsUnique();

        builder.HasIndex(p => p.Slug)
            .HasDatabaseName("UX_Property_Slug")
            .IsUnique();

        // Alternate key for composite cross-scope foreign keys
        builder.HasAlternateKey(p => new { p.TenantId, p.Id })
            .HasName("UX_Property_TenantId_Id");
    }
}
