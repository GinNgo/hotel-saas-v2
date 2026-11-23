using HotelSaas.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HotelSaas.Infrastructure.Migrations;

/// <summary>
/// Adds an optional per-property / per-tenant <c>SepayApiKey</c> column to <c>PrintTemplateConfigs</c>
/// so individual hotel branches can authenticate incoming SePay VietQR webhooks with their own key.
/// </summary>
[DbContext(typeof(ApplicationDbContext))]
[Migration("20261123120000_AddPerPropertySepayApiKey")]
public sealed class AddPerPropertySepayApiKey : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """ALTER TABLE "PrintTemplateConfigs" ADD COLUMN IF NOT EXISTS "SepayApiKey" character varying(256) NULL;""");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """ALTER TABLE "PrintTemplateConfigs" DROP COLUMN IF EXISTS "SepayApiKey";""");
    }
}
