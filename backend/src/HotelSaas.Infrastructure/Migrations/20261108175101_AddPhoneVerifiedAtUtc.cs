using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HotelSaas.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddPhoneVerifiedAtUtc : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "PhoneVerifiedAtUtc",
                table: "Users",
                type: "timestamp with time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PhoneVerifiedAtUtc",
                table: "Users");
        }
    }
}
