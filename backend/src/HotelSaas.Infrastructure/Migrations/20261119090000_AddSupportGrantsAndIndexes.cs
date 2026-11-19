using System;
using HotelSaas.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HotelSaas.Infrastructure.Migrations;

[DbContext(typeof(ApplicationDbContext))]
[Migration("20261119090000_AddSupportGrantsAndIndexes")]
public sealed class AddSupportGrantsAndIndexes : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "SupportAccessGrants",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                GrantedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                TargetSupportUserId = table.Column<Guid>(type: "uuid", nullable: false),
                Scope = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                Reason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                ExpiresAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                RevokedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                RevokedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_SupportAccessGrants", x => x.Id);
                table.ForeignKey(
                    name: "FK_SupportAccessGrants_Tenants_TenantId",
                    column: x => x.TenantId,
                    principalTable: "Tenants",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateTable(
            name: "SupportAuditLogs",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                SupportAccessGrantId = table.Column<Guid>(type: "uuid", nullable: false),
                ActorUserId = table.Column<Guid>(type: "uuid", nullable: false),
                Action = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                ResourcePath = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                DetailsJson = table.Column<string>(type: "jsonb", nullable: true),
                IpAddress = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_SupportAuditLogs", x => x.Id);
                table.ForeignKey(
                    name: "FK_SupportAuditLogs_Grants_SupportAccessGrantId",
                    column: x => x.SupportAccessGrantId,
                    principalTable: "SupportAccessGrants",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateIndex(
            name: "IX_SupportAccessGrants_TargetUser_Tenant",
            table: "SupportAccessGrants",
            columns: new[] { "TargetSupportUserId", "TenantId" });

        migrationBuilder.CreateIndex(
            name: "IX_SupportAccessGrants_Tenant_Expiry",
            table: "SupportAccessGrants",
            columns: new[] { "TenantId", "ExpiresAtUtc", "RevokedAtUtc" });

        migrationBuilder.CreateIndex(
            name: "IX_SupportAuditLogs_Grant_CreatedAt",
            table: "SupportAuditLogs",
            columns: new[] { "SupportAccessGrantId", "CreatedAtUtc" });

        migrationBuilder.CreateIndex(
            name: "IX_SupportAuditLogs_Tenant_CreatedAt",
            table: "SupportAuditLogs",
            columns: new[] { "TenantId", "CreatedAtUtc" });

        migrationBuilder.CreateIndex(
            name: "IX_Reservations_ConfirmationCode",
            table: "Reservations",
            column: "ConfirmationCode");

        migrationBuilder.CreateIndex(
            name: "UX_User_Email",
            table: "Users",
            column: "Email",
            unique: true);

        migrationBuilder.CreateIndex(
            name: "UX_User_Username",
            table: "Users",
            column: "Username",
            unique: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(
            name: "SupportAuditLogs");

        migrationBuilder.DropTable(
            name: "SupportAccessGrants");

        migrationBuilder.DropIndex(
            name: "IX_Reservations_ConfirmationCode",
            table: "Reservations");

        migrationBuilder.DropIndex(
            name: "UX_User_Email",
            table: "Users");

        migrationBuilder.DropIndex(
            name: "UX_User_Username",
            table: "Users");
    }
}
