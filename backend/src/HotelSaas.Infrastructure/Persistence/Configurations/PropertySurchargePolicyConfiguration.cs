using HotelSaas.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HotelSaas.Infrastructure.Persistence.Configurations;

/// <summary>
/// Entity configuration for <see cref="PropertySurchargePolicy"/> ensuring strict property scoping
/// and composite foreign key protection against cross-tenant corruption.
/// </summary>
public class PropertySurchargePolicyConfiguration : IEntityTypeConfiguration<PropertySurchargePolicy>
{
    public void Configure(EntityTypeBuilder<PropertySurchargePolicy> builder)
    {
        builder.ToTable("PropertySurchargePolicies");

        builder.HasKey(sp => sp.Id);

        builder.Property(sp => sp.TenantId).IsConcurrencyToken();
        builder.Property(sp => sp.PropertyId).IsConcurrencyToken();

        builder.Property(sp => sp.SurchargeType)
            .HasConversion<int>()
            .IsRequired();

        builder.Property(sp => sp.CalculationMethod)
            .HasConversion<int>()
            .IsRequired();

        builder.Property(sp => sp.FromTime)
            .IsRequired();

        builder.Property(sp => sp.ToTime)
            .IsRequired();

        builder.Property(sp => sp.Percentage)
            .HasPrecision(5, 2);

        builder.Property(sp => sp.FlatAmount)
            .HasPrecision(18, 2);

        builder.Property(sp => sp.IsActive)
            .HasDefaultValue(true);

        // Direct foreign key to Property: ON DELETE RESTRICT
        builder.HasOne(sp => sp.Property)
            .WithMany(p => p.SurchargePolicies)
            .HasForeignKey(sp => sp.PropertyId)
            .OnDelete(DeleteBehavior.Restrict)
            .HasConstraintName("FK_PropertySurchargePolicies_Properties_PropertyId");

        // Composite cross-scope guard: SurchargePolicy(TenantId, PropertyId) -> Properties(TenantId, Id)
        builder.HasOne<Property>()
            .WithMany()
            .HasForeignKey("TenantId", "PropertyId")
            .HasPrincipalKey("TenantId", "Id")
            .OnDelete(DeleteBehavior.Restrict)
            .HasConstraintName("FK_PropertySurchargePolicies_Properties_Tenant_Property");

        // Index for rapid lookup during quote calculation
        builder.HasIndex(sp => new { sp.PropertyId, sp.SurchargeType, sp.IsActive })
            .HasDatabaseName("IX_PropertySurchargePolicies_Property_Type_Active");
    }
}
