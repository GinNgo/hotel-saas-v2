using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.AuditLogs.DTOs;
using HotelSaas.Application.AuditLogs.Queries.GetAuditLogById;
using HotelSaas.Application.AuditLogs.Queries.GetAuditLogs;
using HotelSaas.Application.Auth.DTOs;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Common.Models;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using HotelSaas.Infrastructure.Persistence;
using HotelSaas.Infrastructure.Persistence.Interceptors;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Xunit;

namespace HotelSaas.Application.Tests.Audit;

/// <summary>
/// E2E Integration Test: Trọn luồng Nhân viên đổi giá phòng -> Backend ghi AuditLog -> Owner mở Nhật ký kiểm toán -> Xem chính xác giá cũ và giá mới.
/// </summary>
[Collection("RealDatabaseTests")]
public sealed class T03C_EndToEndAuditFlowTests
{
    private static string GetConnectionString()
    {
        var envConn = Environment.GetEnvironmentVariable("TEST_DB_CONNECTION")
                   ?? Environment.GetEnvironmentVariable("HOTEL_SAAS_TEST_CONNECTION_STRING");
        var baseConn = !string.IsNullOrWhiteSpace(envConn)
            ? envConn
            : "Host=localhost;Port=5435;Database=hotel_saas_p1b01a_test;Username=postgres;Password=postgres;Persist Security Info=true;";

        var builder = new NpgsqlConnectionStringBuilder(baseConn)
        {
            Pooling = false,
            PersistSecurityInfo = true
        };
        return builder.ConnectionString;
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
            throw new InvalidOperationException($"SAFETY GUARD: Refusing to run tests on non-test database: {builder.Database}");
        }
    }

    private static async Task<NpgsqlConnection> CreateIsolatedSchemaAsync(string testSchema)
    {
        NpgsqlConnection.ClearAllPools();
        var connStr = GetConnectionString();
        ValidateTestDatabaseTarget(connStr);

        var conn = new NpgsqlConnection(connStr);
        await conn.OpenAsync();

        await using (var cmd = conn.CreateCommand())
        {
            cmd.CommandText = $"CREATE SCHEMA IF NOT EXISTS \"{testSchema}\"; SET search_path TO \"{testSchema}\";";
            await cmd.ExecuteNonQueryAsync();
        }

        return conn;
    }

    private static async Task DropIsolatedSchemaAsync(NpgsqlConnection conn, string testSchema)
    {
        if (!Regex.IsMatch(testSchema, @"^p1b01b_test_[a-zA-Z0-9]+$"))
        {
            throw new ArgumentException($"Invalid test schema name '{testSchema}'.");
        }

        if (conn.State != System.Data.ConnectionState.Open)
        {
            await conn.OpenAsync();
        }

        await using var cmd = conn.CreateCommand();
        cmd.CommandText = $"DROP SCHEMA IF EXISTS \"{testSchema}\" CASCADE;";
        await cmd.ExecuteNonQueryAsync();
        NpgsqlConnection.ClearAllPools();
    }

    private sealed class StubTenantService : ICurrentTenantService
    {
        public Guid? TenantId { get; set; }
    }

    private sealed class StubPropertyService : ICurrentPropertyService
    {
        public Guid? PropertyId { get; set; }
        public bool IsTenantWide { get; set; } = true;
        public IReadOnlyList<Guid> ExcludedPropertyIds { get; set; } = Array.Empty<Guid>();
        public Guid? HeaderPropertyId { get; set; }
        public Guid? TokenPropertyId { get; set; }
    }

    private sealed class StubUserContext : ICurrentUserContext
    {
        public Guid UserId { get; set; } = Guid.NewGuid();
        public string Email { get; set; } = "staff@luxestay.vn";
        public GlobalUserRole GlobalRole { get; set; } = GlobalUserRole.TenantStaff;
        public Guid? TenantId { get; set; }
        public TenantStatus? TenantStatus { get; set; } = Domain.Enums.TenantStatus.Active;
        public Guid? PropertyId { get; set; }
        public PropertyStatus? PropertyStatus { get; set; } = Domain.Enums.PropertyStatus.Active;
        public StaffRole? StaffRole { get; set; } = Domain.Enums.StaffRole.Manager;
        public Guid? RoleId { get; set; }
        public bool IsTenantWide { get; set; } = true;
        public bool IsAuthenticated => UserId != Guid.Empty;
        public IReadOnlyList<Guid> ExcludedPropertyIds { get; set; } = Array.Empty<Guid>();
        public string? IpAddress { get; set; } = "113.161.45.88";

        public void EnsureTenantContext() { }
        public void EnsurePropertyContext() { }
        public void SetUser(Guid userId, string email, GlobalUserRole globalRole)
        {
            UserId = userId;
            Email = email;
            GlobalRole = globalRole;
        }

        public void SetMembershipContext(
            Guid tenantId,
            TenantStatus tenantStatus,
            Guid? propertyId,
            PropertyStatus? propertyStatus,
            StaffRole? staffRole,
            Guid? roleId,
            bool isTenantWide)
        {
            TenantId = tenantId;
            TenantStatus = tenantStatus;
            PropertyId = propertyId;
            PropertyStatus = propertyStatus;
            StaffRole = staffRole;
            RoleId = roleId;
            IsTenantWide = isTenantWide;
        }
    }

    private sealed class StubMembershipLookupService : IMembershipLookupService
    {
        private readonly StaffRole _role;
        private readonly bool _isTenantWide;

        public StubMembershipLookupService(StaffRole role = StaffRole.Owner, bool isTenantWide = true)
        {
            _role = role;
            _isTenantWide = isTenantWide;
        }

        public Task<MembershipLookupResult> ResolveMembershipAsync(
            Guid tenantId,
            Guid userId,
            Guid? targetPropertyId,
            CancellationToken cancellationToken = default)
        {
            return Task.FromResult(MembershipLookupResult.Succeeded(
                Guid.NewGuid(),
                _role,
                targetPropertyId,
                _isTenantWide,
                Array.Empty<Guid>()));
        }
    }

    private static ApplicationDbContext CreateAuditedDbContext(
        string connString,
        string testSchema,
        ICurrentTenantService tenantService,
        ICurrentPropertyService propertyService,
        ICurrentUserContext userContext,
        AuditInterceptorOptions? customOptions = null)
    {
        var builder = new NpgsqlConnectionStringBuilder(connString)
        {
            SearchPath = testSchema,
            Pooling = false
        };

        var tenantInterceptor = new TenantPropertySaveChangesInterceptor(tenantService, propertyService);
        var auditInterceptor = new AuditSaveChangesInterceptor(tenantService, propertyService, userContext, customOptions);

        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(builder.ConnectionString, npgsql =>
                npgsql.MigrationsAssembly(typeof(ApplicationDbContext).Assembly.FullName))
            .ConfigureWarnings(w =>
                w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.PendingModelChangesWarning))
            .AddInterceptors(tenantInterceptor, auditInterceptor)
            .Options;

        return new ApplicationDbContext(options, tenantService, propertyService);
    }

    [Fact]
    public async Task EndToEndFlow_StaffUpdatesRate_AuditRecorded_OwnerViewsExactOldAndNewPrices()
    {
        var testSchema = $"p1b01b_test_{Guid.NewGuid():N}";
        await using var conn = await CreateIsolatedSchemaAsync(testSchema);
        var connStr = GetConnectionString();

        try
        {
            var tenantId = Guid.NewGuid();
            var propertyId = Guid.NewGuid();
            var roomTypeId = Guid.NewGuid();
            var staffUserId = Guid.NewGuid();
            var ownerUserId = Guid.NewGuid();

            var tenantService = new StubTenantService { TenantId = tenantId };
            var propertyService = new StubPropertyService { PropertyId = propertyId, IsTenantWide = true };
            var initUserContext = new StubUserContext
            {
                UserId = ownerUserId,
                Email = "owner.e2e@luxestay.vn",
                TenantId = tenantId,
                PropertyId = propertyId,
                StaffRole = StaffRole.Owner,
                IsTenantWide = true
            };

            // 1. SETUP HIERARCHY VÀ SEED BẢNG GIÁ BAN ĐẦU: 850.000 đ
            Guid rateId = Guid.NewGuid();
            await using (var ctx = CreateAuditedDbContext(connStr, testSchema, tenantService, propertyService, initUserContext))
            {
                await ctx.Database.MigrateAsync();

                ctx.Tenants.Add(new Tenant
                {
                    Id = tenantId,
                    Name = "LuxeStay Hospitality E2E",
                    Code = $"LSG-{tenantId.ToString("N")[..6]}",
                    Slug = $"luxestay-{tenantId.ToString("N")[..6]}",
                    Address = "100 Nguyễn Huệ",
                    City = "Hồ Chí Minh",
                    Status = TenantStatus.Active
                });

                ctx.Properties.Add(new Property
                {
                    Id = propertyId,
                    TenantId = tenantId,
                    Name = "Khách sạn LuxeStay Đà Lạt",
                    Code = "CN-DL",
                    Slug = $"luxestay-dl-{propertyId.ToString("N")[..6]}",
                    Address = "12 Hoàng Hoa Thám, Đà Lạt",
                    City = "Đà Lạt",
                    Status = PropertyStatus.Active
                });

                ctx.Users.AddRange(
                    new User
                    {
                        Id = staffUserId,
                        TenantId = tenantId,
                        Email = "staff.e2e@luxestay.vn",
                        FullName = "Nguyễn Văn Nhân Viên",
                        PasswordHash = "hashed_pw"
                    },
                    new User
                    {
                        Id = ownerUserId,
                        TenantId = tenantId,
                        Email = "owner.e2e@luxestay.vn",
                        FullName = "Trần Đại Gia (Owner)",
                        PasswordHash = "hashed_pw"
                    });

                ctx.RoomTypes.Add(new RoomType
                {
                    Id = roomTypeId,
                    TenantId = tenantId,
                    PropertyId = propertyId,
                    Code = "DLX-01",
                    Name = "Phòng Deluxe Hướng Núi",
                    BasePrice = 850000m,
                    MaxOccupancy = 2
                });

                ctx.RoomTypeRates.Add(new RoomTypeRate
                {
                    Id = rateId,
                    TenantId = tenantId,
                    PropertyId = propertyId,
                    RoomTypeId = roomTypeId,
                    NightlyPrice = 850000m,
                    FirstHours = 2,
                    FirstHoursPrice = 300000m,
                    AdditionalHourPrice = 80000m,
                    Currency = "VND",
                    EffectiveFrom = DateOnly.FromDateTime(DateTime.UtcNow),
                    EffectiveTo = DateOnly.FromDateTime(DateTime.UtcNow.AddMonths(1)),
                    IsActive = true,
                    ChangeReason = "Giá niêm yết ban đầu"
                });

                await ctx.SaveChangesAsync();
            }

            // 2. NHÂN VIÊN ĐỔI GIÁ PHÒNG: 850.000 đ -> 950.000 đ
            var staffContext = new StubUserContext
            {
                UserId = staffUserId,
                Email = "staff.e2e@luxestay.vn",
                TenantId = tenantId,
                PropertyId = propertyId,
                StaffRole = StaffRole.Manager,
                IpAddress = "113.161.45.88",
                IsTenantWide = false
            };

            await using (var ctx = CreateAuditedDbContext(connStr, testSchema, tenantService, propertyService, staffContext))
            {
                var rateToUpdate = await ctx.RoomTypeRates.FirstAsync(r => r.Id == rateId);
                rateToUpdate.NightlyPrice = 950000m;
                rateToUpdate.ChangeReason = "Điều chỉnh cao điểm Festival Hoa";

                await ctx.SaveChangesAsync();
            }

            // 3. KIỂM TRA DATABASE: Interceptor đã tự động ghi AuditLog
            Guid auditLogId;
            await using (var ctx = CreateAuditedDbContext(connStr, testSchema, tenantService, propertyService, staffContext))
            {
                var auditLog = await ctx.AuditLogs
                    .AsNoTracking()
                    .Where(a => a.EntityId == rateId && a.Action == "Update")
                    .OrderByDescending(a => a.CreatedAtUtc)
                    .FirstOrDefaultAsync();

                Assert.NotNull(auditLog);
                auditLogId = auditLog.Id;
                Assert.Equal("RoomTypeRate", auditLog.EntityName);
                Assert.Equal(staffUserId, auditLog.UserId);
                Assert.Equal(tenantId, auditLog.TenantId);
                Assert.Equal(propertyId, auditLog.PropertyId);
                Assert.Equal("113.161.45.88", auditLog.IpAddress);

                Assert.Contains("850000", auditLog.OldValues);
                Assert.Contains("950000", auditLog.NewValues);
            }

            // 4. OWNER ĐĂNG NHẬP VÀ MỞ MÀN HÌNH NHẬT KÝ KIỂM TOÁN
            var ownerContext = new StubUserContext
            {
                UserId = ownerUserId,
                Email = "owner.e2e@luxestay.vn",
                TenantId = tenantId,
                PropertyId = propertyId,
                StaffRole = StaffRole.Owner,
                IsTenantWide = true
            };
            var membershipService = new StubMembershipLookupService(StaffRole.Owner, isTenantWide: true);

            // 4A. GET /api/audit-logs (Danh sách tổng quan)
            await using (var ctx = CreateAuditedDbContext(connStr, testSchema, tenantService, propertyService, ownerContext))
            {
                var listHandler = new GetAuditLogsQueryHandler(ctx, tenantService, propertyService, ownerContext, membershipService);
                var query = new GetAuditLogsQuery
                {
                    PropertyId = propertyId,
                    EntityName = "RoomTypeRate",
                    Action = "Update",
                    Page = 1,
                    PageSize = 10
                };

                var pagedResult = await listHandler.Handle(query, CancellationToken.None);

                Assert.NotNull(pagedResult.Data);
                Assert.True(pagedResult.Data.TotalCount >= 1);
                var targetItem = pagedResult.Data.Items.FirstOrDefault(i => i.Id == auditLogId);
                Assert.NotNull(targetItem);
                Assert.Equal("RoomTypeRate", targetItem.EntityName);
                Assert.Equal(rateId, targetItem.EntityId);
                Assert.Equal("Nguyễn Văn Nhân Viên", targetItem.UserFullName);
                Assert.Equal("staff.e2e@luxestay.vn", targetItem.UserEmail);
                Assert.Contains("NightlyPrice", targetItem.ChangedFields);
            }

            // 4B. GET /api/audit-logs/{id} (Chi tiết so sánh giá cũ và giá mới)
            await using (var ctx = CreateAuditedDbContext(connStr, testSchema, tenantService, propertyService, ownerContext))
            {
                var detailHandler = new GetAuditLogByIdQueryHandler(ctx, tenantService, propertyService, ownerContext, membershipService);
                var detailQuery = new GetAuditLogByIdQuery(auditLogId, propertyId);

                var detailResult = await detailHandler.Handle(detailQuery, CancellationToken.None);

                Assert.NotNull(detailResult.Data);
                var detail = detailResult.Data;
                Assert.Equal(auditLogId, detail.Id);
                Assert.Equal("113.161.45.88", detail.IpAddress);
                Assert.Equal("Nguyễn Văn Nhân Viên", detail.UserFullName);

                // SO SÁNH GIÁ CŨ (850,000) VÀ GIÁ MỚI (950,000) CHÍNH XÁC
                var priceChange = detail.Changes.FirstOrDefault(c => c.FieldName == "NightlyPrice");
                Assert.NotNull(priceChange);
                Assert.Equal("850000", priceChange.OldValue);
                Assert.Equal("950000", priceChange.NewValue);

                var reasonChange = detail.Changes.FirstOrDefault(c => c.FieldName == "ChangeReason");
                Assert.NotNull(reasonChange);
                Assert.Equal("Giá niêm yết ban đầu", reasonChange.OldValue);
                Assert.Equal("Điều chỉnh cao điểm Festival Hoa", reasonChange.NewValue);
            }
        }
        finally
        {
            await DropIsolatedSchemaAsync(conn, testSchema);
        }
    }
}
