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

// ── Database Migration & Seeding ─────────────────────────────────────
if (!app.Environment.IsEnvironment("Testing") && !builder.Configuration.GetValue<bool>("SkipStartupDatabaseInit"))
{
    using (var scope = app.Services.CreateScope())
    {
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        await context.Database.MigrateAsync();
        await SeedData.SeedDefaultRolesAndPermissions(context);

        var connStr = builder.Configuration.GetConnectionString("DefaultConnection");
        if (app.Environment.IsDevelopment() && !string.IsNullOrWhiteSpace(connStr))
        {
            try
            {
                var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher>();
                await LocalDevDataSeeder.SeedAsync(connStr, new LocalDevSeedOptions(), hasher);
                Log.Information("LocalDevDataSeeder executed successfully.");
                await SeedData.SeedPlatformAdminDataAsync(context);
            }
            catch (Exception ex)
            {
                Log.Warning(ex, "LocalDevDataSeeder note: {Message}", ex.Message);
            }
        }
    }
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
