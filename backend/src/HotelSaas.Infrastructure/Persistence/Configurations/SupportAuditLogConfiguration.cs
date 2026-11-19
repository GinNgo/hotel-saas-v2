using HotelSaas.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HotelSaas.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core entity configuration for <see cref="SupportAuditLog"/>.
/// </summary>
public class SupportAuditLogConfiguration : IEntityTypeConfiguration<SupportAuditLog>
{
    public void Configure(EntityTypeBuilder<SupportAuditLog> builder)
    {
        builder.ToTable("SupportAuditLogs");

        builder.HasKey(l => l.Id);

        builder.Property(l => l.TenantId)
            .IsRequired()
            .IsConcurrencyToken();

        builder.Property(l => l.Action)
            .HasMaxLength(64)
            .IsRequired();

        builder.Property(l => l.ResourcePath)
            .HasMaxLength(256)
            .IsRequired();

        builder.Property(l => l.DetailsJson)
            .HasColumnType("jsonb");

        builder.Property(l => l.IpAddress)
            .HasMaxLength(64);

        builder.HasOne(l => l.SupportAccessGrant)
            .WithMany(g => g.AuditLogs)
            .HasForeignKey(l => l.SupportAccessGrantId)
            .OnDelete(DeleteBehavior.Restrict)
            .HasConstraintName("FK_SupportAuditLogs_Grants_SupportAccessGrantId");

        builder.HasIndex(l => new { l.TenantId, l.CreatedAtUtc })
            .HasDatabaseName("IX_SupportAuditLogs_Tenant_CreatedAt");

        builder.HasIndex(l => new { l.SupportAccessGrantId, l.CreatedAtUtc })
            .HasDatabaseName("IX_SupportAuditLogs_Grant_CreatedAt");
    }
}
