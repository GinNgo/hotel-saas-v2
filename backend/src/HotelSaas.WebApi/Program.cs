using System.Diagnostics;
using System.Globalization;
using System.Text;
using System.Threading.RateLimiting;
using HotelSaas.Application;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Infrastructure;
using HotelSaas.Infrastructure.Persistence;
using HotelSaas.Infrastructure.Services;
using HotelSaas.WebApi.Authorization;
using HotelSaas.WebApi.Middleware;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Serilog;
using Serilog.Core;
using Serilog.Events;

var builder = WebApplication.CreateBuilder(args);

// ── Serilog ───────────────────────────────────────────────────────────
var initialLogLevel = Enum.TryParse<LogEventLevel>(
    builder.Configuration["Serilog:MinimumLevel:Default"],
    ignoreCase: true,
    out var configuredLevel)
    ? configuredLevel
    : LogEventLevel.Information;
var observabilityLevelSwitch = new LoggingLevelSwitch(initialLogLevel);

builder.Host.UseSerilog((ctx, cfg) =>
    cfg.ReadFrom.Configuration(ctx.Configuration)
        .MinimumLevel.ControlledBy(observabilityLevelSwitch));

// ── Application & Infrastructure DI ──────────────────────────────────
builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddHttpClient(HotelSaas.WebApi.Services.ObservabilityControlService.HttpClientName, client =>
{
    client.Timeout = TimeSpan.FromSeconds(4);
});
builder.Services.AddSingleton(observabilityLevelSwitch);
builder.Services.AddSingleton<IObservabilityControlService, HotelSaas.WebApi.Services.ObservabilityControlService>();
builder.Services.AddSingleton<ISystemMetricsRecorder, SystemMetricsRecorder>();

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
            RoleClaimType = "globalRole",
            ClockSkew = TimeSpan.FromSeconds(30)
        };

        // Extract JWT access token from query string for SignalR WebSocket connections
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var accessToken = context.Request.Query["access_token"];
                var path = context.HttpContext.Request.Path;
                if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs"))
                {
                    context.Token = accessToken;
                }
                return Task.CompletedTask;
            }
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
builder.Services.AddSwaggerGen(options =>
{
    options.CustomSchemaIds(type => type.FullName?.Replace("+", "."));
});

// ── Forwarded Headers (Reverse Proxy: Caddy / Nginx) ─────────────────
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.ForwardLimit = 1;
    options.KnownIPNetworks.Clear();
    options.KnownProxies.Clear();
});

// ── Rate Limiting (Per-Client-IP Fixed Window Policies) ──────────────
var isTestingEnvironment = builder.Environment.IsEnvironment("Testing");
var rateLimitWindow = TimeSpan.FromSeconds(
    Math.Max(1, builder.Configuration.GetValue<int?>("RateLimiting:WindowSeconds") ?? 60));
var authPermitLimit = Math.Max(
    1,
    builder.Configuration.GetValue<int?>("RateLimiting:AuthPermitLimit") ?? (isTestingEnvironment ? 10_000 : 30));
var webhookPermitLimit = Math.Max(
    1,
    builder.Configuration.GetValue<int?>("RateLimiting:WebhookPermitLimit") ?? (isTestingEnvironment ? 10_000 : 120));
var publicPrintPermitLimit = Math.Max(
    1,
    builder.Configuration.GetValue<int?>("RateLimiting:PublicPrintPermitLimit") ?? (isTestingEnvironment ? 10_000 : 60));
var publicApiPermitLimit = Math.Max(
    1,
    builder.Configuration.GetValue<int?>("RateLimiting:PublicApiPermitLimit") ?? (isTestingEnvironment ? 10_000 : 120));
var aiChatPermitLimit = Math.Max(
    1,
    builder.Configuration.GetValue<int?>("RateLimiting:AiChatPermitLimit") ?? (isTestingEnvironment ? 10_000 : 30));

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = async (context, cancellationToken) =>
    {
        context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
        context.HttpContext.Items["ErrorCode"] = "ERR_RATE_LIMITED";

        if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
        {
            context.HttpContext.Response.Headers.RetryAfter =
                Math.Ceiling(retryAfter.TotalSeconds).ToString(CultureInfo.InvariantCulture);
        }

        var policyName = context.HttpContext.GetEndpoint()?
            .Metadata.GetMetadata<EnableRateLimitingAttribute>()?.PolicyName
            ?? "default";
        var metricsRecorder = context.HttpContext.RequestServices.GetService<ISystemMetricsRecorder>();
        metricsRecorder?.RecordRateLimited(policyName);

        var correlationId = context.HttpContext.Items["CorrelationId"]?.ToString()
            ?? context.HttpContext.Items[CorrelationAndStructuredLogMiddleware.CorrelationIdHeaderName]?.ToString()
            ?? context.HttpContext.TraceIdentifier;

        context.HttpContext.Response.ContentType = "application/json";
        await context.HttpContext.Response.WriteAsJsonAsync(new
        {
            type = "TooManyRequests",
            title = "Too many requests. Please try again later.",
            status = StatusCodes.Status429TooManyRequests,
            errorCode = "ERR_RATE_LIMITED",
            correlationId = correlationId
        }, cancellationToken);
    };

    options.AddPolicy("auth", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: ResolveClientIpPartitionKey(httpContext),
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = authPermitLimit,
                Window = rateLimitWindow,
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 0,
                AutoReplenishment = true
            }));

    options.AddPolicy("webhooks", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: ResolveClientIpPartitionKey(httpContext),
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = webhookPermitLimit,
                Window = rateLimitWindow,
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 0,
                AutoReplenishment = true
            }));

    options.AddPolicy("public-print", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: ResolveClientIpPartitionKey(httpContext),
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = publicPrintPermitLimit,
                Window = rateLimitWindow,
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 0,
                AutoReplenishment = true
            }));

    options.AddPolicy("public-api", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: ResolveClientIpPartitionKey(httpContext),
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = publicApiPermitLimit,
                Window = rateLimitWindow,
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 0,
                AutoReplenishment = true
            }));

    options.AddPolicy("ai-chat", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: ResolveClientIpPartitionKey(httpContext),
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = aiChatPermitLimit,
                Window = rateLimitWindow,
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 0,
                AutoReplenishment = true
            }));
});

// ── CORS ─────────────────────────────────────────────────────────────
var allowedOrigins = ResolveAllowedCorsOrigins(builder.Configuration, builder.Environment);

builder.Services.AddCors(options =>
    options.AddPolicy("Angular", policy =>
        policy
            .WithOrigins(allowedOrigins)
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials()));

var app = builder.Build();

if (!app.Environment.IsDevelopment() && !app.Environment.IsEnvironment("Testing"))
{
    ValidateProductionJwtSecret(jwtSettings["SecretKey"]);
}

// ── Database Migration & Seeding Guard (Task C01) ──────────────────────
var effectiveConnStr = DatabaseConnectionResolver.ResolveConnectionString(builder.Configuration);
var isCloudDb = CloudDatabaseGuard.IsCloudDatabase(effectiveConnStr);

var isTestingEnv = app.Environment.IsEnvironment("Testing");
var isStagingEnv = app.Environment.IsEnvironment("Staging");
var explicitSkip = builder.Configuration.GetValue<bool>("SkipStartupDatabaseInit");
var allowCloudInit = builder.Configuration.GetValue<bool>("AllowCloudStartupDatabaseInit") || isStagingEnv;

var shouldSkipStartupInit = isTestingEnv || explicitSkip || (isCloudDb && !allowCloudInit);

if (!shouldSkipStartupInit)
{
    CloudDatabaseGuard.ValidateStartupExecution(effectiveConnStr, builder.Configuration, isStagingEnv);

    using (var scope = app.Services.CreateScope())
    {
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        await context.Database.MigrateAsync();

        var allowCloudDevSeed = builder.Configuration.GetValue<bool>("AllowCloudDevSeed");
        var shouldRunDevSeeder = ShouldRunDevSeeder(
            app.Environment,
            builder.Configuration,
            isCloudDb,
            effectiveConnStr);

        await SeedData.SeedDefaultRolesAndPermissions(
            context,
            allowDevPlatformBootstrap: shouldRunDevSeeder,
            configuration: app.Configuration);

        if (shouldRunDevSeeder)
        {
            try
            {
                var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher>();
                var currentTenant = scope.ServiceProvider.GetRequiredService<ICurrentTenantService>();
                var currentProperty = scope.ServiceProvider.GetRequiredService<ICurrentPropertyService>();
                await LocalDevDataSeeder.SeedAsync(effectiveConnStr, new LocalDevSeedOptions(), hasher);
                Log.Information("LocalDevDataSeeder executed successfully.");
                await SeedData.SeedPlatformAdminDataAsync(context);
                await RealData34ProvincesSeeder.SeedAsync(context, currentTenant, currentProperty);
                Log.Information("RealData34ProvincesSeeder executed successfully.");
            }
            catch (Exception ex)
            {
                Log.Warning(ex, "LocalDevDataSeeder note: {Message}", ex.Message);
            }
        }
        else if (isCloudDb && !allowCloudDevSeed)
        {
            Log.Information("CloudDatabaseGuard (Task C01): Bỏ qua LocalDevDataSeeder trên Cloud Database để bảo toàn dữ liệu dùng chung của nhóm.");
        }
        else if (isStagingEnv)
        {
            Log.Information("Staging dev seeder skipped (explicit opt-in required via AllowStagingDevSeed=true).");
        }
    }
}
else if (isCloudDb && !allowCloudInit && !isTestingEnv)
{
    Log.Information("CloudDatabaseGuard (Task C01): Tự động bật SkipStartupDatabaseInit trên Cloud DB để bảo vệ cơ sở dữ liệu chung. Cấu hình AllowCloudStartupDatabaseInit=true nếu cần chạy migration có chủ đích.");
}

// ── Middleware Pipeline ──────────────────────────────────────────────
app.UseForwardedHeaders();
app.UseMiddleware<CorrelationAndStructuredLogMiddleware>();
app.UseSerilogRequestLogging(opts =>
{
    opts.GetLevel = ResolveSerilogRequestLevel;
    opts.EnrichDiagnosticContext = EnrichSerilogDiagnosticContext;
});
app.UseMiddleware<ExceptionHandlingMiddleware>();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}
else if (!isTestingEnv)
{
    app.UseHsts();
}

app.UseRouting();
app.UseCors("Angular");
app.UseRateLimiter();
app.UseAuthentication();
app.UseMiddleware<TenantPropertyContextMiddleware>();
app.UseAuthorization();
app.MapControllers();
app.MapGet("/health", () => Results.Ok(new { status = "healthy", timestamp = DateTime.UtcNow }));
app.MapGet("/health/live", () => Results.Ok(new { status = "alive", service = "HotelSaas.WebApi", timestamp = DateTime.UtcNow }));
app.MapGet("/health/ready", async (ApplicationDbContext db, CancellationToken ct) =>
{
    var canConnect = await db.Database.CanConnectAsync(ct);
    return canConnect
        ? Results.Ok(new { status = "ready", database = "connected", timestamp = DateTime.UtcNow })
        : Results.Json(new { status = "degraded", database = "unreachable", timestamp = DateTime.UtcNow }, statusCode: StatusCodes.Status503ServiceUnavailable);
});
app.MapGet("/metrics", (HttpContext httpContext, IConfiguration configuration, IObservabilityControlService observabilityControl) =>
{
    if (!TenantPropertyContextMiddleware.IsAuthorizedMetricsRequest(
            httpContext, configuration, out var isAuthenticatedNonSuperAdmin))
    {
        return isAuthenticatedNonSuperAdmin
            ? Results.StatusCode(StatusCodes.Status403Forbidden)
            : Results.Unauthorized();
    }

    if (!observabilityControl.IsMetricsExportEnabled)
    {
        return Results.Json(
            new
            {
                errorCode = "ERR_METRICS_DISABLED",
                message = "Xuất metrics Prometheus đang bị tắt bởi SuperAdmin."
            },
            statusCode: StatusCodes.Status503ServiceUnavailable);
    }

    return Results.Text(SystemMetricsRegistry.ExportPrometheusText(), "text/plain; version=0.0.4; charset=utf-8");
});
app.MapHub<HotelSaas.Infrastructure.Hubs.NotificationHub>("/hubs/notifications").RequireAuthorization();

app.Run();

public partial class Program
{
    private static readonly string[] KnownDevJwtSampleKeys =
    [
        "DevOnly_SuperSecretKey_ChangeInProduction_AtLeast32Chars!",
        "HotelSaasPlatform2026EnterpriseSuperSecretKey32BytesLong!",
        "YourSuperSecretKeyMustBeAtLeast32CharactersLongForJwt!"
    ];

    /// <summary>
    /// Resolves allowed CORS origins strictly from <c>Cors:AllowedOrigins</c> in non-Development/non-Testing
    /// environments, restricting hardcoded localhost origins to Development and Testing only.
    /// </summary>
    public static string[] ResolveAllowedCorsOrigins(IConfiguration configuration, IHostEnvironment environment)
    {
        var configuredOrigins = configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
            ?? Array.Empty<string>();

        IEnumerable<string> origins = configuredOrigins;
        if (environment.IsDevelopment() || environment.IsEnvironment("Testing"))
        {
            origins = new[]
            {
                "http://localhost:4200",
                "http://localhost:3000"
            }.Concat(origins);
        }

        return origins
            .Where(o => !string.IsNullOrWhiteSpace(o))
            .Select(o => o.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();
    }

    /// <summary>
    /// Determines whether local/sample dev seeders may run on startup.
    /// Never auto-enables on Staging or Production; requires Development or explicit Staging opt-in
    /// (<c>AllowStagingDevSeed=true</c>, plus <c>AllowCloudDevSeed=true</c> when connected to a Cloud DB).
    /// </summary>
    public static bool ShouldRunDevSeeder(
        IHostEnvironment environment,
        IConfiguration configuration,
        bool isCloudDb,
        string? effectiveConnStr)
    {
        if (string.IsNullOrWhiteSpace(effectiveConnStr))
        {
            return false;
        }

        var allowCloudDevSeed = configuration.GetValue<bool>("AllowCloudDevSeed");
        var allowStagingDevSeed = configuration.GetValue<bool>("AllowStagingDevSeed");

        var canRunAgainstTargetDb = !isCloudDb || allowCloudDevSeed;
        var isDevOrExplicitOptIn = environment.IsDevelopment() ||
                                   (environment.IsEnvironment("Staging") && allowStagingDevSeed);

        return isDevOrExplicitOptIn && canRunAgainstTargetDb;
    }

    /// <summary>
    /// Extracts the normalized client IP partition key for rate limiting after ForwardedHeaders processing.
    /// </summary>
    public static string ResolveClientIpPartitionKey(HttpContext httpContext)
    {
        var remoteIp = httpContext.Connection.RemoteIpAddress;
        if (remoteIp is null)
        {
            return "unknown";
        }

        return (remoteIp.IsIPv4MappedToIPv6 ? remoteIp.MapToIPv4() : remoteIp).ToString();
    }

    /// <summary>
    /// Validates that non-Development/non-Testing environments (Staging, Production) never boot
    /// with a missing, short, or sample JWT signing key.
    /// </summary>
    public static void ValidateProductionJwtSecret(string? secretKey)
    {
        var validated = JwtKeyValidator.ValidateSecretKey(secretKey);
        if (validated.Length < JwtKeyValidator.MinimumKeyLengthBytes)
        {
            throw new InvalidOperationException(
                $"JwtSettings:SecretKey must be at least {JwtKeyValidator.MinimumKeyLengthBytes} characters in Production/Staging.");
        }

        if (KnownDevJwtSampleKeys.Contains(validated, StringComparer.Ordinal) ||
            validated.Contains("DevOnly", StringComparison.OrdinalIgnoreCase) ||
            validated.Contains("ChangeInProduction", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException(
                "JwtSettings:SecretKey cannot use a known development/sample placeholder key in Production/Staging.");
        }
    }

    public static LogEventLevel ResolveSerilogRequestLevel(
        HttpContext httpContext,
        double elapsedMs,
        Exception? ex)
    {
        if (ex != null || httpContext.Response.StatusCode >= StatusCodes.Status500InternalServerError)
        {
            return LogEventLevel.Error;
        }

        if (CorrelationAndStructuredLogMiddleware.IsObservabilityProbePath(httpContext.Request.Path.Value) &&
            httpContext.Response.StatusCode < StatusCodes.Status400BadRequest)
        {
            return LogEventLevel.Verbose;
        }

        return LogEventLevel.Information;
    }

    public static void EnrichSerilogDiagnosticContext(IDiagnosticContext diagnosticContext, HttpContext httpContext)
    {
        var correlationId = httpContext.Items.TryGetValue("CorrelationId", out var directCorrId) &&
                            directCorrId is string directCorrIdStr &&
                            !string.IsNullOrWhiteSpace(directCorrIdStr)
            ? directCorrIdStr
            : httpContext.Items.TryGetValue(CorrelationAndStructuredLogMiddleware.CorrelationIdHeaderName, out var itemCorrId) &&
              itemCorrId is string itemCorrIdStr &&
              !string.IsNullOrWhiteSpace(itemCorrIdStr)
                ? itemCorrIdStr
                : httpContext.Response.Headers.TryGetValue(CorrelationAndStructuredLogMiddleware.CorrelationIdHeaderName, out var headerCorrId)
                    ? headerCorrId.ToString()
                    : null;

        if (!string.IsNullOrWhiteSpace(correlationId))
        {
            diagnosticContext.Set("CorrelationId", correlationId);
        }

        diagnosticContext.Set("ClientIp", httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown");
        diagnosticContext.Set("RequestMethod", httpContext.Request.Method);
        diagnosticContext.Set("RequestPath", httpContext.Request.Path.Value ?? "/");

        var elapsedMs = httpContext.Items.TryGetValue(CorrelationAndStructuredLogMiddleware.RequestStartTimestampItemKey, out var startObj) &&
                        startObj is long startTimestamp
            ? Math.Round(Stopwatch.GetElapsedTime(startTimestamp).TotalMilliseconds, 2)
            : 0d;
        diagnosticContext.Set("ElapsedMs", elapsedMs);

        var tenantService = httpContext.RequestServices.GetService<ICurrentTenantService>();
        var propertyService = httpContext.RequestServices.GetService<ICurrentPropertyService>();
        var userContext = httpContext.RequestServices.GetService<ICurrentUserContext>();

        var tenantId = tenantService?.TenantId;
        var propertyId = propertyService?.PropertyId;
        var isTenantWide = propertyService?.IsTenantWide ?? false;
        var userId = userContext is { IsAuthenticated: true } && userContext.UserId != Guid.Empty
            ? userContext.UserId.ToString()
            : "anonymous";

        diagnosticContext.Set("TenantId", tenantId?.ToString() ?? "anonymous");
        diagnosticContext.Set("PropertyId", propertyId?.ToString() ?? (isTenantWide ? "tenant-wide" : "unscoped"));
        diagnosticContext.Set("UserId", userId);
        diagnosticContext.Set("StatusCode", httpContext.Response.StatusCode);

        if (httpContext.Items.TryGetValue("ErrorCode", out var errorCodeObj) &&
            errorCodeObj?.ToString() is { Length: > 0 } errorCode)
        {
            diagnosticContext.Set("ErrorCode", errorCode);
        }

        if (httpContext.Items.TryGetValue(CorrelationAndStructuredLogMiddleware.RequestPayloadItemKey, out var reqPayloadObj) &&
            reqPayloadObj is string reqPayload &&
            !string.IsNullOrWhiteSpace(reqPayload))
        {
            diagnosticContext.Set("RequestPayload", reqPayload);
        }

        if (httpContext.Items.TryGetValue(CorrelationAndStructuredLogMiddleware.ResponsePayloadItemKey, out var resPayloadObj) &&
            resPayloadObj is string resPayload &&
            !string.IsNullOrWhiteSpace(resPayload))
        {
            diagnosticContext.Set("ResponsePayload", resPayload);
        }
    }
}
