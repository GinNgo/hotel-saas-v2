using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Infrastructure.Persistence;
using HotelSaas.Infrastructure.Persistence.Interceptors;
using HotelSaas.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace HotelSaas.Infrastructure;

/// <summary>
/// Registers Infrastructure layer services into the dependency injection container.
/// </summary>
public static class DependencyInjection
{
    /// <summary>
    /// Adds Infrastructure layer services including EF Core with Npgsql and tenant services.
    /// </summary>
    /// <param name="services">The service collection to configure.</param>
    /// <param name="configuration">Application configuration for connection strings.</param>
    /// <returns>The configured service collection for chaining.</returns>
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddScoped<TenantPropertySaveChangesInterceptor>();

        var connectionString = DatabaseConnectionResolver.ResolveConnectionString(configuration);
        CloudDatabaseGuard.ValidateCloudConnectionSafety(connectionString, configuration);

        services.AddDbContext<ApplicationDbContext>((sp, options) =>
        {
            options.UseNpgsql(
                connectionString,
                npgsqlOptions => npgsqlOptions.MigrationsAssembly(
                    typeof(ApplicationDbContext).Assembly.FullName));
            options.ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.PendingModelChangesWarning));
            options.AddInterceptors(sp.GetRequiredService<TenantPropertySaveChangesInterceptor>());
        });

        services.AddScoped<IApplicationDbContext>(sp =>
            sp.GetRequiredService<ApplicationDbContext>());

        services.AddScoped<ICurrentTenantService, CurrentTenantService>();
        services.AddScoped<ICurrentPropertyService, CurrentPropertyService>();
        services.AddScoped<ICurrentUserContext, CurrentUserContext>();
        services.AddScoped<IMembershipLookupService, MembershipLookupService>();
        services.AddScoped<IPasswordHasher, PasswordHasherService>();
        services.AddScoped<IJwtService, JwtService>();
        services.AddSingleton<ILocationLookupService, LocationLookupService>();
        services.AddScoped<IVnpayPaymentService, VnpayPaymentService>();

        return services;
    }
}
