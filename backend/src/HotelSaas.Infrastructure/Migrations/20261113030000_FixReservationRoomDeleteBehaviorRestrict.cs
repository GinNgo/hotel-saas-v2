using HotelSaas.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HotelSaas.Infrastructure.Migrations;

[DbContext(typeof(ApplicationDbContext))]
[Migration("20261113030000_FixReservationRoomDeleteBehaviorRestrict")]
public sealed class FixReservationRoomDeleteBehaviorRestrict : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropForeignKey(
            name: "FK_Reservations_Rooms_RoomId",
            table: "Reservations");

        migrationBuilder.DropForeignKey(
            name: "FK_Reservations_Tenants_TenantId",
            table: "Reservations");

        migrationBuilder.AddForeignKey(
            name: "FK_Reservations_Rooms_RoomId",
            table: "Reservations",
            column: "RoomId",
            principalTable: "Rooms",
            principalColumn: "Id",
            onDelete: ReferentialAction.Restrict);

        migrationBuilder.AddForeignKey(
            name: "FK_Reservations_Tenants_TenantId",
            table: "Reservations",
            column: "TenantId",
            principalTable: "Tenants",
            principalColumn: "Id",
            onDelete: ReferentialAction.Restrict);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropForeignKey(
            name: "FK_Reservations_Rooms_RoomId",
            table: "Reservations");

        migrationBuilder.DropForeignKey(
            name: "FK_Reservations_Tenants_TenantId",
            table: "Reservations");

        migrationBuilder.AddForeignKey(
            name: "FK_Reservations_Rooms_RoomId",
            table: "Reservations",
            column: "RoomId",
            principalTable: "Rooms",
            principalColumn: "Id",
            onDelete: ReferentialAction.Cascade);

        migrationBuilder.AddForeignKey(
            name: "FK_Reservations_Tenants_TenantId",
            table: "Reservations",
            column: "TenantId",
            principalTable: "Tenants",
            principalColumn: "Id",
            onDelete: ReferentialAction.Cascade);
    }
}
