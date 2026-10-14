using System.Reflection;
using FluentValidation;
using HotelSaas.Application.Common.Behaviors;
using MediatR;
using Microsoft.Extensions.DependencyInjection;

namespace HotelSaas.Application;

/// <summary>
/// Registers Application layer services into the dependency injection container.
/// </summary>
public static class DependencyInjection
{
    /// <summary>
    /// Adds MediatR handlers, FluentValidation validators, and pipeline behaviors.
    /// </summary>
    /// <param name="services">The service collection to configure.</param>
    /// <returns>The configured service collection for chaining.</returns>
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        var assembly = Assembly.GetExecutingAssembly();

        services.AddMediatR(cfg =>
            cfg.RegisterServicesFromAssembly(assembly));

        services.AddValidatorsFromAssembly(assembly);

        services.AddTransient(typeof(IPipelineBehavior<,>), typeof(ValidationBehavior<,>));

        services.AddScoped<Quotes.Services.IPricingCalculator, Quotes.Services.PricingCalculator>();
        services.AddScoped<Loyalty.Services.ILoyaltyTierRules, Loyalty.Services.LoyaltyTierRules>();
        services.AddScoped<Loyalty.Services.ILoyaltyLedgerService, Loyalty.Services.LoyaltyLedgerService>();

        return services;
    }
}
