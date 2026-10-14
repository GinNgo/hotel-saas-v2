using HotelSaas.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HotelSaas.Infrastructure.Persistence.Configurations;

/// <summary>
/// Entity configuration for <see cref="TenantStaff"/> membership assignments.
/// Configures partial unique indexes for tenant-wide vs property-scoped roles
/// and composite cross-scope foreign key validation.
/// </summary>
public class TenantStaffConfiguration : IEntityTypeConfiguration<TenantStaff>
{
    public void Configure(EntityTypeBuilder<TenantStaff> builder)
    {
        builder.ToTable("TenantStaffMembers");

        builder.HasKey(ts => ts.Id);

        // Direct foreign key to Property: ON DELETE RESTRICT (nullable)
        builder.HasOne(ts => ts.Property)
            .WithMany(p => p.StaffMembers)
            .HasForeignKey(ts => ts.PropertyId)
            .OnDelete(DeleteBehavior.Restrict)
            .HasConstraintName("FK_TenantStaffMembers_Properties_PropertyId");

        // Partial unique index 1: Tenant-wide (Owner: PropertyId IS NULL)
        builder.HasIndex(ts => new { ts.TenantId, ts.UserId })
            .HasDatabaseName("uq_tenant_staff_tenant_wide")
            .HasFilter("\"PropertyId\" IS NULL")
            .IsUnique();

        // Partial unique index 2: Property-scoped (Manager, Receptionist, Housekeeper: PropertyId IS NOT NULL)
        builder.HasIndex(ts => new { ts.TenantId, ts.UserId, ts.PropertyId })
            .HasDatabaseName("uq_tenant_staff_property_scoped")
            .HasFilter("\"PropertyId\" IS NOT NULL")
            .IsUnique();

        // Composite cross-scope guard: TenantStaff(TenantId, PropertyId) -> Properties(TenantId, Id)
        builder.HasOne<Property>()
            .WithMany()
            .HasForeignKey("TenantId", "PropertyId")
            .HasPrincipalKey("TenantId", "Id")
            .OnDelete(DeleteBehavior.Restrict)
            .HasConstraintName("FK_TenantStaffMembers_Properties_Tenant_Property");
    }
}
