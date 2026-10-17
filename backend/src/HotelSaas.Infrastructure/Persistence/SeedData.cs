using HotelSaas.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Infrastructure.Persistence;

/// <summary>
/// Seeds default RBAC roles and permission functions into the database.
/// Only runs when no <see cref="AccessRole"/> records exist.
/// </summary>
public static class SeedData
{
    /// <summary>
    /// Creates default system permission functions and RBAC roles with bitmask-based action grants.
    /// </summary>
    /// <param name="context">The application database context.</param>
    public static async Task SeedDefaultRolesAndPermissions(ApplicationDbContext context)
    {
        if (await context.AccessRoles.AnyAsync())
        {
            await EnsureRolePermissionsUpToDateAsync(context);
            return;
        }

        // ── Permission Functions ──────────────────────────────────────────
        var permissions = new Dictionary<string, PermissionFunction>();
        var permissionDefs = new (string Code, string Name, string Module)[]
        {
            ("DASHBOARD",     "Dashboard",            "DASHBOARD"),
            ("ROOMS",         "Room Management",      "ROOMS"),
            ("ROOM_TYPES",    "Room Type Management", "ROOMS"),
            ("RESERVATIONS",  "Reservation Management","RESERVATIONS"),
            ("GUESTS",        "Guest Management",     "GUESTS"),
            ("CHECK_IN_OUT",  "Check-in / Check-out", "RESERVATIONS"),
            ("HOUSEKEEPING",  "Housekeeping",         "HOUSEKEEPING"),
            ("PAYMENTS",      "Payment Management",   "PAYMENTS"),
            ("INVOICES",      "Invoice Management",   "PAYMENTS"),
            ("REPORTS",       "Reports & Analytics",  "REPORTS"),
            ("STAFF",         "Staff Management",     "STAFF"),
            ("ROLES",         "Role Management",      "STAFF"),
            ("SETTINGS",      "System Settings",      "SETTINGS"),
            ("SUBSCRIPTIONS", "Subscription Management","SUBSCRIPTIONS"),
            ("PROMOTIONS",    "Promotions",           "PROMOTIONS"),
            ("REVIEWS",       "Guest Reviews",        "REVIEWS"),
            ("AI_FEATURES",   "AI Features",          "AI_FEATURES"),
        };

        foreach (var (code, name, module) in permissionDefs)
        {
            var pf = new PermissionFunction
            {
                Id = Guid.NewGuid(),
                Code = code,
                Name = name,
                ModuleCode = module,
                SupportedActionMask = 127,
                IsActive = true
            };
            permissions[code] = pf;
        }

        await context.PermissionFunctions.AddRangeAsync(permissions.Values);

        // ── Helper to create role permissions ─────────────────────────────
        const int All = 127;
        const int Read = 1;
        const int ReadCreate = 3;         // Read(1) + Create(2)
        const int ReadCreateUpdate = 7;   // Read(1) + Create(2) + Update(4)
        const int ReadUpdate = 5;         // Read(1) + Update(4)
        const int ReadExport = 33;        // Read(1) + Export(32)

        static List<RolePermission> BuildPermissions(
            Guid roleId,
            Dictionary<string, PermissionFunction> perms,
            params (string code, int mask)[] grants)
        {
            var result = new List<RolePermission>();
            foreach (var (code, mask) in grants)
            {
                result.Add(new RolePermission
                {
                    Id = Guid.NewGuid(),
                    RoleId = roleId,
                    FunctionId = perms[code].Id,
                    ActionMask = mask
                });
            }
            return result;
        }

        // ── SUPER_ADMIN ───────────────────────────────────────────────────
        var superAdminId = Guid.NewGuid();
        var superAdmin = new AccessRole
        {
            Id = superAdminId,
            Code = "SUPER_ADMIN",
            Name = "Super Administrator",
            Description = "Full platform access with all permissions.",
            IsSystemRole = true
        };
        var superAdminPerms = BuildPermissions(superAdminId, permissions,
            ("DASHBOARD", All), ("ROOMS", All), ("ROOM_TYPES", All),
            ("RESERVATIONS", All), ("GUESTS", All), ("CHECK_IN_OUT", All),
            ("HOUSEKEEPING", All), ("PAYMENTS", All), ("INVOICES", All),
            ("REPORTS", All), ("STAFF", All), ("ROLES", All),
            ("SETTINGS", All), ("SUBSCRIPTIONS", All), ("PROMOTIONS", All),
            ("REVIEWS", All), ("AI_FEATURES", All));

        // ── OWNER ─────────────────────────────────────────────────────────
        var ownerId = Guid.NewGuid();
        var owner = new AccessRole
        {
            Id = ownerId,
            Code = "OWNER",
            Name = "Hotel Owner",
            Description = "Full property access with read-only subscription visibility.",
            IsSystemRole = true
        };
        var ownerPerms = BuildPermissions(ownerId, permissions,
            ("DASHBOARD", All), ("ROOMS", All), ("ROOM_TYPES", All),
            ("RESERVATIONS", All), ("GUESTS", All), ("CHECK_IN_OUT", All),
            ("HOUSEKEEPING", All), ("PAYMENTS", All), ("INVOICES", All),
            ("REPORTS", All), ("STAFF", All), ("ROLES", All),
            ("SETTINGS", All), ("SUBSCRIPTIONS", Read), ("PROMOTIONS", All),
            ("REVIEWS", All), ("AI_FEATURES", All));

        // ── MANAGER ───────────────────────────────────────────────────────
        var managerId = Guid.NewGuid();
        var manager = new AccessRole
        {
            Id = managerId,
            Code = "MANAGER",
            Name = "Hotel Manager",
            Description = "Operational management with limited staff and settings access.",
            IsSystemRole = true
        };
        var managerPerms = BuildPermissions(managerId, permissions,
            ("ROOMS", All), ("ROOM_TYPES", All), ("RESERVATIONS", All),
            ("GUESTS", All), ("CHECK_IN_OUT", All), ("HOUSEKEEPING", All),
            ("PAYMENTS", All), ("INVOICES", All), ("REPORTS", All),
            ("STAFF", ReadCreate), ("ROLES", Read), ("SETTINGS", Read));

        // ── RECEPTIONIST ──────────────────────────────────────────────────
        var receptionistId = Guid.NewGuid();
        var receptionist = new AccessRole
        {
            Id = receptionistId,
            Code = "RECEPTIONIST",
            Name = "Receptionist",
            Description = "Front desk operations including reservations, guests, and check-in/out.",
            IsSystemRole = true
        };
        var receptionistPerms = BuildPermissions(receptionistId, permissions,
            ("DASHBOARD", Read), ("ROOMS", Read), ("ROOM_TYPES", Read),
            ("RESERVATIONS", ReadCreateUpdate), ("GUESTS", ReadCreateUpdate),
            ("CHECK_IN_OUT", ReadCreateUpdate), ("PAYMENTS", ReadCreate),
            ("INVOICES", ReadExport));

        // ── HOUSEKEEPER ───────────────────────────────────────────────────
        var housekeeperId = Guid.NewGuid();
        var housekeeper = new AccessRole
        {
            Id = housekeeperId,
            Code = "HOUSEKEEPER",
            Name = "Housekeeper",
            Description = "View rooms and manage housekeeping tasks.",
            IsSystemRole = true
        };
        var housekeeperPerms = BuildPermissions(housekeeperId, permissions,
            ("DASHBOARD", Read), ("ROOMS", Read),
            ("HOUSEKEEPING", ReadUpdate));

        // ── Persist ───────────────────────────────────────────────────────
        context.AccessRoles.AddRange(superAdmin, owner, manager, receptionist, housekeeper);
        context.RolePermissions.AddRange(
            [.. superAdminPerms, .. ownerPerms, .. managerPerms,
             .. receptionistPerms, .. housekeeperPerms]);

        await context.SaveChangesAsync();
    }

    private static async Task EnsureRolePermissionsUpToDateAsync(ApplicationDbContext context)
    {
        var receptionistRole = await context.AccessRoles.FirstOrDefaultAsync(r => r.Code == "RECEPTIONIST");
        if (receptionistRole == null) return;

        var roomTypesFunc = await context.PermissionFunctions.FirstOrDefaultAsync(f => f.Code == "ROOM_TYPES");
        if (roomTypesFunc == null) return;

        const int Read = 1;
        var existingPerm = await context.RolePermissions
            .FirstOrDefaultAsync(rp => rp.RoleId == receptionistRole.Id && rp.FunctionId == roomTypesFunc.Id);

        if (existingPerm == null)
        {
            context.RolePermissions.Add(new RolePermission
            {
                Id = Guid.NewGuid(),
                RoleId = receptionistRole.Id,
                FunctionId = roomTypesFunc.Id,
                ActionMask = Read
            });
            await context.SaveChangesAsync();
        }
        else if ((existingPerm.ActionMask & Read) != Read)
        {
            existingPerm.ActionMask |= Read;
            await context.SaveChangesAsync();
        }
    }
}
