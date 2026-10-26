using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
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
            ("PROPERTIES",    "Property Management",  "PROPERTIES"),
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
            ("DASHBOARD", All), ("PROPERTIES", All), ("ROOMS", All), ("ROOM_TYPES", All),
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
            ("DASHBOARD", All), ("PROPERTIES", All), ("ROOMS", All), ("ROOM_TYPES", All),
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
            ("PROPERTIES", ReadUpdate), ("ROOMS", All), ("ROOM_TYPES", All), ("RESERVATIONS", All),
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
        await SeedPlatformAdminDataAsync(context);
    }

    /// <summary>
    /// Seeds default platform subscription plans, print template configurations, and sample tenant contracts.
    /// </summary>
    public static async Task SeedPlatformAdminDataAsync(ApplicationDbContext context)
    {
        // 0. SuperAdmin User Account
        var existingSuperAdmin = await context.Users
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(u => u.Email == "superadmin@hotelsaas.platform");

        if (existingSuperAdmin == null)
        {
            var hasher = new HotelSaas.Infrastructure.Services.PasswordHasherService();
            var superAdminUser = new User
            {
                Id = Guid.NewGuid(),
                Username = "superadmin",
                Email = "superadmin@hotelsaas.platform",
                PasswordHash = hasher.Hash("HotelDev@2026!"),
                FullName = "Quản Trị Viên Nền Tảng (SuperAdmin)",
                GlobalRole = GlobalUserRole.SuperAdmin,
                IsActive = true,
                CreatedAtUtc = DateTime.UtcNow
            };
            context.Users.Add(superAdminUser);
            await context.SaveChangesAsync();
        }

        // 1. Subscription Plans
        if (!await context.SubscriptionPlans.AnyAsync())
        {
            var starter = new SubscriptionPlan
            {
                Id = Guid.NewGuid(),
                Code = "STARTER",
                Name = "Gói Khởi Nghiệp (Starter)",
                MonthlyPrice = 299000,
                YearlyPrice = 2990000,
                Description = "Phù hợp cho nhà nghỉ, homestay và khách sạn mini quy mô dưới 15 phòng.",
                MaxRooms = 15,
                MaxProperties = 1,
                MaxStaff = 3,
                FeaturesJson = "[\"Quản lý sơ đồ phòng trực quan\",\"Đặt phòng theo Giờ, Đêm, Ngày\",\"In hóa đơn & phiếu VietQR tự động\",\"Báo cáo doanh thu & công suất cơ bản\"]",
                IsPopular = false,
                SortOrder = 1,
                HasVnPay = true,
                HasAdvancedReports = false,
                IsActive = true
            };

            var pro = new SubscriptionPlan
            {
                Id = Guid.NewGuid(),
                Code = "PRO",
                Name = "Gói Chuyên Nghiệp (Pro)",
                MonthlyPrice = 699000,
                YearlyPrice = 6990000,
                Description = "Tối ưu cho khách sạn boutique, chuỗi 2-3 cơ sở với tính năng AI gợi ý giá và thanh toán tự động.",
                MaxRooms = 50,
                MaxProperties = 3,
                MaxStaff = 10,
                FeaturesJson = "[\"Toàn bộ tính năng gói Starter\",\"Hỗ trợ chuỗi tối đa 3 chi nhánh\",\"AI gợi ý giá phòng & phân tích công suất\",\"Đồng bộ cổng thanh toán VietQR & VNPay\",\"Báo cáo chuyên sâu P&L và công suất phòng\",\"Quản lý kho mini-bar & dịch vụ giặt là\"]",
                IsPopular = true,
                SortOrder = 2,
                HasVnPay = true,
                HasAdvancedReports = true,
                IsActive = true
            };

            var enterprise = new SubscriptionPlan
            {
                Id = Guid.NewGuid(),
                Code = "ENTERPRISE",
                Name = "Gói Doanh Nghiệp (Enterprise)",
                MonthlyPrice = 1499000,
                YearlyPrice = 14990000,
                Description = "Giải pháp toàn diện cho chuỗi khách sạn lớn, resort cao cấp không giới hạn chi nhánh và phòng.",
                MaxRooms = 9999,
                MaxProperties = 50,
                MaxStaff = 100,
                FeaturesJson = "[\"Không giới hạn số phòng và số chi nhánh\",\"Hệ thống Loyalty & tích điểm thành viên chuỗi\",\"Tích hợp API phần mềm kế toán & khóa từ thông minh\",\"Hỗ trợ kỹ thuật 24/7 & chuyên viên triển khai riêng\",\"Ký hợp đồng dịch vụ SLA cam kết 99.9% uptime\"]",
                IsPopular = false,
                SortOrder = 3,
                HasVnPay = true,
                HasAdvancedReports = true,
                IsActive = true
            };

            context.SubscriptionPlans.AddRange(starter, pro, enterprise);
            await context.SaveChangesAsync();
        }

        // 2. Print Template Config for existing Tenants
        var tenants = await context.Tenants.IgnoreQueryFilters().ToListAsync();
        foreach (var tenant in tenants)
        {
            var hasConfig = await context.PrintTemplateConfigs
                .IgnoreQueryFilters()
                .AnyAsync(c => c.TenantId == tenant.Id);

            if (!hasConfig)
            {
                var template = new PrintTemplateConfig
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenant.Id,
                    HeaderCompanyName = tenant.Name,
                    HeaderAddress = "123 Đồng Khởi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh",
                    TaxNumber = "0318928374",
                    Hotline = "1900 6868",
                    LogoUrl = "/images/saigon-riverside-tower.png",
                    BankName = "MBBank",
                    BankAccountNumber = "999988887777",
                    BankAccountHolder = $"CTY CP DU LICH {tenant.Name.ToUpperInvariant()}",
                    FooterNote = "Cảm ơn Quý khách đã tin tưởng và sử dụng dịch vụ của chúng tôi! Chúc Quý khách một kỳ nghỉ tuyệt vời.",
                    CheckInPolicyText = "Nhận phòng: 14:00 - Trả phòng: 12:00. Vui lòng xuất trình CCCD/Hộ chiếu khi check-in.",
                    ShowVietQrCode = true,
                    DefaultPaperSize = "A4"
                };
                context.PrintTemplateConfigs.Add(template);
            }

            // 3. Tenant Contract
            var hasContract = await context.TenantContracts
                .IgnoreQueryFilters()
                .AnyAsync(c => c.TenantId == tenant.Id);

            if (!hasContract)
            {
                var contract = new TenantContract
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenant.Id,
                    ContractNumber = $"HD-2026-PRO-00{tenant.Code}",
                    PlanCode = "PRO",
                    PlanName = "Gói Chuyên Nghiệp (Pro)",
                    ContractType = "Standard",
                    RepresentativeName = "Nguyễn Văn Toàn",
                    RepresentativeEmail = "owner@hotelsaas.local",
                    RepresentativePhone = "0909123456",
                    StartDate = DateOnly.FromDateTime(DateTime.UtcNow.AddMonths(-1)),
                    EndDate = DateOnly.FromDateTime(DateTime.UtcNow.AddMonths(11)),
                    BillingCycle = HotelSaas.Domain.Enums.BillingCycle.Annual,
                    ContractValue = 6990000,
                    Status = TenantContractStatus.Active,
                    SignedAtUtc = DateTime.UtcNow.AddMonths(-1),
                    DigitalSignatureHash = "SHA256:7a9c8b2d3e4f1a2b3c4d5e6f7a8b9c0d1e2f3a4b",
                    TermsAndConditions = "Bên A cung cấp bản quyền phần mềm quản trị chuỗi khách sạn Hotel SaaS v2 tiêu chuẩn SLA 99.9%. Bên B cam kết thanh toán đúng hạn và bảo mật tài khoản quản trị.",
                    Notes = "Hợp đồng thường niên gói Pro cho chuỗi khách sạn."
                };
                context.TenantContracts.Add(contract);
            }
        }

        await context.SaveChangesAsync();

        // 4. Seed 34 Real Hotels across 34 Key Tourist Provinces (GHG, VEH, SCR)
        await RealData34ProvincesSeeder.SeedAsync(context);
    }

    private static async Task EnsureRolePermissionsUpToDateAsync(ApplicationDbContext context)
    {
        // Ensure PROPERTIES permission function exists
        var propertiesFunc = await context.PermissionFunctions.FirstOrDefaultAsync(f => f.Code == "PROPERTIES");
        if (propertiesFunc == null)
        {
            propertiesFunc = new PermissionFunction
            {
                Id = Guid.NewGuid(),
                Code = "PROPERTIES",
                Name = "Property Management",
                ModuleCode = "PROPERTIES",
                SupportedActionMask = 127,
                IsActive = true
            };
            context.PermissionFunctions.Add(propertiesFunc);
            await context.SaveChangesAsync();
        }

        // Ensure OWNER and SUPER_ADMIN have PROPERTIES:127
        var fullRoles = await context.AccessRoles
            .Where(r => r.Code == "OWNER" || r.Code == "SUPER_ADMIN")
            .ToListAsync();

        foreach (var role in fullRoles)
        {
            var existing = await context.RolePermissions
                .FirstOrDefaultAsync(rp => rp.RoleId == role.Id && rp.FunctionId == propertiesFunc.Id);
            if (existing == null)
            {
                context.RolePermissions.Add(new RolePermission
                {
                    Id = Guid.NewGuid(),
                    RoleId = role.Id,
                    FunctionId = propertiesFunc.Id,
                    ActionMask = 127
                });
            }
            else if (existing.ActionMask != 127)
            {
                existing.ActionMask = 127;
            }
        }
        await context.SaveChangesAsync();
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

        // Also ensure platform admin data is seeded even if roles already exist
        await SeedPlatformAdminDataAsync(context);
    }
}
