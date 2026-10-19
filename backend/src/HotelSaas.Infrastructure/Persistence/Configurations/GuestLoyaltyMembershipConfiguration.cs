using HotelSaas.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HotelSaas.Infrastructure.Persistence.Configurations;

public class GuestLoyaltyMembershipConfiguration : IEntityTypeConfiguration<GuestLoyaltyMembership>
{
    public void Configure(EntityTypeBuilder<GuestLoyaltyMembership> builder)
    {
        builder.ToTable("GuestLoyaltyMemberships");

        builder.HasKey(m => m.Id);

        builder.Property(m => m.MemberCode)
            .IsRequired()
            .HasMaxLength(50);

        builder.Property(m => m.Version)
            .IsRowVersion();

        // 1 User can only have 1 Membership Card per Tenant
        builder.HasIndex(m => new { m.TenantId, m.UserId })
            .IsUnique()
            .HasDatabaseName("UX_GuestLoyaltyMemberships_Tenant_User");

        builder.HasIndex(m => m.MemberCode)
            .IsUnique()
            .HasDatabaseName("UX_GuestLoyaltyMemberships_MemberCode");

        builder.HasOne(m => m.User)
            .WithMany(u => u.LoyaltyMemberships)
            .HasForeignKey(m => m.UserId)
            .OnDelete(DeleteBehavior.Restrict)
            .HasConstraintName("FK_GuestLoyaltyMemberships_Users_UserId");

        builder.HasOne(m => m.Tenant)
            .WithMany()
            .HasForeignKey(m => m.TenantId)
            .OnDelete(DeleteBehavior.Restrict)
            .HasConstraintName("FK_GuestLoyaltyMemberships_Tenants_TenantId");

        builder.HasOne(m => m.EnrolledProperty)
            .WithMany()
            .HasForeignKey(m => m.EnrolledPropertyId)
            .OnDelete(DeleteBehavior.Restrict)
            .HasConstraintName("FK_GuestLoyaltyMemberships_Properties_EnrolledPropertyId");
    }
}
