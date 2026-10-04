using System.Text;
using HotelSaas.Application;
using HotelSaas.Infrastructure;
using HotelSaas.Infrastructure.Persistence;
using HotelSaas.WebApi.Authorization;
using HotelSaas.WebApi.Middleware;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
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
var secretKey = jwtSettings["SecretKey"]
    ?? throw new InvalidOperationException("JwtSettings:SecretKey is not configured.");

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
builder.Services.AddControllers();

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
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    await context.Database.EnsureCreatedAsync();
    await SeedData.SeedDefaultRolesAndPermissions(context);
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
app.UseAuthorization();
app.MapControllers();

app.Run();
