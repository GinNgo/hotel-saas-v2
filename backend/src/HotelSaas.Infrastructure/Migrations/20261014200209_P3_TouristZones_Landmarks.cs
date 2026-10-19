using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HotelSaas.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class P3_TouristZones_Landmarks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "AllowDailyBooking",
                table: "Properties",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "AllowHourlyBooking",
                table: "Properties",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "AllowOvernightBooking",
                table: "Properties",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<string>(
                name: "NearbyLandmarksJson",
                table: "Properties",
                type: "character varying(4000)",
                maxLength: 4000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TouristZoneName",
                table: "Properties",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TouristZoneSlug",
                table: "Properties",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AllowDailyBooking",
                table: "Properties");

            migrationBuilder.DropColumn(
                name: "AllowHourlyBooking",
                table: "Properties");

            migrationBuilder.DropColumn(
                name: "AllowOvernightBooking",
                table: "Properties");

            migrationBuilder.DropColumn(
                name: "NearbyLandmarksJson",
                table: "Properties");

            migrationBuilder.DropColumn(
                name: "TouristZoneName",
                table: "Properties");

            migrationBuilder.DropColumn(
                name: "TouristZoneSlug",
                table: "Properties");
        }
    }
}
