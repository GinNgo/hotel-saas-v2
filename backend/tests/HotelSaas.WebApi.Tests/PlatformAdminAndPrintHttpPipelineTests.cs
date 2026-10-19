using System;
using System.Collections.Generic;
using System.Net;
using System.Net.Http.Json;
using System.Threading.Tasks;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using HotelSaas.Infrastructure.Persistence;
using HotelSaas.Infrastructure.Persistence.Interceptors;
using HotelSaas.WebApi.Controllers;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using Xunit;

namespace HotelSaas.WebApi.Tests;

/// <summary>
/// HTTP Pipeline integration tests for Platform Administrator (Plans & Contracts) and Printable Documents.
/// Strictly runs against real PostgreSQL database schema via WebApplicationFactory.
/// </summary>
[Collection("RealDatabaseTests")]
public sealed class PlatformAdminAndPrintHttpPipelineTests
{
    private static string GetConnectionString()
    {
        var envConn = Environment.GetEnvironmentVariable("TEST_DB_CONNECTION");
        if (!string.IsNullOrWhiteSpace(envConn))
            return envConn;

        return "Host=localhost;Port=5435;Database=hotel_saas_p1b01a_test;Username=postgres;Password=postgres;";
    }

    private static void ValidateTestDatabaseTarget(string connStr)
    {
        var builder = new NpgsqlConnectionStringBuilder(connStr);
        var dbName = builder.Database?.ToLowerInvariant() ?? string.Empty;

        var isAllowed = dbName.EndsWith("_test", StringComparison.Ordinal)
                     || dbName == "hotel_saas_p1b01a_test"
                     || dbName.Contains("test_");

        if (!isAllowed)
        {
            throw new InvalidOperationException(
                $"[CRITICAL SECURITY ALERT] Target database '{builder.Database}' is NOT an authorized test database! " +
                "Refusing to execute DDL/DML. Target database name must contain '_test'.");
        }
    }

    private sealed class MockTenantService : Application.Common.Interfaces.ICurrentTenantService
    {
        public Guid? TenantId { get; set; }
    }

    private sealed class MockPropertyService : Application.Common.Interfaces.ICurrentPropertyService
    {
        public Guid? PropertyId { get; set; }
        public bool IsTenantWide { get; set; } = true;
        public IReadOnlyList<Guid> ExcludedPropertyIds { get; set; } = Array.Empty<Guid>();
        public Guid? HeaderPropertyId { get; set; }
        public Guid? TokenPropertyId { get; set; }
    }

    private static ApplicationDbContext CreateSeedDbContext(string connString, string testSchema, Guid tenantId)
    {
        var builder = new NpgsqlConnectionStringBuilder(connString)
        {
            SearchPath = testSchema
        };
        var tenantSvc = new MockTenantService { TenantId = tenantId };
        var propSvc = new MockPropertyService();
        var interceptor = new TenantPropertySaveChangesInterceptor(tenantSvc, propSvc);

        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(builder.ConnectionString, npgsqlOptions =>
                npgsqlOptions.MigrationsAssembly(typeof(ApplicationDbContext).Assembly.FullName))
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.PendingModelChangesWarning))
            .AddInterceptors(interceptor)
            .Options;

        return new ApplicationDbContext(options, tenantSvc, propSvc);
    }

    private sealed class AdminTestWebApplicationFactory : WebApplicationFactory<Program>
    {
        private readonly string _connectionString;
        private readonly string _testSchema;

        public const string TestJwtSecretKey = "SuperSecretKeyForAdminPipelineTestingMustBeAtLeast32Bytes!";

        public AdminTestWebApplicationFactory(string connectionString, string testSchema)
        {
            _connectionString = connectionString;
            _testSchema = testSchema;
        }

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            var testConnBuilder = new NpgsqlConnectionStringBuilder(_connectionString)
            {
                SearchPath = _testSchema
            };

            builder.UseEnvironment("Testing");
            builder.UseSetting("ConnectionStrings:DefaultConnection", testConnBuilder.ConnectionString);
            builder.UseSetting("JwtSettings:SecretKey", TestJwtSecretKey);
            builder.UseSetting("JwtSettings:Issuer", "HotelSaas");
            builder.UseSetting("JwtSettings:Audience", "HotelSaasClient");
            builder.UseSetting("JwtSettings:AccessTokenExpirationMinutes", "15");
            builder.UseSetting("JwtSettings:RefreshTokenExpirationDays", "7");
            builder.UseSetting("SkipStartupDatabaseInit", "true");

            builder.ConfigureServices(services =>
            {
                services.AddScoped<Application.Common.Interfaces.ICurrentTenantService, MockTenantService>();
                services.AddScoped<Application.Common.Interfaces.ICurrentPropertyService, MockPropertyService>();
            });
        }
    }

    private static async Task<(string SchemaName, Guid TenantId, Guid PropertyId)> InitializeSchemaAsync(string baseConn)
    {
        ValidateTestDatabaseTarget(baseConn);
        var schemaName = "admin_test_" + Guid.NewGuid().ToString("N")[..12];

        await using var conn = new NpgsqlConnection(baseConn);
        await conn.OpenAsync();

        await using var cmd = conn.CreateCommand();
        cmd.CommandText = $"CREATE SCHEMA IF NOT EXISTS \"{schemaName}\";";
        await cmd.ExecuteNonQueryAsync();

        var tenantId = Guid.NewGuid();
        var propId = Guid.NewGuid();

        await using var db = CreateSeedDbContext(baseConn, schemaName, tenantId);
        await db.Database.MigrateAsync();

        var tenant = new Tenant
        {
            Id = tenantId,
            Code = "TEST-HQ",
            Slug = "test-group",
            Name = "Grand Test Hotel Group",
            Status = TenantStatus.Active,
            PhoneNumber = "0901112233",
            Address = "100 Le Loi, Q1",
            City = "TP. Hồ Chí Minh"
        };
        db.Tenants.Add(tenant);

        var property = new Property
        {
            Id = propId,
            TenantId = tenantId,
            Code = "TEST-CN1",
            Slug = "grand-test-saigon",
            Name = "Grand Test Hotel Saigon",
            Address = "100 Le Loi, Q1",
            PhoneNumber = "0901112233",
            Email = "saigon@test.local",
            Status = PropertyStatus.Active,
            CreatedAtUtc = DateTime.UtcNow
        };
        db.Properties.Add(property);

        await SeedData.SeedPlatformAdminDataAsync(db);
        await db.SaveChangesAsync();

        return (schemaName, tenantId, propId);
    }

    private static async Task CleanupSchemaAsync(string baseConn, string schemaName)
    {
        try
        {
            await using var conn = new NpgsqlConnection(baseConn);
            await conn.OpenAsync();
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = $"DROP SCHEMA IF EXISTS \"{schemaName}\" CASCADE;";
            await cmd.ExecuteNonQueryAsync();
        }
        catch
        {
            // Ignore test cleanup error
        }
    }

    private static string GenerateSuperAdminJwt(Guid userId, string secretKey)
    {
        var tokenHandler = new System.IdentityModel.Tokens.Jwt.JwtSecurityTokenHandler();
        var key = System.Text.Encoding.UTF8.GetBytes(secretKey);
        var tokenDescriptor = new Microsoft.IdentityModel.Tokens.SecurityTokenDescriptor
        {
            Subject = new System.Security.Claims.ClaimsIdentity(new[]
            {
                new System.Security.Claims.Claim(System.Security.Claims.ClaimTypes.NameIdentifier, userId.ToString()),
                new System.Security.Claims.Claim("sub", userId.ToString()),
                new System.Security.Claims.Claim("globalRole", "SuperAdmin"),
                new System.Security.Claims.Claim(System.Security.Claims.ClaimTypes.Email, "superadmin@hotelsaas.vn")
            }),
            Expires = DateTime.UtcNow.AddMinutes(30),
            Issuer = "HotelSaas",
            Audience = "HotelSaasClient",
            SigningCredentials = new Microsoft.IdentityModel.Tokens.SigningCredentials(
                new Microsoft.IdentityModel.Tokens.SymmetricSecurityKey(key),
                Microsoft.IdentityModel.Tokens.SecurityAlgorithms.HmacSha256Signature)
        };
        var token = tokenHandler.CreateToken(tokenDescriptor);
        return tokenHandler.WriteToken(token);
    }

    [Fact]
    public async Task AdminPlans_CRUD_Pipeline_Succeeds()
    {
        var connStr = GetConnectionString();
        var (schema, tenantId, _) = await InitializeSchemaAsync(connStr);

        try
        {
            using var factory = new AdminTestWebApplicationFactory(connStr, schema);
            using var client = factory.CreateClient();

            var token = GenerateSuperAdminJwt(Guid.NewGuid(), AdminTestWebApplicationFactory.TestJwtSecretKey);
            client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);

            // 1. GET /api/admin/plans -> seeded STARTER, PRO, ENTERPRISE
            var getRes = await client.GetAsync("/api/admin/plans");
            Assert.Equal(HttpStatusCode.OK, getRes.StatusCode);

            var plans = await getRes.Content.ReadFromJsonAsync<List<AdminPlanItemDto>>();
            Assert.NotNull(plans);
            Assert.True(plans.Count >= 3, $"Expected at least 3 seeded plans, got {plans.Count}");

            // 2. POST /api/admin/plans -> Create custom plan
            var createReq = new SavePlanRequest
            {
                Code = "TEST_BOUTIQUE",
                Name = "Gói Boutique Test",
                MonthlyPrice = 450000,
                YearlyPrice = 4500000,
                Description = "Dành riêng cho khách sạn boutique",
                MaxRooms = 25,
                MaxProperties = 2,
                MaxStaff = 8,
                Features = new List<string> { "Quản lý phòng", "VietQR", "AI Dynamic Rate" },
                IsPopular = false,
                SortOrder = 4,
                HasVnPay = true,
                HasAdvancedReports = true,
                IsActive = true
            };

            var createRes = await client.PostAsJsonAsync("/api/admin/plans", createReq);
            Assert.Equal(HttpStatusCode.Created, createRes.StatusCode);
            var created = await createRes.Content.ReadFromJsonAsync<AdminPlanItemDto>();
            Assert.NotNull(created);
            Assert.Equal("TEST_BOUTIQUE", created.Code);
            Assert.Equal(25, created.MaxRooms);
            Assert.True(created.IsActive);

            // 3. PUT /api/admin/plans/{id} -> Update plan
            var updateReq = new SavePlanRequest
            {
                Code = "TEST_BOUTIQUE",
                Name = "Gói Boutique Cao Cấp (Updated)",
                MonthlyPrice = 490000,
                YearlyPrice = 4900000,
                Description = "Mô tả mới",
                MaxRooms = 30,
                MaxProperties = 2,
                MaxStaff = 10,
                Features = new List<string> { "Quản lý phòng", "VietQR", "AI Dynamic Rate", "Check-in Kiosk" },
                IsPopular = true,
                SortOrder = 4,
                HasVnPay = true,
                HasAdvancedReports = true,
                IsActive = true
            };

            var updateRes = await client.PutAsJsonAsync($"/api/admin/plans/{created.Id}", updateReq);
            Assert.Equal(HttpStatusCode.OK, updateRes.StatusCode);
            var updated = await updateRes.Content.ReadFromJsonAsync<AdminPlanItemDto>();
            Assert.NotNull(updated);
            Assert.Equal("Gói Boutique Cao Cấp (Updated)", updated.Name);
            Assert.Equal(30, updated.MaxRooms);
            Assert.True(updated.IsPopular);

            // 4. PATCH /api/admin/plans/{id}/toggle-active -> Deactivate
            var toggleRes = await client.PatchAsync($"/api/admin/plans/{created.Id}/toggle-active", null);
            Assert.Equal(HttpStatusCode.OK, toggleRes.StatusCode);
        }
        finally
        {
            await CleanupSchemaAsync(connStr, schema);
        }
    }

    [Fact]
    public async Task AdminContracts_And_PrintDocuments_Pipeline_Succeeds()
    {
        var connStr = GetConnectionString();
        var (schema, tenantId, propertyId) = await InitializeSchemaAsync(connStr);

        try
        {
            using var factory = new AdminTestWebApplicationFactory(connStr, schema);
            using var client = factory.CreateClient();

            var token = GenerateSuperAdminJwt(Guid.NewGuid(), AdminTestWebApplicationFactory.TestJwtSecretKey);
            client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);

            // 1. GET /api/admin/contracts -> check seeded contract
            var listContractsRes = await client.GetAsync("/api/admin/contracts");
            Assert.Equal(HttpStatusCode.OK, listContractsRes.StatusCode);
            var contracts = await listContractsRes.Content.ReadFromJsonAsync<List<TenantContractSummaryDto>>();
            Assert.NotNull(contracts);
            Assert.True(contracts.Count >= 1);

            // 2. POST /api/admin/contracts -> Create a new contract
            var createContractReq = new CreateContractRequest
            {
                TenantId = tenantId,
                PlanCode = "ENTERPRISE",
                PlanName = "Gói Doanh Nghiệp (Enterprise)",
                ContractType = "EnterpriseCustom",
                RepresentativeName = "Trần Minh Quân",
                RepresentativeEmail = "quan@grandgroup.vn",
                RepresentativePhone = "0912345678",
                StartDate = DateOnly.FromDateTime(DateTime.UtcNow),
                EndDate = DateOnly.FromDateTime(DateTime.UtcNow.AddYears(1)),
                BillingCycle = "Annual",
                ContractValue = 14990000,
                TermsAndConditions = "SLA cam kết 99.9% uptime, backup hàng ngày, hỗ trợ 24/7.",
                Notes = "Hợp đồng thử nghiệm WebApi integration test"
            };

            var postContractRes = await client.PostAsJsonAsync("/api/admin/contracts", createContractReq);
            Assert.Equal(HttpStatusCode.Created, postContractRes.StatusCode);
            var newContract = await postContractRes.Content.ReadFromJsonAsync<TenantContractDetailDto>();
            Assert.NotNull(newContract);
            Assert.Equal("ENTERPRISE", newContract.PlanCode);

            // 3. PATCH /api/admin/contracts/{id}/status -> Update contract status
            var signReq = new UpdateContractStatusRequest
            {
                Status = "Active",
                Note = "Đã kích hoạt và phê duyệt hợp đồng"
            };
            var patchRes = await client.PatchAsJsonAsync($"/api/admin/contracts/{newContract.Id}/status", signReq);
            Assert.Equal(HttpStatusCode.OK, patchRes.StatusCode);

            // 4. GET /api/print/contract/{contractId} -> Printable legal contract
            var printContractRes = await client.GetAsync($"/api/print/contract/{newContract.Id}");
            Assert.Equal(HttpStatusCode.OK, printContractRes.StatusCode);
            var printContract = await printContractRes.Content.ReadFromJsonAsync<PrintableContractDocumentDto>();
            Assert.NotNull(printContract);
            Assert.Equal(newContract.ContractNumber, printContract.ContractNumber);
            Assert.Equal("Trần Minh Quân", printContract.TenantRepresentative);
            Assert.Contains("SLA cam kết 99.9%", printContract.TermsAndConditions);

            // 5. GET & PUT /api/print/template-config -> Print branding & VietQR config
            var getTemplateRes = await client.GetAsync("/api/print/template-config");
            Assert.Equal(HttpStatusCode.OK, getTemplateRes.StatusCode);
            var template = await getTemplateRes.Content.ReadFromJsonAsync<PrintTemplateConfigDto>();
            Assert.NotNull(template);
            Assert.Equal("MBBank", template.BankName);

            var updateTemplateReq = new PrintTemplateConfigDto
            {
                TenantId = tenantId,
                HeaderCompanyName = "Grand Hotel Group Luxury Resorts",
                HeaderAddress = "777 Nguyễn Huệ, Quận 1, TP. HCM",
                TaxNumber = "0399887766",
                Hotline = "1900 9999",
                LogoUrl = "/images/saigon-riverside-tower.png",
                BankName = "Vietcombank",
                BankAccountNumber = "0071000999888",
                BankAccountHolder = "CTY CO PHAN GRAND HOTEL GROUP",
                FooterNote = "Kính chúc Quý khách một kỳ nghỉ trọn vẹn và an yên!",
                CheckInPolicyText = "Nhận phòng 14:00 - Trả phòng 12:00",
                ShowVietQrCode = true,
                DefaultPaperSize = "A4"
            };
            var putTemplateRes = await client.PutAsJsonAsync("/api/print/template-config", updateTemplateReq);
            Assert.Equal(HttpStatusCode.OK, putTemplateRes.StatusCode);
            var updatedTemplate = await putTemplateRes.Content.ReadFromJsonAsync<PrintTemplateConfigDto>();
            Assert.NotNull(updatedTemplate);
            Assert.Equal("Vietcombank", updatedTemplate.BankName);
            Assert.Equal("0071000999888", updatedTemplate.BankAccountNumber);
        }
        finally
        {
            await CleanupSchemaAsync(connStr, schema);
        }
    }
}
