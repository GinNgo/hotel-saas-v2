using HotelSaas.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HotelSaas.Infrastructure.Persistence.Configurations;

public class LoyaltyPointTransactionConfiguration : IEntityTypeConfiguration<LoyaltyPointTransaction>
{
    public void Configure(EntityTypeBuilder<LoyaltyPointTransaction> builder)
    {
        builder.ToTable("LoyaltyPointTransactions");

        builder.HasKey(t => t.Id);

        builder.Property(t => t.Description)
            .IsRequired()
            .HasMaxLength(500);

        builder.HasIndex(t => new { t.MembershipId, t.CreatedAtUtc })
            .HasDatabaseName("IX_LoyaltyPointTransactions_Membership_CreatedAt");

        builder.HasIndex(t => t.ReservationId)
            .HasDatabaseName("IX_LoyaltyPointTransactions_ReservationId");

        builder.HasOne(t => t.Membership)
            .WithMany(m => m.Transactions)
            .HasForeignKey(t => t.MembershipId)
            .OnDelete(DeleteBehavior.Cascade)
            .HasConstraintName("FK_LoyaltyPointTransactions_Memberships_MembershipId");

        builder.HasOne(t => t.Tenant)
            .WithMany()
            .HasForeignKey(t => t.TenantId)
            .OnDelete(DeleteBehavior.Restrict)
            .HasConstraintName("FK_LoyaltyPointTransactions_Tenants_TenantId");

        builder.HasOne(t => t.Property)
            .WithMany()
            .HasForeignKey(t => t.PropertyId)
            .OnDelete(DeleteBehavior.SetNull)
            .HasConstraintName("FK_LoyaltyPointTransactions_Properties_PropertyId");

        builder.HasOne(t => t.Reservation)
            .WithMany()
            .HasForeignKey(t => t.ReservationId)
            .OnDelete(DeleteBehavior.SetNull)
            .HasConstraintName("FK_LoyaltyPointTransactions_Reservations_ReservationId");

        builder.HasOne(t => t.Invoice)
            .WithMany()
            .HasForeignKey(t => t.InvoiceId)
            .OnDelete(DeleteBehavior.SetNull)
            .HasConstraintName("FK_LoyaltyPointTransactions_Invoices_InvoiceId");
    }
}
