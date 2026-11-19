using HotelSaas.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HotelSaas.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core entity configuration for <see cref="SupportAccessGrant"/>.
/// </summary>
public class SupportAccessGrantConfiguration : IEntityTypeConfiguration<SupportAccessGrant>
{
    public void Configure(EntityTypeBuilder<SupportAccessGrant> builder)
    {
        builder.ToTable("SupportAccessGrants");

        builder.HasKey(g => g.Id);

        builder.Property(g => g.TenantId)
            .IsRequired()
            .IsConcurrencyToken();

        builder.Property(g => g.Scope)
            .HasMaxLength(32)
            .IsRequired();

        builder.Property(g => g.Reason)
            .HasMaxLength(500)
            .IsRequired();

        builder.HasOne(g => g.Tenant)
            .WithMany()
            .HasForeignKey(g => g.TenantId)
            .OnDelete(DeleteBehavior.Restrict)
            .HasConstraintName("FK_SupportAccessGrants_Tenants_TenantId");

        builder.HasIndex(g => new { g.TenantId, g.ExpiresAtUtc, g.RevokedAtUtc })
            .HasDatabaseName("IX_SupportAccessGrants_Tenant_Expiry");

        builder.HasIndex(g => new { g.TargetSupportUserId, g.TenantId })
            .HasDatabaseName("IX_SupportAccessGrants_TargetUser_Tenant");
    }
}
