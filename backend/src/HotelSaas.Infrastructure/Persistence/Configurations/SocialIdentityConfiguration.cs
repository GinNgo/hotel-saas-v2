using HotelSaas.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HotelSaas.Infrastructure.Persistence.Configurations;

/// <summary>
/// Entity configuration for <see cref="SocialIdentity"/> mapping external providers to users.
/// </summary>
public class SocialIdentityConfiguration : IEntityTypeConfiguration<SocialIdentity>
{
    public void Configure(EntityTypeBuilder<SocialIdentity> builder)
    {
        builder.ToTable("SocialIdentities");

        builder.HasKey(si => si.Id);

        builder.Property(si => si.Provider)
            .IsRequired()
            .HasMaxLength(32);

        builder.Property(si => si.ProviderSubject)
            .IsRequired()
            .HasMaxLength(255);

        builder.Property(si => si.ProviderEmail)
            .IsRequired()
            .HasMaxLength(320);

        builder.Property(si => si.AvatarUrl)
            .HasMaxLength(1000);

        builder.HasOne(si => si.User)
            .WithMany(u => u.SocialIdentities)
            .HasForeignKey(si => si.UserId)
            .OnDelete(DeleteBehavior.Cascade)
            .HasConstraintName("FK_SocialIdentities_Users_UserId");

        // Unique index on (Provider, ProviderSubject) to prevent duplicate provider links
        builder.HasIndex(si => new { si.Provider, si.ProviderSubject })
            .IsUnique()
            .HasDatabaseName("UX_SocialIdentities_Provider_Subject");

        // Unique index on (UserId, Provider)
        builder.HasIndex(si => new { si.UserId, si.Provider })
            .IsUnique()
            .HasDatabaseName("UX_SocialIdentities_User_Provider");
    }
}
