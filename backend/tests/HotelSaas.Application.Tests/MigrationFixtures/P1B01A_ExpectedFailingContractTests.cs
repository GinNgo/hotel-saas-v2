using System;
using HotelSaas.Domain.Entities;
using Xunit;

namespace HotelSaas.Application.Tests.MigrationFixtures;

/// <summary>
/// Contract regression tests for domain entities.
/// In Phase P1B-01A, these tests served as TDD Red-Light contract guards.
/// In Phase P1B-01B, both tests have turned GREEN confirming Property and Room.PropertyId are implemented.
/// </summary>
public sealed class P1B01A_ExpectedFailingContractTests
{
    [Fact]
    public void ExpectedFailing_Domain_Property_Entity_Is_Not_Yet_Created_In_P1B01A()
    {
        // Act: Attempt to resolve Property entity in Domain assembly
        var domainAssembly = typeof(Tenant).Assembly;
        var propertyType = domainAssembly.GetType("HotelSaas.Domain.Entities.Property");

        // Assert: GREEN in P1B-01B (Property entity exists and is verified)
        Assert.True(propertyType != null, 
            "Domain entity 'Property' must be implemented in HotelSaas.Domain.Entities.");
    }

    [Fact]
    public void ExpectedFailing_Room_Entity_Has_Not_Added_PropertyId_In_P1B01A()
    {
        // Act: Attempt to find PropertyId on Room entity
        var roomType = typeof(Room);
        var propertyIdProp = roomType.GetProperty("PropertyId");

        // Assert: GREEN in P1B-01B (Room has PropertyId property)
        Assert.True(propertyIdProp != null,
            "Entity 'Room' must have 'PropertyId' property.");
    }
}
