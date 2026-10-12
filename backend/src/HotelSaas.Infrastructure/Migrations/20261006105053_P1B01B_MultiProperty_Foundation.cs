using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HotelSaas.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class P1B01B_MultiProperty_Foundation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // 1. Create Properties table
            migrationBuilder.CreateTable(
                name: "Properties",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Code = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Slug = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "text", nullable: true),
                    Address = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    City = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    PhoneNumber = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    Email = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    PropertyType = table.Column<int>(type: "integer", nullable: false, defaultValue: 1),
                    StarRating = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    CheckInTime = table.Column<TimeOnly>(type: "time without time zone", nullable: false, defaultValue: new TimeOnly(12, 0, 0)),
                    CheckOutTime = table.Column<TimeOnly>(type: "time without time zone", nullable: false, defaultValue: new TimeOnly(12, 0, 0)),
                    BufferMinutes = table.Column<int>(type: "integer", nullable: false, defaultValue: 30),
                    TaxRatePercent = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: false, defaultValue: 0.00m),
                    ServiceFeeRatePercent = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: false, defaultValue: 0.00m),
                    Latitude = table.Column<double>(type: "double precision", nullable: true),
                    Longitude = table.Column<double>(type: "double precision", nullable: true),
                    IsPublished = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    Status = table.Column<int>(type: "integer", nullable: false, defaultValue: 1),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Properties", x => x.Id);
                    table.UniqueConstraint("UX_Property_TenantId_Id", x => new { x.TenantId, x.Id });
                    table.ForeignKey(
                        name: "FK_Properties_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "UX_Property_TenantId_Code",
                table: "Properties",
                columns: new[] { "TenantId", "Code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "UX_Property_Slug",
                table: "Properties",
                column: "Slug",
                unique: true);

            // 2. Add nullable PropertyId columns to existing operational tables
            migrationBuilder.AddColumn<Guid>(
                name: "PropertyId",
                table: "TenantStaffMembers",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "PropertyId",
                table: "RoomTypes",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "PropertyId",
                table: "Rooms",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "PropertyId",
                table: "Reservations",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "PropertyId",
                table: "Payments",
                type: "uuid",
                nullable: true);

            // 3. Backfill data for existing legacy records (if any)
            migrationBuilder.Sql(@"
                -- Create default MAIN Property for any Tenant without a Property
                INSERT INTO ""Properties"" (
                    ""Id"", ""TenantId"", ""Name"", ""Code"", ""Slug"", ""Address"", ""City"",
                    ""PropertyType"", ""CheckInTime"", ""CheckOutTime"", ""BufferMinutes"",
                    ""TaxRatePercent"", ""ServiceFeeRatePercent"", ""IsPublished"", ""Status"",
                    ""CreatedAtUtc"", ""UpdatedAtUtc""
                )
                SELECT 
                    gen_random_uuid(), t.""Id"", t.""Name"" || ' - Chi nhánh chính', 'MAIN',
                    t.""Slug"" || '-main', t.""Address"", t.""City"",
                    t.""PropertyType"", t.""CheckInTime"", t.""CheckOutTime"", 30,
                    t.""TaxRatePercent"", t.""ServiceFeeRatePercent"", false,
                    CASE 
                        WHEN t.""Status"" = 2 THEN 1  -- Tenant Active (2) -> Property Active (1)
                        WHEN t.""Status"" = 3 THEN 2  -- Tenant Suspended (3) -> Property Suspended (2)
                        ELSE 0                      -- Tenant PendingApproval (1) / Inactive -> Property Inactive (0)
                    END,
                    NOW(), NOW()
                FROM ""Tenants"" t
                WHERE NOT EXISTS (SELECT 1 FROM ""Properties"" p WHERE p.""TenantId"" = t.""Id"");

                -- Whitelist valid StaffRoles (1=Owner, 2=Manager, 3=Receptionist, 4=Housekeeper) and abort if unknown role exists
                DO $$
                DECLARE
                    v_unknown_role_count integer := 0;
                BEGIN
                    SELECT COUNT(*) INTO v_unknown_role_count
                    FROM ""TenantStaffMembers""
                    WHERE ""StaffRole"" NOT IN (1, 2, 3, 4);

                    IF v_unknown_role_count > 0 THEN
                        RAISE EXCEPTION '[MIGRATION ABORT] Phát hiện % nhân sự có StaffRole không hợp lệ. Dừng toàn bộ migration.', v_unknown_role_count;
                    END IF;
                END $$;

                -- Backfill RoomTypes
                UPDATE ""RoomTypes"" rt
                SET ""PropertyId"" = p.""Id""
                FROM ""Properties"" p
                WHERE p.""TenantId"" = rt.""TenantId"" AND p.""Code"" = 'MAIN' AND rt.""PropertyId"" IS NULL;

                -- Backfill Rooms
                UPDATE ""Rooms"" r
                SET ""PropertyId"" = rt.""PropertyId""
                FROM ""RoomTypes"" rt
                WHERE rt.""Id"" = r.""RoomTypeId"" AND r.""PropertyId"" IS NULL;

                UPDATE ""Rooms"" r
                SET ""PropertyId"" = p.""Id""
                FROM ""Properties"" p
                WHERE p.""TenantId"" = r.""TenantId"" AND p.""Code"" = 'MAIN' AND r.""PropertyId"" IS NULL;

                -- Backfill Reservations
                UPDATE ""Reservations"" res
                SET ""PropertyId"" = r.""PropertyId""
                FROM ""Rooms"" r
                WHERE r.""Id"" = res.""RoomId"" AND res.""PropertyId"" IS NULL;

                UPDATE ""Reservations"" res
                SET ""PropertyId"" = p.""Id""
                FROM ""Properties"" p
                WHERE p.""TenantId"" = res.""TenantId"" AND p.""Code"" = 'MAIN' AND res.""PropertyId"" IS NULL;

                -- Backfill Payments
                UPDATE ""Payments"" pay
                SET ""PropertyId"" = res.""PropertyId""
                FROM ""Reservations"" res
                WHERE res.""Id"" = pay.""ReservationId"" AND pay.""PropertyId"" IS NULL;

                UPDATE ""Payments"" pay
                SET ""PropertyId"" = p.""Id""
                FROM ""Properties"" p
                WHERE p.""TenantId"" = pay.""TenantId"" AND p.""Code"" = 'MAIN' AND pay.""PropertyId"" IS NULL;

                -- Backfill Staff: Owner (StaffRole = 1) is Tenant-wide -> PropertyId = NULL; Branch roles (StaffRole IN (2, 3, 4)) -> assign MAIN PropertyId
                UPDATE ""TenantStaffMembers"" s
                SET ""PropertyId"" = p.""Id""
                FROM ""Properties"" p
                WHERE p.""TenantId"" = s.""TenantId"" AND p.""Code"" = 'MAIN' AND s.""StaffRole"" IN (2, 3, 4) AND s.""PropertyId"" IS NULL;

                UPDATE ""TenantStaffMembers"" s
                SET ""PropertyId"" = NULL
                WHERE s.""StaffRole"" = 1;
            ");

            // 4. Alter PropertyId columns to NOT NULL for required scoped entities
            migrationBuilder.AlterColumn<Guid>(
                name: "PropertyId",
                table: "RoomTypes",
                type: "uuid",
                nullable: false);

            migrationBuilder.AlterColumn<Guid>(
                name: "PropertyId",
                table: "Rooms",
                type: "uuid",
                nullable: false);

            migrationBuilder.AlterColumn<Guid>(
                name: "PropertyId",
                table: "Reservations",
                type: "uuid",
                nullable: false);

            migrationBuilder.AlterColumn<Guid>(
                name: "PropertyId",
                table: "Payments",
                type: "uuid",
                nullable: false);

            // 5. Add unique constraints (Alternate Keys)
            migrationBuilder.AddUniqueConstraint(
                name: "UX_RoomTypes_PropertyId_Id",
                table: "RoomTypes",
                columns: new[] { "PropertyId", "Id" });

            migrationBuilder.AddUniqueConstraint(
                name: "UX_Rooms_PropertyId_Id",
                table: "Rooms",
                columns: new[] { "PropertyId", "Id" });

            migrationBuilder.AddUniqueConstraint(
                name: "UX_Reservations_PropertyId_Id",
                table: "Reservations",
                columns: new[] { "PropertyId", "Id" });

            // 6. Add direct foreign keys on PropertyId (ON DELETE RESTRICT)
            migrationBuilder.AddForeignKey(
                name: "FK_RoomTypes_Properties_PropertyId",
                table: "RoomTypes",
                column: "PropertyId",
                principalTable: "Properties",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Rooms_Properties_PropertyId",
                table: "Rooms",
                column: "PropertyId",
                principalTable: "Properties",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Reservations_Properties_PropertyId",
                table: "Reservations",
                column: "PropertyId",
                principalTable: "Properties",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Payments_Properties_PropertyId",
                table: "Payments",
                column: "PropertyId",
                principalTable: "Properties",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            // 7. Add property-scoped unique indexes and partial indexes
            migrationBuilder.CreateIndex(
                name: "UX_RoomType_PropertyId_Code",
                table: "RoomTypes",
                columns: new[] { "PropertyId", "Code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "UX_Room_PropertyId_RoomNumber",
                table: "Rooms",
                columns: new[] { "PropertyId", "RoomNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "uq_tenant_staff_tenant_wide",
                table: "TenantStaffMembers",
                columns: new[] { "TenantId", "UserId" },
                unique: true,
                filter: "\"PropertyId\" IS NULL");

            migrationBuilder.CreateIndex(
                name: "uq_tenant_staff_property_scoped",
                table: "TenantStaffMembers",
                columns: new[] { "TenantId", "UserId", "PropertyId" },
                unique: true,
                filter: "\"PropertyId\" IS NOT NULL");

            // 8. Add Composite Cross-Scope Foreign Keys (ON DELETE RESTRICT)
            migrationBuilder.AddForeignKey(
                name: "FK_TenantStaffMembers_Properties_Tenant_Property",
                table: "TenantStaffMembers",
                columns: new[] { "TenantId", "PropertyId" },
                principalTable: "Properties",
                principalColumns: new[] { "TenantId", "Id" },
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_RoomTypes_Properties_Tenant_Property",
                table: "RoomTypes",
                columns: new[] { "TenantId", "PropertyId" },
                principalTable: "Properties",
                principalColumns: new[] { "TenantId", "Id" },
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Rooms_RoomTypes_Property_RoomType",
                table: "Rooms",
                columns: new[] { "PropertyId", "RoomTypeId" },
                principalTable: "RoomTypes",
                principalColumns: new[] { "PropertyId", "Id" },
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Rooms_Properties_Tenant_Property",
                table: "Rooms",
                columns: new[] { "TenantId", "PropertyId" },
                principalTable: "Properties",
                principalColumns: new[] { "TenantId", "Id" },
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Reservations_Rooms_Property_Room",
                table: "Reservations",
                columns: new[] { "PropertyId", "RoomId" },
                principalTable: "Rooms",
                principalColumns: new[] { "PropertyId", "Id" },
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Reservations_Properties_Tenant_Property",
                table: "Reservations",
                columns: new[] { "TenantId", "PropertyId" },
                principalTable: "Properties",
                principalColumns: new[] { "TenantId", "Id" },
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Payments_Reservations_Property_Res",
                table: "Payments",
                columns: new[] { "PropertyId", "ReservationId" },
                principalTable: "Reservations",
                principalColumns: new[] { "PropertyId", "Id" },
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Payments_Properties_Tenant_Property",
                table: "Payments",
                columns: new[] { "TenantId", "PropertyId" },
                principalTable: "Properties",
                principalColumns: new[] { "TenantId", "Id" },
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // 1. Drop Composite Cross-Scope Foreign Keys
            migrationBuilder.DropForeignKey(name: "FK_Payments_Properties_Tenant_Property", table: "Payments");
            migrationBuilder.DropForeignKey(name: "FK_Payments_Reservations_Property_Res", table: "Payments");
            migrationBuilder.DropForeignKey(name: "FK_Reservations_Properties_Tenant_Property", table: "Reservations");
            migrationBuilder.DropForeignKey(name: "FK_Reservations_Rooms_Property_Room", table: "Reservations");
            migrationBuilder.DropForeignKey(name: "FK_Rooms_Properties_Tenant_Property", table: "Rooms");
            migrationBuilder.DropForeignKey(name: "FK_Rooms_RoomTypes_Property_RoomType", table: "Rooms");
            migrationBuilder.DropForeignKey(name: "FK_RoomTypes_Properties_Tenant_Property", table: "RoomTypes");
            migrationBuilder.DropForeignKey(name: "FK_TenantStaffMembers_Properties_Tenant_Property", table: "TenantStaffMembers");

            // 2. Drop Unique Constraints (Alternate Keys)
            migrationBuilder.DropUniqueConstraint(name: "UX_Reservations_PropertyId_Id", table: "Reservations");
            migrationBuilder.DropUniqueConstraint(name: "UX_Rooms_PropertyId_Id", table: "Rooms");
            migrationBuilder.DropUniqueConstraint(name: "UX_RoomTypes_PropertyId_Id", table: "RoomTypes");

            // 3. Drop Direct Foreign Keys
            migrationBuilder.DropForeignKey(name: "FK_Payments_Properties_PropertyId", table: "Payments");
            migrationBuilder.DropForeignKey(name: "FK_Reservations_Properties_PropertyId", table: "Reservations");
            migrationBuilder.DropForeignKey(name: "FK_Rooms_Properties_PropertyId", table: "Rooms");
            migrationBuilder.DropForeignKey(name: "FK_RoomTypes_Properties_PropertyId", table: "RoomTypes");

            // 4. Drop Unique Indexes
            migrationBuilder.DropIndex(name: "uq_tenant_staff_property_scoped", table: "TenantStaffMembers");
            migrationBuilder.DropIndex(name: "uq_tenant_staff_tenant_wide", table: "TenantStaffMembers");
            migrationBuilder.DropIndex(name: "UX_Room_PropertyId_RoomNumber", table: "Rooms");
            migrationBuilder.DropIndex(name: "UX_RoomType_PropertyId_Code", table: "RoomTypes");

            // 5. Drop PropertyId columns
            migrationBuilder.DropColumn(name: "PropertyId", table: "Payments");
            migrationBuilder.DropColumn(name: "PropertyId", table: "Reservations");
            migrationBuilder.DropColumn(name: "PropertyId", table: "Rooms");
            migrationBuilder.DropColumn(name: "PropertyId", table: "RoomTypes");
            migrationBuilder.DropColumn(name: "PropertyId", table: "TenantStaffMembers");

            // 6. Drop Properties table
            migrationBuilder.DropTable(name: "Properties");
        }
    }
}
