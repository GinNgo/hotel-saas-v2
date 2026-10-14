using System.IO;
using HotelSaas.Domain.Enums;
using Xunit;

namespace HotelSaas.Application.Tests.MigrationFixtures;

/// <summary>
/// Unit and fixture content tests verifying the P1B-01A migration scripts and logic in an isolated test environment.
/// </summary>
public sealed class P1B01A_MigrationPlanAndFixtureTests
{
    private static readonly string FixturesDirectory = 
        Directory.Exists(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Fixtures", "P1B01A"))
            ? Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Fixtures", "P1B01A")
            : Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "..", "..", "..", "Fixtures", "P1B01A");

    [Fact]
    public void Fixtures_AllThreeSqlScripts_ExistAndAreNonEmpty()
    {
        // Arrange
        var script01 = Path.Combine(FixturesDirectory, "01_SchemaPreCheckAndRecovery.sql");
        var script02 = Path.Combine(FixturesDirectory, "02_FreshDbBaseline.sql");
        var script03 = Path.Combine(FixturesDirectory, "03_ExistingDbMigrationBackfill.sql");

        // Assert
        Assert.True(File.Exists(script01), "01_SchemaPreCheckAndRecovery.sql must exist");
        Assert.True(File.Exists(script02), "02_FreshDbBaseline.sql must exist");
        Assert.True(File.Exists(script03), "03_ExistingDbMigrationBackfill.sql must exist");

        Assert.True(new FileInfo(script01).Length > 100, "Script 01 must contain content");
        Assert.True(new FileInfo(script02).Length > 500, "Script 02 must contain content");
        Assert.True(new FileInfo(script03).Length > 500, "Script 03 must contain content");
    }

    [Fact]
    public void Fixture01_SchemaPreCheck_StrictlyVerifies_All11BaselineTables_And_Columns_BeforeRecovery()
    {
        // Arrange
        var script01Content = File.ReadAllText(Path.Combine(FixturesDirectory, "01_SchemaPreCheckAndRecovery.sql"));

        // Assert - Verifies all 11 baseline tables list and checks drift
        Assert.Contains("__EFMigrationsHistory", script01Content);
        Assert.Contains("20261006000000_InitialBaseline", script01Content);
        Assert.Contains("Tenants", script01Content);
        Assert.Contains("Users", script01Content);
        Assert.Contains("AccessRoles", script01Content);
        Assert.Contains("PermissionFunctions", script01Content);
        Assert.Contains("RolePermissions", script01Content);
        Assert.Contains("TenantStaffMembers", script01Content);
        Assert.Contains("Rooms", script01Content);
        Assert.Contains("RoomTypes", script01Content);
        Assert.Contains("Reservations", script01Content);
        Assert.Contains("Payments", script01Content);
        Assert.Contains("RefreshTokens", script01Content);

        // Assert - Pre-checks individual elements and columns
        Assert.Contains("TaxRatePercent", script01Content);
        Assert.Contains("ModuleCode", script01Content);
        Assert.Contains("ConfirmationCode", script01Content);

        // Assert - Aborts on schema drift instead of auto-stamping
        Assert.Contains("RAISE EXCEPTION", script01Content);
        Assert.Contains("Schema Drift", script01Content);
    }

    [Fact]
    public void Fixture02_FreshDbBaseline_Sets_GlobalRole_Customer_And_Zero_Taxes()
    {
        // Arrange
        var script02Content = File.ReadAllText(Path.Combine(FixturesDirectory, "02_FreshDbBaseline.sql"));

        // Assert - GlobalRole must be Customer (2), NOT SuperAdmin (1)
        Assert.Contains("\"GlobalRole\" integer NOT NULL DEFAULT 2", script02Content);
        Assert.DoesNotContain("\"GlobalRole\" integer NOT NULL DEFAULT 1", script02Content);

        // Assert - Taxes and Fees must default to 0.00 (D25)
        Assert.Contains("\"TaxRatePercent\" numeric(5,2) NOT NULL DEFAULT 0.00", script02Content);
        Assert.Contains("\"ServiceFeeRatePercent\" numeric(5,2) NOT NULL DEFAULT 0.00", script02Content);
        Assert.DoesNotContain("DEFAULT 10.00", script02Content);
        Assert.DoesNotContain("DEFAULT 5.00", script02Content);

        // Assert - Real Domain Model Fidelity (1:1 with HotelSaas.Domain)
        Assert.Contains("\"TenantId\" uuid", script02Content); // Users.TenantId from User.cs
        Assert.Contains("\"ModuleCode\" character varying(50) NOT NULL", script02Content); // PermissionFunctions.ModuleCode
        Assert.Contains("\"StarRating\" integer NOT NULL DEFAULT 0", script02Content); // Tenants.StarRating from Tenant.cs
        Assert.DoesNotContain("\"StartAtUtc\"", script02Content); // No invented columns on Reservations
        Assert.DoesNotContain("\"StayType\"", script02Content);
        Assert.DoesNotContain("\"IdempotencyKey\"", script02Content); // No invented columns on Payments
    }

    [Fact]
    public void Fixture03_BackfillMembership_Distinguishes_Roles_And_FailsOnUnknownRole()
    {
        // Arrange
        var script03Content = File.ReadAllText(Path.Combine(FixturesDirectory, "03_ExistingDbMigrationBackfill.sql"));

        // Assert - Unknown role check (fail-fast)
        Assert.Contains("WHERE \"StaffRole\" NOT IN (1, 2, 3, 4)", script03Content);
        Assert.Contains("RAISE EXCEPTION", script03Content);

        // Assert - Property-scoped roles (Manager=2, Receptionist=3, Housekeeper=4) get default PropertyId
        Assert.Contains("staff.\"StaffRole\" IN (2, 3, 4)", script03Content);
        Assert.Contains("SET \"PropertyId\" = p.\"Id\"", script03Content);

        // Assert - Tenant-wide roles (Owner=1) keep PropertyId as NULL
        Assert.Contains("SET \"PropertyId\" = NULL", script03Content);
        Assert.Contains("staff.\"StaffRole\" = 1", script03Content);
    }

    [Fact]
    public void Fixture03_Preserves_Location_Policy_And_Faithfully_Preserves_TaxesAndFees()
    {
        // Arrange
        var script03Content = File.ReadAllText(Path.Combine(FixturesDirectory, "03_ExistingDbMigrationBackfill.sql"));

        // Assert - Location preservation from Tenant
        Assert.Contains("COALESCE(NULLIF(t.\"Address\", ''), 'Chưa cập nhật địa chỉ')", script03Content);
        Assert.Contains("COALESCE(NULLIF(t.\"City\", ''), 'Chưa cập nhật tỉnh/thành')", script03Content);

        // Assert - Preserves Tenant's configured check-in and check-out
        Assert.Contains("COALESCE(t.\"CheckInTime\", '14:00:00'::time)", script03Content);
        Assert.Contains("COALESCE(t.\"CheckOutTime\", '12:00:00'::time)", script03Content);
        Assert.Contains("30", script03Content); // BufferMinutes 30 min

        // Assert - Preserves configured taxes and fees from Tenant (not hardcoded to arbitrary values)
        Assert.Contains("COALESCE(t.\"TaxRatePercent\", 0.00)", script03Content);
        Assert.Contains("COALESCE(t.\"ServiceFeeRatePercent\", 0.00)", script03Content);

        // Assert - Bỏ Active->Published: Không tự động publish, mặc định false để bảo đảm an toàn dữ liệu
        Assert.DoesNotContain("(t.\"Status\" = 2)", script03Content);
        Assert.Contains("FALSE,                                                     -- BỎ ACTIVE->PUBLISHED", script03Content);
    }

    [Fact]
    public void Fixtures_DoNotCascadeDelete_OnOperationalTables()
    {
        // Arrange
        var script02Content = File.ReadAllText(Path.Combine(FixturesDirectory, "02_FreshDbBaseline.sql"));
        var script03Content = File.ReadAllText(Path.Combine(FixturesDirectory, "03_ExistingDbMigrationBackfill.sql"));

        // Assert - Operational FKs to Properties MUST use RESTRICT (not CASCADE)
        Assert.Contains("FOREIGN KEY (\"PropertyId\") REFERENCES \"Properties\" (\"Id\") ON DELETE RESTRICT", script02Content);
        Assert.Contains("FOREIGN KEY (\"PropertyId\") REFERENCES \"Properties\" (\"Id\") ON DELETE RESTRICT", script03Content);

        // Verify that CASCADE is NOT used on operational tables
        Assert.DoesNotContain("FK_Rooms_Properties_PropertyId\" FOREIGN KEY (\"PropertyId\") REFERENCES \"Properties\" (\"Id\") ON DELETE CASCADE", script02Content);
        Assert.DoesNotContain("FK_Reservations_Properties_PropertyId\" FOREIGN KEY (\"PropertyId\") REFERENCES \"Properties\" (\"Id\") ON DELETE CASCADE", script02Content);
        Assert.DoesNotContain("FK_Payments_Properties_PropertyId\" FOREIGN KEY (\"PropertyId\") REFERENCES \"Properties\" (\"Id\") ON DELETE CASCADE", script02Content);
    }

    [Fact]
    public void Fixture03_Implements_Explicit_Property_Mapping_Without_Limit1_And_Includes_Scope_Validation()
    {
        // Arrange
        var script03Content = File.ReadAllText(Path.Combine(FixturesDirectory, "03_ExistingDbMigrationBackfill.sql"));

        // Assert - No arbitrary LIMIT 1
        Assert.DoesNotContain("LIMIT 1", script03Content);

        // Assert - Explicit mapping via Code = 'MAIN'
        Assert.Contains("p.\"Code\" = 'MAIN'", script03Content);

        // Assert - Scope constraint validation included
        Assert.Contains("[SCOPE CHECK]", script03Content);
        Assert.Contains("res.\"TenantId\" <> r.\"TenantId\"", script03Content);
        Assert.Contains("pay.\"TenantId\" <> res.\"TenantId\"", script03Content);
    }

    [Fact]
    public void Fixtures_Implement_Dual_Partial_Unique_Indexes_And_CrossScope_Guards()
    {
        // Arrange
        var script02Content = File.ReadAllText(Path.Combine(FixturesDirectory, "02_FreshDbBaseline.sql"));
        var script03Content = File.ReadAllText(Path.Combine(FixturesDirectory, "03_ExistingDbMigrationBackfill.sql"));

        // Assert - Tenant-wide index (WHERE PropertyId IS NULL)
        Assert.Contains("CREATE UNIQUE INDEX IF NOT EXISTS uq_tenant_staff_tenant_wide", script02Content);
        Assert.Contains("WHERE \"PropertyId\" IS NULL", script02Content);

        // Assert - Property-scoped index (WHERE PropertyId IS NOT NULL)
        Assert.Contains("CREATE UNIQUE INDEX IF NOT EXISTS uq_tenant_staff_property_scoped", script02Content);
        Assert.Contains("WHERE \"PropertyId\" IS NOT NULL", script02Content);

        // Both indexes also present in script03
        Assert.Contains("uq_tenant_staff_tenant_wide", script03Content);
        Assert.Contains("uq_tenant_staff_property_scoped", script03Content);

        // Assert - Cross-scope composite foreign key constraints in both scripts
        Assert.Contains("FK_Rooms_Properties_Tenant_Property", script03Content);
        Assert.Contains("FK_Reservations_Properties_Tenant_Property", script03Content);
        Assert.Contains("FK_Payments_Properties_Tenant_Property", script03Content);
        Assert.Contains("FK_Reservations_Rooms_Property_Room", script03Content);
        Assert.Contains("FK_Payments_Reservations_Property_Res", script03Content);
        Assert.Contains("FK_RoomTypes_Properties_Tenant_Property", script03Content);
        Assert.Contains("FK_Rooms_RoomTypes_Property_RoomType", script03Content);
        Assert.Contains("FK_TenantStaffMembers_Properties_Tenant_Property", script03Content);

        Assert.Contains("FK_Rooms_Properties_Tenant_Property", script02Content);
        Assert.Contains("FK_Reservations_Properties_Tenant_Property", script02Content);
        Assert.Contains("FK_Payments_Properties_Tenant_Property", script02Content);
        Assert.Contains("FK_Reservations_Rooms_Property_Room", script02Content);
        Assert.Contains("FK_Payments_Reservations_Property_Res", script02Content);
        Assert.Contains("FK_RoomTypes_Properties_Tenant_Property", script02Content);
        Assert.Contains("FK_Rooms_RoomTypes_Property_RoomType", script02Content);
        Assert.Contains("FK_TenantStaffMembers_Properties_Tenant_Property", script02Content);
    }
}
