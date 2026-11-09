using HotelSaas.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HotelSaas.Infrastructure.Migrations;

[DbContext(typeof(ApplicationDbContext))]
[Migration("20261109120000_AddPaymentMethodPreferenceToReservation")]
public sealed class AddPaymentMethodPreferenceToReservation : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) =>
        migrationBuilder.AddColumn<int>(
            name: "PaymentMethodPreference",
            table: "Reservations",
            type: "integer",
            nullable: false,
            defaultValue: (int)HotelSaas.Domain.Enums.PaymentMethodPreference.VNPay);

    protected override void Down(MigrationBuilder migrationBuilder) =>
        migrationBuilder.DropColumn(name: "PaymentMethodPreference", table: "Reservations");
}
