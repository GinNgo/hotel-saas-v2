using HotelSaas.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HotelSaas.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core entity configuration for <see cref="User"/> enforcing unique lookup indexes.
/// </summary>
public class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> builder)
    {
        builder.ToTable("Users");

        builder.HasKey(u => u.Id);

        builder.HasIndex(u => u.Email)
            .IsUnique()
            .HasDatabaseName("UX_User_Email");

        builder.HasIndex(u => u.Username)
            .IsUnique()
            .HasDatabaseName("UX_User_Username");
    }
}
