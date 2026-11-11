using HotelSaas.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HotelSaas.Infrastructure.Migrations;

[DbContext(typeof(ApplicationDbContext))]
[Migration("20261111163000_AutoVerifyPersonnelTestAccounts")]
public sealed class AutoVerifyPersonnelTestAccounts : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(@"
            UPDATE ""Users""
            SET ""EmailVerifiedAtUtc"" = COALESCE(""EmailVerifiedAtUtc"", NOW()),
                ""PhoneVerifiedAtUtc"" = COALESCE(""PhoneVerifiedAtUtc"", NOW())
            WHERE ""Email"" IN (
                'owner@hotelsaas.local',
                'manager.both@hotelsaas.local',
                'staff.single@hotelsaas.local',
                'superadmin@hotelsaas.platform',
                'admin@hotelsaas.local',
                'receptionist.sgn@grandhotel.vn',
                'guest.vip@hotelsaas.local'
            )
            OR (""GlobalRole"" != 2 AND ""EmailVerifiedAtUtc"" IS NULL AND ""PhoneVerifiedAtUtc"" IS NULL);
        ");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
    }
}
