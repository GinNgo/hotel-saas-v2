using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HotelSaas.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class P4_Loyalty_And_Invoice_Vat : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CompanyAddress",
                table: "Users",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CompanyName",
                table: "Users",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CompanyTaxCode",
                table: "Users",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BuyerAddress",
                table: "Reservations",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BuyerCompanyName",
                table: "Reservations",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BuyerEmail",
                table: "Reservations",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BuyerTaxCode",
                table: "Reservations",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "PointsDiscountAmount",
                table: "Reservations",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<int>(
                name: "PointsEarned",
                table: "Reservations",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "PointsRedeemed",
                table: "Reservations",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "PointsRefunded",
                table: "Reservations",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "BuyerAddress",
                table: "Invoices",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BuyerCompanyName",
                table: "Invoices",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BuyerEmail",
                table: "Invoices",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BuyerTaxCode",
                table: "Invoices",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "PointsDiscountAmount",
                table: "Invoices",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<int>(
                name: "PointsEarned",
                table: "Invoices",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "PointsRedeemed",
                table: "Invoices",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "PointsRefunded",
                table: "Invoices",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateTable(
                name: "GuestLoyaltyMemberships",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    EnrolledPropertyId = table.Column<Guid>(type: "uuid", nullable: false),
                    MemberCode = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Tier = table.Column<int>(type: "integer", nullable: false),
                    PointsBalance = table.Column<int>(type: "integer", nullable: false),
                    LifetimePoints = table.Column<int>(type: "integer", nullable: false),
                    CompletedStaysCount = table.Column<int>(type: "integer", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GuestLoyaltyMemberships", x => x.Id);
                    table.ForeignKey(
                        name: "FK_GuestLoyaltyMemberships_Properties_EnrolledPropertyId",
                        column: x => x.EnrolledPropertyId,
                        principalTable: "Properties",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_GuestLoyaltyMemberships_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_GuestLoyaltyMemberships_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "LoyaltyPointTransactions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    MembershipId = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    PropertyId = table.Column<Guid>(type: "uuid", nullable: true),
                    ReservationId = table.Column<Guid>(type: "uuid", nullable: true),
                    InvoiceId = table.Column<Guid>(type: "uuid", nullable: true),
                    TransactionType = table.Column<int>(type: "integer", nullable: false),
                    PointsDelta = table.Column<int>(type: "integer", nullable: false),
                    BalanceAfter = table.Column<int>(type: "integer", nullable: false),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LoyaltyPointTransactions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_LoyaltyPointTransactions_Invoices_InvoiceId",
                        column: x => x.InvoiceId,
                        principalTable: "Invoices",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_LoyaltyPointTransactions_Memberships_MembershipId",
                        column: x => x.MembershipId,
                        principalTable: "GuestLoyaltyMemberships",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_LoyaltyPointTransactions_Properties_PropertyId",
                        column: x => x.PropertyId,
                        principalTable: "Properties",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_LoyaltyPointTransactions_Reservations_ReservationId",
                        column: x => x.ReservationId,
                        principalTable: "Reservations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_LoyaltyPointTransactions_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_GuestLoyaltyMemberships_EnrolledPropertyId",
                table: "GuestLoyaltyMemberships",
                column: "EnrolledPropertyId");

            migrationBuilder.CreateIndex(
                name: "IX_GuestLoyaltyMemberships_UserId",
                table: "GuestLoyaltyMemberships",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "UX_GuestLoyaltyMemberships_MemberCode",
                table: "GuestLoyaltyMemberships",
                column: "MemberCode",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "UX_GuestLoyaltyMemberships_Tenant_User",
                table: "GuestLoyaltyMemberships",
                columns: new[] { "TenantId", "UserId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_LoyaltyPointTransactions_InvoiceId",
                table: "LoyaltyPointTransactions",
                column: "InvoiceId");

            migrationBuilder.CreateIndex(
                name: "IX_LoyaltyPointTransactions_Membership_CreatedAt",
                table: "LoyaltyPointTransactions",
                columns: new[] { "MembershipId", "CreatedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_LoyaltyPointTransactions_PropertyId",
                table: "LoyaltyPointTransactions",
                column: "PropertyId");

            migrationBuilder.CreateIndex(
                name: "IX_LoyaltyPointTransactions_ReservationId",
                table: "LoyaltyPointTransactions",
                column: "ReservationId");

            migrationBuilder.CreateIndex(
                name: "IX_LoyaltyPointTransactions_TenantId",
                table: "LoyaltyPointTransactions",
                column: "TenantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "LoyaltyPointTransactions");

            migrationBuilder.DropTable(
                name: "GuestLoyaltyMemberships");

            migrationBuilder.DropColumn(
                name: "CompanyAddress",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "CompanyName",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "CompanyTaxCode",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "BuyerAddress",
                table: "Reservations");

            migrationBuilder.DropColumn(
                name: "BuyerCompanyName",
                table: "Reservations");

            migrationBuilder.DropColumn(
                name: "BuyerEmail",
                table: "Reservations");

            migrationBuilder.DropColumn(
                name: "BuyerTaxCode",
                table: "Reservations");

            migrationBuilder.DropColumn(
                name: "PointsDiscountAmount",
                table: "Reservations");

            migrationBuilder.DropColumn(
                name: "PointsEarned",
                table: "Reservations");

            migrationBuilder.DropColumn(
                name: "PointsRedeemed",
                table: "Reservations");

            migrationBuilder.DropColumn(
                name: "PointsRefunded",
                table: "Reservations");

            migrationBuilder.DropColumn(
                name: "BuyerAddress",
                table: "Invoices");

            migrationBuilder.DropColumn(
                name: "BuyerCompanyName",
                table: "Invoices");

            migrationBuilder.DropColumn(
                name: "BuyerEmail",
                table: "Invoices");

            migrationBuilder.DropColumn(
                name: "BuyerTaxCode",
                table: "Invoices");

            migrationBuilder.DropColumn(
                name: "PointsDiscountAmount",
                table: "Invoices");

            migrationBuilder.DropColumn(
                name: "PointsEarned",
                table: "Invoices");

            migrationBuilder.DropColumn(
                name: "PointsRedeemed",
                table: "Invoices");

            migrationBuilder.DropColumn(
                name: "PointsRefunded",
                table: "Invoices");
        }
    }
}
