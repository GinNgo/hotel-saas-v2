using HotelSaas.Application.Guests.Commands.UpdateGuestNotes;
using HotelSaas.Application.Guests.Queries.GetGuestDirectory;
using HotelSaas.Application.Guests.Queries.GetGuestHistory;
using HotelSaas.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace HotelSaas.WebApi.Tests.Security;

[Collection("RealDatabaseTests")]
public sealed class GuestCrmPostgresTests
{
    [Fact]
    public async Task PhoneLessGuest_QueriesTranslate_AndFlagsPersistWithoutCrossTenantChanges()
    {
        await CrossBranchSecurityE2ETests.RunInIsolatedEnvironmentAsync(async fixture =>
        {
            await using var db = CrossBranchSecurityE2ETests.CreateSeedDbContext(
                fixture.BaseConnectionString, fixture.TestSchema, fixture.TenantAId);
            var reservation = await db.Reservations.SingleAsync(r => r.Id == fixture.ResAId);
            reservation.GuestPhone = "";
            reservation.GuestEmail = "  CRM@EXAMPLE.TEST  ";
            await db.SaveChangesAsync();
            var tenant = new CurrentTenantService { TenantId = fixture.TenantAId };
            var directory = await new GetGuestDirectoryQueryHandler(db, tenant)
                .Handle(new GetGuestDirectoryQuery(), default);
            var guest = Assert.Single(directory.Items, g => g.GuestKey == "email:crm@example.test");
            Assert.Equal("", guest.PhoneNumber);
            Assert.True(await new UpdateGuestNotesCommandHandler(db, tenant).Handle(
                new UpdateGuestNotesCommand { GuestKey = guest.GuestKey, Notes = "CRM integration", IsVip = false, IsBlacklisted = true }, default));
            db.ChangeTracker.Clear();
            var detail = await new GetGuestHistoryQueryHandler(db, tenant).Handle(
                new GetGuestHistoryQuery { GuestKey = guest.GuestKey }, default);
            Assert.False(detail.Profile.IsVip);
            Assert.True(detail.Profile.IsBlacklisted);
            Assert.Equal("CRM integration", detail.Profile.Notes);
            await using var other = CrossBranchSecurityE2ETests.CreateSeedDbContext(
                fixture.BaseConnectionString, fixture.TestSchema, fixture.TenantBId);
            Assert.DoesNotContain(await other.Reservations.Select(r => r.Notes).ToListAsync(),
                notes => notes != null && notes.Contains("CRM integration"));
        });
    }
}
