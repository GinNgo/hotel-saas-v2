using System;
using System.Threading.Tasks;
using HotelSaas.Infrastructure.Persistence;

namespace HotelSaas.Scripts.SeedLocalDev;

/// <summary>
/// CLI Entry point for local development mock data provisioning.
/// Ticket: BE-SEED-01
/// </summary>
public static class Program
{
    public static async Task<int> Main(string[] args)
    {
        Console.WriteLine("==================================================================");
        Console.WriteLine("  Hotel SaaS Platform - Local Development Mock Data Seeder        ");
        Console.WriteLine("  Ticket: BE-SEED-01 (Manual Provisioning CLI)                   ");
        Console.WriteLine("==================================================================");
        Console.WriteLine();

        string? connectionString = null;
        string? password = null;
        string schema = "public";
        bool allowTestDb = false;
        bool verbose = false;

        // Parse CLI arguments
        for (int i = 0; i < args.Length; i++)
        {
            var arg = args[i];

            if (arg is "-h" or "--help")
            {
                PrintUsage();
                return 0;
            }

            if (arg is "-c" or "--connection")
            {
                if (i + 1 < args.Length && !args[i + 1].StartsWith("-"))
                {
                    connectionString = args[++i];
                }
                else
                {
                    Console.ForegroundColor = ConsoleColor.Red;
                    Console.WriteLine("[ERROR] Missing argument value for --connection / -c");
                    Console.ResetColor();
                    return 1;
                }
            }
            else if (arg is "-p" or "--password")
            {
                if (i + 1 < args.Length && !args[i + 1].StartsWith("-"))
                {
                    password = args[++i];
                }
                else
                {
                    Console.ForegroundColor = ConsoleColor.Red;
                    Console.WriteLine("[ERROR] Missing argument value for --password / -p");
                    Console.ResetColor();
                    return 1;
                }
            }
            else if (arg is "-s" or "--schema")
            {
                if (i + 1 < args.Length && !args[i + 1].StartsWith("-"))
                {
                    schema = args[++i];
                }
                else
                {
                    Console.ForegroundColor = ConsoleColor.Red;
                    Console.WriteLine("[ERROR] Missing argument value for --schema / -s");
                    Console.ResetColor();
                    return 1;
                }
            }
            else if (arg is "--allow-test-db")
            {
                allowTestDb = true;
            }
            else if (arg is "-v" or "--verbose")
            {
                verbose = true;
            }
        }

        // Fallback to environment variables
        connectionString ??= Environment.GetEnvironmentVariable("DEV_DB_CONNECTION");
        password ??= Environment.GetEnvironmentVariable("SEED_DEFAULT_PASSWORD");

        if (string.IsNullOrWhiteSpace(connectionString))
        {
            Console.ForegroundColor = ConsoleColor.Red;
            Console.WriteLine("[ERROR] No connection string provided.");
            Console.ResetColor();
            Console.WriteLine("Please provide --connection \"Host=localhost;Database=hotel_saas_dev_<username>;Username=...;Password=...\"");
            Console.WriteLine("Or set environment variable DEV_DB_CONNECTION.");
            Console.WriteLine();
            PrintUsage();
            return 1;
        }

        var options = new LocalDevSeedOptions
        {
            TargetSchema = schema,
            AllowTestDatabases = allowTestDb
        };

        if (!string.IsNullOrWhiteSpace(password))
        {
            options.DefaultPassword = password;
        }

        var safeConnectionDisplay = LocalDevDataSeeder.RedactConnectionString(connectionString);
        Console.WriteLine($"[TARGET DATABASE] {safeConnectionDisplay}");
        Console.WriteLine($"[TARGET SCHEMA]   {options.TargetSchema}");
        Console.WriteLine($"[PASSWORD LENGTH] {options.DefaultPassword.Length} characters (Redacted)");
        Console.WriteLine();

        try
        {
            Console.WriteLine("[VALIDATING] Verifying target database isolation guard...");
            LocalDevDataSeeder.ValidateTargetDatabase(connectionString, options.AllowTestDatabases);
            Console.ForegroundColor = ConsoleColor.Green;
            Console.WriteLine("[SUCCESS] Target database satisfies security isolation policy.");
            Console.ResetColor();

            Console.WriteLine("[VALIDATING] Checking schema tables and EF Core migration status...");
            await LocalDevDataSeeder.ValidateSchemaAndMigrationsAsync(connectionString, options.TargetSchema);
            Console.ForegroundColor = ConsoleColor.Green;
            Console.WriteLine("[SUCCESS] Database schema is verified and ready for mock data.");
            Console.ResetColor();

            Console.WriteLine("[SEEDING] Starting transactional data provisioning...");
            var result = await LocalDevDataSeeder.SeedAsync(connectionString, options);

            Console.WriteLine();
            Console.ForegroundColor = ConsoleColor.Green;
            Console.WriteLine("==================================================================");
            Console.WriteLine("  MOCK DATA PROVISIONING COMPLETED SUCCESSFULLY!                  ");
            Console.WriteLine("==================================================================");
            Console.ResetColor();
            Console.WriteLine();
            Console.WriteLine($"Tenant:     [{result.TenantCode}] {LocalDevDataSeeder.SeedTenantName} ({result.TenantId})");
            Console.WriteLine($"Property 1: [{result.Property1Code}] {result.Property1Name} ({result.Property1Id})");
            Console.WriteLine($"Property 2: [{result.Property2Code}] {result.Property2Name} ({result.Property2Id})");
            Console.WriteLine();
            Console.WriteLine("Seeded Accounts (Password: Configured / Redacted):");
            Console.WriteLine($"  1. Owner (Tenant-Wide):     {result.OwnerEmail}");
            Console.WriteLine($"  2. Manager (Both Branches): {result.ManagerBothEmail}");
            Console.WriteLine($"  3. Receptionist (CN-Q1):    {result.ReceptionistSingleEmail}");
            Console.WriteLine();
            Console.WriteLine("Entities Provisioned / Inspected:");
            Console.WriteLine($"  - Users Created:       {result.UsersCreatedCount}");
            Console.WriteLine($"  - Memberships Created: {result.MembershipsCreatedCount}");
            Console.WriteLine($"  - RoomTypes Created:   {result.RoomTypesCreatedCount}");
            Console.WriteLine($"  - Rooms Created:       {result.RoomsCreatedCount}");
            Console.WriteLine($"  - Existing Preserved:  {(result.IsExistingDataPreserved ? "Yes (Idempotent Run)" : "No (Initial Clean Run)")}");
            Console.WriteLine();
            Console.WriteLine("Next Steps:");
            Console.WriteLine("  1. Login via POST /api/auth/login using one of the accounts above.");
            Console.WriteLine("  2. Select active branch context via POST /api/auth/switch-context.");
            Console.WriteLine("  3. Proceed with branch operations (Rooms, Housekeeping, etc.).");
            Console.WriteLine();
            return 0;
        }
        catch (Exception ex)
        {
            Console.WriteLine();
            Console.ForegroundColor = ConsoleColor.Red;
            Console.WriteLine("==================================================================");
            Console.WriteLine("  PROVISIONING FAILED (ROLLED BACK CLEANLY)                      ");
            Console.WriteLine("==================================================================");
            Console.WriteLine($"Error: {ex.Message}");
            Console.ResetColor();

            if (verbose)
            {
                Console.WriteLine();
                Console.WriteLine("Stack Trace:");
                Console.WriteLine(ex.ToString());
            }

            Console.WriteLine();
            return 1;
        }
    }

    private static void PrintUsage()
    {
        Console.WriteLine("Usage:");
        Console.WriteLine("  dotnet run --project scripts/SeedLocalDev -- [options]");
        Console.WriteLine();
        Console.WriteLine("Options:");
        Console.WriteLine("  -c, --connection <string>  PostgreSQL connection string (Required if DEV_DB_CONNECTION not set).");
        Console.WriteLine("                             Must target 'hotel_saas_dev_<username>' (e.g. hotel_saas_dev_ngoc).");
        Console.WriteLine("  -p, --password <password>  Password to set for seeded users (min 8 chars, default: HotelDev@2026!).");
        Console.WriteLine("  -s, --schema <schema>      Target schema name (default: public).");
        Console.WriteLine("      --allow-test-db        Allows execution on authorized test databases (for test suites).");
        Console.WriteLine("  -v, --verbose              Display detailed exception stack traces on failure.");
        Console.WriteLine("  -h, --help                 Display this help message.");
        Console.WriteLine();
        Console.WriteLine("Environment Variables:");
        Console.WriteLine("  DEV_DB_CONNECTION          Default connection string if --connection is omitted.");
        Console.WriteLine("  SEED_DEFAULT_PASSWORD      Default user password if --password is omitted.");
        Console.WriteLine();
        Console.WriteLine("Security Rules:");
        Console.WriteLine("  - Strictly disallows shared 'hotel_saas_dev', staging, or production databases.");
        Console.WriteLine("  - Fails fast if migrations have not been applied yet.");
        Console.WriteLine("  - Idempotent: re-running does not duplicate records or overwrite passwords.");
        Console.WriteLine();
    }
}
