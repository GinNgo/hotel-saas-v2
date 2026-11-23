using HotelSaas.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HotelSaas.Infrastructure.Migrations;

/// <summary>
/// Drops FK_AuditLogs_Tenants_TenantId so platform-level security and IAM audit logs
/// (LoginFailed, CreatePlatformAdmin, TogglePlatformUserStatus, UpdatePlatformUserRole)
/// can persist with TenantId = Guid.Empty while tenant query filters remain fail-closed.
/// </summary>
[DbContext(typeof(ApplicationDbContext))]
[Migration("20261123000000_AllowPlatformScopeAuditLogs")]
public sealed class AllowPlatformScopeAuditLogs : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """ALTER TABLE "AuditLogs" DROP CONSTRAINT IF EXISTS "FK_AuditLogs_Tenants_TenantId";""");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddForeignKey(
            name: "FK_AuditLogs_Tenants_TenantId",
            table: "AuditLogs",
            column: "TenantId",
            principalTable: "Tenants",
            principalColumn: "Id",
            onDelete: ReferentialAction.Restrict);
    }
}
