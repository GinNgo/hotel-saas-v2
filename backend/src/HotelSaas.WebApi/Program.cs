using System.Text;
using HotelSaas.Application;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Infrastructure;
using HotelSaas.Infrastructure.Persistence;
using HotelSaas.Infrastructure.Services;
using HotelSaas.WebApi.Authorization;
using HotelSaas.WebApi.Middleware;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

// ── Serilog ───────────────────────────────────────────────────────────
builder.Host.UseSerilog((ctx, cfg) =>
    cfg.ReadFrom.Configuration(ctx.Configuration));

// ── Application & Infrastructure DI ──────────────────────────────────
builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);

// ── JWT Authentication ───────────────────────────────────────────────
var jwtSettings = builder.Configuration.GetSection("JwtSettings");
var secretKey = JwtKeyValidator.ValidateSecretKey(jwtSettings["SecretKey"]);

builder.Services
    .AddAuthentication(options =>
    {
        options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
        options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
    })
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtSettings["Issuer"] ?? "HotelSaas",
            ValidAudience = jwtSettings["Audience"] ?? "HotelSaasClient",
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(secretKey)),
            ClockSkew = TimeSpan.FromSeconds(30)
        };
    });

// ── Authorization ────────────────────────────────────────────────────
builder.Services.AddAuthorizationBuilder();
builder.Services.AddScoped<IAuthorizationHandler, PermissionAuthorizationHandler>();

// ── Controllers ──────────────────────────────────────────────────────
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter());
        options.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
        options.JsonSerializerOptions.DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull;
    });

// ── Swagger / OpenAPI ────────────────────────────────────────────────
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// ── CORS ─────────────────────────────────────────────────────────────
builder.Services.AddCors(options =>
    options.AddPolicy("Angular", policy =>
        policy
            .WithOrigins("http://localhost:4200")
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials()));

var app = builder.Build();

// ── Database Migration & Seeding Guard (Task C01) ──────────────────────
var effectiveConnStr = DatabaseConnectionResolver.ResolveConnectionString(builder.Configuration);
var isCloudDb = CloudDatabaseGuard.IsCloudDatabase(effectiveConnStr);

var isTestingEnv = app.Environment.IsEnvironment("Testing");
var explicitSkip = builder.Configuration.GetValue<bool>("SkipStartupDatabaseInit");
var allowCloudInit = builder.Configuration.GetValue<bool>("AllowCloudStartupDatabaseInit");

var shouldSkipStartupInit = isTestingEnv || explicitSkip || (isCloudDb && !allowCloudInit);

if (!shouldSkipStartupInit)
{
    CloudDatabaseGuard.ValidateStartupExecution(effectiveConnStr, builder.Configuration);

    using (var scope = app.Services.CreateScope())
    {
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        await context.Database.MigrateAsync();
        await SeedData.SeedDefaultRolesAndPermissions(context);

        var canRunDevSeeder = !isCloudDb || builder.Configuration.GetValue<bool>("AllowCloudDevSeed");
        if (app.Environment.IsDevelopment() && canRunDevSeeder && !string.IsNullOrWhiteSpace(effectiveConnStr))
        {
            try
            {
                var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher>();
                await LocalDevDataSeeder.SeedAsync(effectiveConnStr, new LocalDevSeedOptions(), hasher);
                Log.Information("LocalDevDataSeeder executed successfully.");
                await SeedData.SeedPlatformAdminDataAsync(context);
            }
            catch (Exception ex)
            {
                Log.Warning(ex, "LocalDevDataSeeder note: {Message}", ex.Message);
            }
        }
        else if (isCloudDb && !canRunDevSeeder)
        {
            Log.Information("CloudDatabaseGuard (Task C01): Bỏ qua LocalDevDataSeeder trên Cloud Database để bảo toàn dữ liệu dùng chung của nhóm.");
        }
    }
}
else if (isCloudDb && !allowCloudInit && !isTestingEnv)
{
    Log.Information("CloudDatabaseGuard (Task C01): Tự động bật SkipStartupDatabaseInit trên Cloud DB để bảo vệ cơ sở dữ liệu chung. Cấu hình AllowCloudStartupDatabaseInit=true nếu cần chạy migration có chủ đích.");
}

// ── Middleware Pipeline ──────────────────────────────────────────────
app.UseMiddleware<ExceptionHandlingMiddleware>();
app.UseSerilogRequestLogging();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("Angular");
app.UseAuthentication();
app.UseMiddleware<TenantPropertyContextMiddleware>();
app.UseAuthorization();
app.MapControllers();

app.Run();

public partial class Program { }
