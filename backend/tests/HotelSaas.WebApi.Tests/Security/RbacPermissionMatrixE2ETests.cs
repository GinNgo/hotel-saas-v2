using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Reflection;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using HotelSaas.WebApi.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace HotelSaas.WebApi.Tests.Security;

/// <summary>Real HTTP/JWT/PostgreSQL negative matrix. Missing production guards fail coverage explicitly.</summary>
[Collection("RealDatabaseTests")]
public sealed class RbacPermissionMatrixE2ETests
{
    private static readonly string[] Codes = ["DASHBOARD", "PROPERTIES", "ROOMS", "ROOM_TYPES", "RESERVATIONS",
        "GUESTS", "CHECK_IN_OUT", "HOUSEKEEPING", "PAYMENTS", "INVOICES", "REPORTS", "STAFF", "ROLES",
        "SETTINGS", "SUBSCRIPTIONS", "PROMOTIONS", "REVIEWS", "AI_FEATURES", "AUDIT_LOGS"];

    private sealed record Probe(string Code, string Method, string Route);

    private static List<Probe> DiscoverProbes()
    {
        var probes = new List<Probe>();
        foreach (var type in typeof(Program).Assembly.GetTypes().Where(t => typeof(ControllerBase).IsAssignableFrom(t)))
        {
            var prefix = type.GetCustomAttributes<RouteAttribute>(inherit: false).FirstOrDefault()?.Template ?? "";
            foreach (var method in type.GetMethods())
            {
                var verb = method.GetCustomAttributes<HttpMethodAttribute>().FirstOrDefault();
                if (verb == null) continue;
                var requirements = method.GetCustomAttributes(inherit: true)
                    .Concat(type.GetCustomAttributes(inherit: true))
                    .OfType<IAuthorizationRequirementData>()
                    .SelectMany(attr => attr.GetRequirements())
                    .OfType<PermissionRequirement>()
                    .SelectMany(req => req.AlternativePermissions);
                foreach (var permission in requirements)
                {
                    var route = (verb.Template?.StartsWith('/') == true ? verb.Template : "/" + prefix + "/" + verb.Template).TrimEnd('/');
                    route = System.Text.RegularExpressions.Regex.Replace(route, "\\{[^}]+\\}", "11111111-1111-1111-1111-111111111111");
                    probes.Add(new Probe(permission.FunctionCode, verb.HttpMethods.First(), route));
                }
            }
        }
        return probes.GroupBy(p => p.Code).Select(g => g.OrderBy(p => p.Method == "GET" ? 0 : 1).First()).ToList();
    }

    [Fact]
    public void AllNineteenFunctions_HaveProductionPermissionGuard()
    {
        var covered = DiscoverProbes().Select(p => p.Code).ToHashSet();
        var missing = Codes.Where(code => !covered.Contains(code)).ToArray();
        Assert.True(missing.Length == 0, "Missing guarded endpoints (integration dependencies, not passing coverage): " + string.Join(", ", missing));
    }

    [Fact]
    public void AuditLogsReadEndpoints_HaveProductionPermissionGuard()
    {
        var auditController = typeof(Program).Assembly.GetTypes()
            .Single(t => t.Name == "AuditLogsController" && typeof(ControllerBase).IsAssignableFrom(t));
        var readMethods = new[] { "GetList", "GetById" };
        var unguarded = new List<string>();
        foreach (var methodName in readMethods)
        {
            var method = auditController.GetMethod(methodName);
            Assert.NotNull(method);
            var hasAuditLogsGuard = method!.GetCustomAttributes(inherit: true)
                .Concat(auditController.GetCustomAttributes(inherit: true))
                .OfType<IAuthorizationRequirementData>()
                .SelectMany(attr => attr.GetRequirements())
                .OfType<PermissionRequirement>()
                .SelectMany(req => req.AlternativePermissions)
                .Any(p => p.FunctionCode == "AUDIT_LOGS");
            if (!hasAuditLogsGuard)
            {
                unguarded.Add($"AuditLogsController.{methodName}");
            }
        }
        Assert.True(unguarded.Count == 0,
            "AUDIT_LOGS read endpoints missing production permission guard (only POST /api/audit-logs/events is guarded): " + string.Join(", ", unguarded));
    }

    [Theory]
    [InlineData("HOUSEKEEPER", StaffRole.Housekeeper)]
    [InlineData("RECEPTIONIST", StaffRole.Receptionist)]
    [InlineData("MANAGER", StaffRole.Manager)]
    [InlineData("OWNER", StaffRole.Owner)]
    [InlineData("SUPER_ADMIN", null)]
    [InlineData("Customer", null)]
    public async Task MissingPermissions_RejectEveryGuardedFunction_DespiteForgedPermissionClaims(string roleCode, StaffRole? staffRole)
    {
        await CrossBranchSecurityE2ETests.RunInIsolatedEnvironmentAsync(async fixture =>
        {
            var userId = Guid.NewGuid();
            var roleId = Guid.NewGuid();
            var globalRole = staffRole.HasValue ? GlobalUserRole.TenantStaff :
                roleCode == "SUPER_ADMIN" ? GlobalUserRole.SuperAdmin : GlobalUserRole.Customer;
            await using (var db = CrossBranchSecurityE2ETests.CreateSeedDbContext(fixture.BaseConnectionString, fixture.TestSchema, fixture.TenantAId))
            {
                var seededCodes = await db.PermissionFunctions.Select(f => f.Code).ToListAsync();
                Assert.All(Codes, code => Assert.Contains(code, seededCodes));
                db.Users.Add(new User { Id = userId, Username = "matrix-" + userId.ToString("N"), Email = userId + "@matrix.test",
                    FullName = roleCode, PasswordHash = "unused-no-password-login", IsActive = true, GlobalRole = globalRole });
                if (staffRole.HasValue)
                {
                    // Same business role, deliberately no DB permissions: JWT claims cannot grant access.
                    db.AccessRoles.Add(new AccessRole { Id = roleId, Code = "MATRIX_" + roleCode, Name = roleCode, TenantId = fixture.TenantAId });
                    db.TenantStaffMembers.Add(new TenantStaff { Id = Guid.NewGuid(), UserId = userId, TenantId = fixture.TenantAId,
                        PropertyId = fixture.BranchAId, RoleId = roleId, StaffRole = staffRole.Value, IsActive = true });
                }
                await db.SaveChangesAsync();
            }
            using var scope = fixture.Factory.Services.CreateScope();
            var jwt = scope.ServiceProvider.GetRequiredService<IJwtService>();
            var token = jwt.GenerateTokens(userId, userId + "@matrix.test", roleCode, globalRole.ToString(),
                fixture.TenantAId, Codes.Select(c => c + ":127").ToArray(), fixture.BranchAId, "property", staffRole?.ToString()).accessToken;
            using var client = fixture.Factory.CreateClient();
            var probes = DiscoverProbes().Where(p => Codes.Contains(p.Code)).ToList();
            foreach (var probe in probes)
            {
                using var anonymous = await client.SendAsync(Request(probe, fixture.BranchAId, null));
                Assert.True(anonymous.StatusCode == HttpStatusCode.Unauthorized, $"Anonymous {probe.Code}: {(int)anonymous.StatusCode}");
                using var denied = await client.SendAsync(Request(probe, fixture.BranchAId, token));
                Assert.True(denied.StatusCode == HttpStatusCode.Forbidden, $"{roleCode}/{probe.Code}: expected 403, got {(int)denied.StatusCode}");
            }
            if (staffRole.HasValue)
            {
                // Positive control proves valid membership and real DB-driven permission evaluation.
                await using var db = CrossBranchSecurityE2ETests.CreateSeedDbContext(fixture.BaseConnectionString, fixture.TestSchema, fixture.TenantAId);
                var roomsFunction = await db.PermissionFunctions.SingleAsync(f => f.Code == "ROOMS");
                db.RolePermissions.Add(new RolePermission { RoleId = roleId, FunctionId = roomsFunction.Id, ActionMask = 1 });
                await db.SaveChangesAsync();
                using var allowed = await client.SendAsync(Request(new Probe("ROOMS", "GET", "/api/rooms"), fixture.BranchAId, token));
                Assert.Equal(HttpStatusCode.OK, allowed.StatusCode);
            }
        });
    }

    private static HttpRequestMessage Request(Probe probe, Guid propertyId, string? token)
    {
        var request = new HttpRequestMessage(new HttpMethod(probe.Method), probe.Route + "?propertyId=" + propertyId);
        request.Headers.Add("X-Property-Id", propertyId.ToString());
        if (token != null) request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        if (probe.Method != "GET") request.Content = JsonContent.Create(new { });
        return request;
    }
}
