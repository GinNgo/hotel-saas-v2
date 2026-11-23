using HotelSaas.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HotelSaas.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core entity configuration for <see cref="AuditLog"/> enforcing PostgreSQL jsonb storage,
/// tenant concurrency token protection, and composite query indexes.
/// </summary>
public class AuditLogConfiguration : IEntityTypeConfiguration<AuditLog>
{
    public void Configure(EntityTypeBuilder<AuditLog> builder)
    {
        builder.ToTable("AuditLogs");

        builder.HasKey(a => a.Id);

        builder.Property(a => a.TenantId)
            .IsRequired()
            .IsConcurrencyToken();

        builder.Property(a => a.PropertyId);

        builder.Property(a => a.UserId);

        builder.Property(a => a.Action)
            .HasMaxLength(32)
            .IsRequired();

        builder.Property(a => a.EntityName)
            .HasMaxLength(128)
            .IsRequired();

        builder.Property(a => a.EntityId)
            .IsRequired();

        builder.Property(a => a.OldValues)
            .HasColumnType("jsonb");

        builder.Property(a => a.NewValues)
            .HasColumnType("jsonb");

        builder.Property(a => a.IpAddress)
            .HasMaxLength(64);

        builder.Property(a => a.CreatedAtUtc)
            .IsRequired();

        // Logical tenant partition key (Guid.Empty represents platform-level security/IAM audit events).
        // Ignore Tenant navigation so no strict FK blocks platform-level logs while global query filters enforce isolation.
        builder.Ignore(a => a.Tenant);

        // Optional foreign key to Property: ON DELETE RESTRICT
        builder.HasOne(a => a.Property)
            .WithMany()
            .HasForeignKey(a => a.PropertyId)
            .OnDelete(DeleteBehavior.Restrict)
            .HasConstraintName("FK_AuditLogs_Properties_PropertyId");

        // Composite indexes for multi-tenant & multi-property audit queries
        builder.HasIndex(a => new { a.TenantId, a.CreatedAtUtc })
            .HasDatabaseName("IX_AuditLogs_Tenant_CreatedAt");

        builder.HasIndex(a => new { a.TenantId, a.PropertyId, a.CreatedAtUtc })
            .HasDatabaseName("IX_AuditLogs_Tenant_Property_CreatedAt");

        builder.HasIndex(a => new { a.TenantId, a.UserId, a.CreatedAtUtc })
            .HasDatabaseName("IX_AuditLogs_Tenant_User_CreatedAt");

        builder.HasIndex(a => new { a.TenantId, a.EntityName, a.EntityId })
            .HasDatabaseName("IX_AuditLogs_Tenant_Entity");
    }
}

