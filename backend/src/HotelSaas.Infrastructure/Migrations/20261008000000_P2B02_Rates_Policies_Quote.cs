using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HotelSaas.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class P2B02_Rates_Policies_Quote : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // 0. Ensure btree_gist extension exists in stable 'public' schema under database advisory lock
            migrationBuilder.Sql(@"
                DO $$
                DECLARE
                    v_schema text;
                BEGIN
                    -- Database-level advisory transaction lock to serialize concurrent runners
                    PERFORM pg_advisory_xact_lock(7420261008);

                    SELECT n.nspname INTO v_schema
                    FROM pg_extension e
                    JOIN pg_namespace n ON e.extnamespace = n.oid
                    WHERE e.extname = 'btree_gist';

                    IF v_schema IS NOT NULL THEN
                        IF v_schema != 'public' THEN
                            RAISE EXCEPTION '[EXTENSION CONFIGURATION ERROR] Extension btree_gist is installed in unauthorized schema % instead of public. Manual intervention required.', v_schema;
                        END IF;
                    ELSE
                        CREATE SCHEMA IF NOT EXISTS public;
                        CREATE EXTENSION btree_gist SCHEMA public;
                    END IF;
                END $$;");

            // 1. Add MaxHourlyHours column to Properties
            migrationBuilder.AddColumn<int>(
                name: "MaxHourlyHours",
                table: "Properties",
                type: "integer",
                nullable: false,
                defaultValue: 12);

            // Check constraint for MaxHourlyHours (1..24)
            migrationBuilder.Sql(@"
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.check_constraints 
                        WHERE constraint_schema = current_schema() 
                          AND constraint_name = 'CK_Properties_MaxHourlyHours'
                    ) THEN
                        ALTER TABLE ""Properties""
                        ADD CONSTRAINT ""CK_Properties_MaxHourlyHours"" 
                        CHECK (""MaxHourlyHours"" >= 1 AND ""MaxHourlyHours"" <= 24);
                    END IF;
                END $$;");

            // 2. Add Alternate Key to RoomTypes for composite cross-scope foreign keys
            migrationBuilder.AddUniqueConstraint(
                name: "UQ_RoomTypes_Tenant_Property_Id",
                table: "RoomTypes",
                columns: new[] { "TenantId", "PropertyId", "Id" });

            // 3. Create PropertySurchargePolicies table
            migrationBuilder.CreateTable(
                name: "PropertySurchargePolicies",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    PropertyId = table.Column<Guid>(type: "uuid", nullable: false),
                    SurchargeType = table.Column<int>(type: "integer", nullable: false),
                    FromTime = table.Column<TimeOnly>(type: "time without time zone", nullable: false),
                    ToTime = table.Column<TimeOnly>(type: "time without time zone", nullable: false),
                    CalculationMethod = table.Column<int>(type: "integer", nullable: false),
                    Percentage = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: true),
                    FlatAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PropertySurchargePolicies", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PropertySurchargePolicies_Properties_PropertyId",
                        column: x => x.PropertyId,
                        principalTable: "Properties",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_PropertySurchargePolicies_Properties_Tenant_Property",
                        columns: x => new { x.TenantId, x.PropertyId },
                        principalTable: "Properties",
                        principalColumns: new[] { "TenantId", "Id" },
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PropertySurchargePolicies_Property_Type_Active",
                table: "PropertySurchargePolicies",
                columns: new[] { "PropertyId", "SurchargeType", "IsActive" });

            // 4. Create RoomTypeRates table
            migrationBuilder.CreateTable(
                name: "RoomTypeRates",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    PropertyId = table.Column<Guid>(type: "uuid", nullable: false),
                    RoomTypeId = table.Column<Guid>(type: "uuid", nullable: false),
                    FirstHours = table.Column<int>(type: "integer", nullable: false, defaultValue: 2),
                    FirstHoursPrice = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    AdditionalHourPrice = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    NightlyPrice = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Currency = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false, defaultValue: "VND"),
                    EffectiveFrom = table.Column<DateOnly>(type: "date", nullable: false),
                    EffectiveTo = table.Column<DateOnly>(type: "date", nullable: false),
                    CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    ChangeReason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RoomTypeRates", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RoomTypeRates_Properties_PropertyId",
                        column: x => x.PropertyId,
                        principalTable: "Properties",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_RoomTypeRates_RoomTypes_RoomTypeId",
                        column: x => x.RoomTypeId,
                        principalTable: "RoomTypes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_RoomTypeRates_RoomTypes_Composite",
                        columns: x => new { x.TenantId, x.PropertyId, x.RoomTypeId },
                        principalTable: "RoomTypes",
                        principalColumns: new[] { "TenantId", "PropertyId", "Id" },
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_RoomTypeRates_Property_RoomType_Active",
                table: "RoomTypeRates",
                columns: new[] { "PropertyId", "RoomTypeId", "IsActive" });

            // Exclusion constraint preventing overlapping date intervals
            migrationBuilder.Sql(@"
                ALTER TABLE ""RoomTypeRates""
                ADD CONSTRAINT ""EXCLUDE_RoomTypeRates_NoOverlap""
                EXCLUDE USING gist (
                    ""TenantId"" WITH =,
                    ""PropertyId"" WITH =,
                    ""RoomTypeId"" WITH =,
                    daterange(""EffectiveFrom"", ""EffectiveTo"", '[)') WITH &&
                ) WHERE (""IsActive"" = true);");

            // 5. Create RoomTypeRateAudits table
            migrationBuilder.CreateTable(
                name: "RoomTypeRateAudits",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    PropertyId = table.Column<Guid>(type: "uuid", nullable: false),
                    RoomTypeId = table.Column<Guid>(type: "uuid", nullable: false),
                    RateId = table.Column<Guid>(type: "uuid", nullable: true),
                    OldEffectiveFrom = table.Column<DateOnly>(type: "date", nullable: true),
                    OldEffectiveTo = table.Column<DateOnly>(type: "date", nullable: true),
                    OldNightlyPrice = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    NewEffectiveFrom = table.Column<DateOnly>(type: "date", nullable: false),
                    NewEffectiveTo = table.Column<DateOnly>(type: "date", nullable: false),
                    NewNightlyPrice = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    ActionType = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    ChangedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    ChangedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ChangeReason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RoomTypeRateAudits", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RoomTypeRateAudits_Properties_PropertyId",
                        column: x => x.PropertyId,
                        principalTable: "Properties",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_RoomTypeRateAudits_RoomTypes_RoomTypeId",
                        column: x => x.RoomTypeId,
                        principalTable: "RoomTypes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_RoomTypeRateAudits_RoomTypeRates_RateId",
                        column: x => x.RateId,
                        principalTable: "RoomTypeRates",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_RoomTypeRateAudits_RoomTypes_Composite",
                        columns: x => new { x.TenantId, x.PropertyId, x.RoomTypeId },
                        principalTable: "RoomTypes",
                        principalColumns: new[] { "TenantId", "PropertyId", "Id" },
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_RoomTypeRateAudits_Property_RoomType_ChangedAt",
                table: "RoomTypeRateAudits",
                columns: new[] { "PropertyId", "RoomTypeId", "ChangedAtUtc" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Fail-closed protection: Refuse rollback if business data exists
            migrationBuilder.Sql(@"
                DO $$
                DECLARE
                    v_rates_count bigint := 0;
                    v_audits_count bigint := 0;
                    v_surcharges_count bigint := 0;
                BEGIN
                    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = 'RoomTypeRates') THEN
                        SELECT count(*) INTO v_rates_count FROM ""RoomTypeRates"";
                    END IF;
                    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = 'RoomTypeRateAudits') THEN
                        SELECT count(*) INTO v_audits_count FROM ""RoomTypeRateAudits"";
                    END IF;
                    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = 'PropertySurchargePolicies') THEN
                        SELECT count(*) INTO v_surcharges_count FROM ""PropertySurchargePolicies"";
                    END IF;

                    -- Fail-closed guard: Abort if any business data exists
                    IF v_rates_count > 0 OR v_audits_count > 0 OR v_surcharges_count > 0 THEN
                        RAISE EXCEPTION 'MIGRATION ROLLBACK ABORTED (FAIL-CLOSED): Schema ""%"" contains business data (RoomTypeRates: %, RoomTypeRateAudits: %, PropertySurchargePolicies: %). Table drop aborted.', current_schema(), v_rates_count, v_audits_count, v_surcharges_count;
                    END IF;

                    -- Only drop when empty
                    DROP TABLE IF EXISTS ""PropertySurchargePolicies"";
                    DROP TABLE IF EXISTS ""RoomTypeRateAudits"";
                    DROP TABLE IF EXISTS ""RoomTypeRates"";

                    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_schema = current_schema() AND constraint_name = 'UQ_RoomTypes_Tenant_Property_Id') THEN
                        ALTER TABLE ""RoomTypes"" DROP CONSTRAINT ""UQ_RoomTypes_Tenant_Property_Id"";
                    END IF;

                    IF EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_schema = current_schema() AND constraint_name = 'CK_Properties_MaxHourlyHours') THEN
                        ALTER TABLE ""Properties"" DROP CONSTRAINT ""CK_Properties_MaxHourlyHours"";
                    END IF;

                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'Properties' AND column_name = 'MaxHourlyHours') THEN
                        ALTER TABLE ""Properties"" DROP COLUMN ""MaxHourlyHours"";
                    END IF;
                END $$;");
        }
    }
}
