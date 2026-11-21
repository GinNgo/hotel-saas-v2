using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Expressions;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Common.Models;
using HotelSaas.Application.Payments.Commands.ProcessSepayWebhook;
using HotelSaas.Application.Reservations.DTOs;
using HotelSaas.Application.Subscriptions.Queries.GetSubscriptionVietQr;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using HotelSaas.Infrastructure.Services;
using HotelSaas.WebApi.Controllers;
using MediatR;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Query;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Xunit;

namespace HotelSaas.Application.Tests.Payments;

/// <summary>
/// Unit and handler tests covering SePay VietQR webhooks, constant-time Apikey authentication,
/// idempotency, partial vs full settlement, expired/cancelled hold protection, subscription upgrades,
/// Subscription VietQR generation, and clean VietQrService transfer memo formatting.
/// </summary>
public sealed class SepayWebhookTests
{
    private const string TestSepayApiKey = "test-only-sepay-webhook-key-987654";

    [Fact]
    public async Task WebhooksController_MissingOrInvalidApiKey_Returns401Unauthorized()
    {
        var sender = new DelegateSender((_, _) => Task.FromResult<object?>(new ProcessSepayWebhookResult("confirmed", "ok")));
        var configWithKey = BuildConfig(new Dictionary<string, string?>
        {
            ["Payment:Sepay:ApiKey"] = TestSepayApiKey
        });
        var prodEnv = new StubHostEnvironment(Environments.Production);

        // 1. Missing Authorization header -> 401
        var missingHeaderController = CreateWebhooksController(sender, configWithKey, prodEnv, authorizationHeader: null);
        var resMissing = await missingHeaderController.HandleSepayWebhook(CreateSamplePayload(1001), CancellationToken.None);
        var unauthMissing = Assert.IsType<UnauthorizedObjectResult>(resMissing);
        var errMissing = Assert.IsType<SepayWebhookErrorResponse>(unauthMissing.Value);
        Assert.False(errMissing.Success);
        Assert.Equal("Unauthorized", errMissing.Message);

        // 2. Wrong Apikey value -> 401
        var wrongKeyController = CreateWebhooksController(sender, configWithKey, prodEnv, authorizationHeader: "Apikey wrong-key-value");
        var resWrong = await wrongKeyController.HandleSepayWebhook(CreateSamplePayload(1002), CancellationToken.None);
        Assert.IsType<UnauthorizedObjectResult>(resWrong);

        // 3. Wrong scheme (Bearer instead of Apikey) -> 401
        var wrongSchemeController = CreateWebhooksController(sender, configWithKey, prodEnv, authorizationHeader: $"Bearer {TestSepayApiKey}");
        var resScheme = await wrongSchemeController.HandleSepayWebhook(CreateSamplePayload(1003), CancellationToken.None);
        Assert.IsType<UnauthorizedObjectResult>(resScheme);

        // 4. Empty/unconfigured server Apikey (Fail-Closed) -> 401 even if caller supplies a key
        var emptyConfig = BuildConfig(new Dictionary<string, string?>
        {
            ["Payment:Sepay:ApiKey"] = ""
        });
        var unconfiguredController = CreateWebhooksController(sender, emptyConfig, prodEnv, authorizationHeader: "Apikey anything");
        var resUnconfigured = await unconfiguredController.HandleSepayWebhook(CreateSamplePayload(1004), CancellationToken.None);
        Assert.IsType<UnauthorizedObjectResult>(resUnconfigured);

        Assert.Empty(sender.SentRequests);
    }

    [Fact]
    public async Task WebhooksController_ValidApiKey_TransferOut_Returns200Ignored()
    {
        var db = new SepayFakeDbContext();
        var handler = new ProcessSepayWebhookCommandHandler(db, new CurrentTenantService(), new CurrentPropertyService());
        var sender = new DelegateSender((req, ct) => req switch
        {
            ProcessSepayWebhookCommand cmd => WrapResult(handler.Handle(cmd, ct)),
            _ => throw new NotSupportedException()
        });

        var config = BuildConfig(new Dictionary<string, string?>
        {
            ["Payment:Sepay:ApiKey"] = TestSepayApiKey
        });
        var controller = CreateWebhooksController(
            sender,
            config,
            new StubHostEnvironment(Environments.Production),
            authorizationHeader: $"Apikey {TestSepayApiKey}");

        var payload = CreateSamplePayload(2001);
        payload.TransferType = "out";
        payload.Content = "DATPHONG RESABC123";

        var actionResult = await controller.HandleSepayWebhook(payload, CancellationToken.None);
        var ok = Assert.IsType<OkObjectResult>(actionResult);
        var body = Assert.IsType<SepayWebhookHttpResponse>(ok.Value);

        Assert.True(body.Success);
        Assert.Equal("ignored", body.Status);
        Assert.Empty(db.PaymentList);
    }

    [Fact]
    public async Task WebhooksController_SimulateEndpoint_Returns404InProduction_AndConfirmsInDevelopment()
    {
        var db = new SepayFakeDbContext();
        var (tenant, property, reservation) = SeedReservationWithBank(db, "RES-SIM123", totalAmount: 1_000_000m, depositRequired: 300_000m, bankAccount: "0987654321");
        var tenantSvc = new CurrentTenantService();
        var propSvc = new CurrentPropertyService();
        var dispatcher = new SpyNotificationDispatcher();
        var processHandler = new ProcessSepayWebhookCommandHandler(db, tenantSvc, propSvc, dispatcher);

        DelegateSender? sender = null;
        sender = new DelegateSender((req, ct) => req switch
        {
            ProcessSepayWebhookCommand cmd => WrapResult(processHandler.Handle(cmd, ct)),
            SimulateSepayWebhookCommand sim => WrapResult(new SimulateSepayWebhookCommandHandler(db, sender!).Handle(sim, ct)),
            _ => throw new NotSupportedException()
        });

        var emptyConfig = BuildConfig(new Dictionary<string, string?>());

        // 1. Non-Development -> strictly 404 Not Found
        var prodController = CreateWebhooksController(sender, emptyConfig, new StubHostEnvironment(Environments.Production), null);
        var prodResult = await prodController.SimulateSepayWebhook(
            new SimulateSepayWebhookRequest { ConfirmationCode = "RES-SIM123", Amount = 300_000m },
            CancellationToken.None);
        Assert.IsType<NotFoundObjectResult>(prodResult);
        Assert.Equal(ReservationStatus.PendingPayment, reservation.Status);

        // 2. Development -> 200 OK, confirms reservation using PrintTemplateConfig bank account
        var devController = CreateWebhooksController(sender, emptyConfig, new StubHostEnvironment(Environments.Development), null);
        var devResult = await devController.SimulateSepayWebhook(
            new SimulateSepayWebhookRequest { ConfirmationCode = "RES-SIM123", Amount = 300_000m },
            CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(devResult);
        var body = Assert.IsType<SepayWebhookHttpResponse>(ok.Value);
        Assert.True(body.Success);
        Assert.Equal("confirmed", body.Status);
        Assert.Equal(ReservationStatus.Confirmed, reservation.Status);
        Assert.NotNull(reservation.SmartLockPin);
        Assert.Equal(6, reservation.SmartLockPin!.Length);
        Assert.Equal(tenant.Id, tenantSvc.TenantId);
        Assert.Equal(property.Id, propSvc.PropertyId);
        Assert.Single(dispatcher.ConfirmedReservations);
    }

    [Fact]
    public async Task ProcessSepayWebhook_DepositPayment_ConfirmsGenerates6DigitPinDispatchesSignalR_AndDeduplicates()
    {
        var db = new SepayFakeDbContext();
        var (_, property, reservation) = SeedReservationWithBank(
            db,
            confirmationCode: "RES-ABC123",
            totalAmount: 2_000_000m,
            depositRequired: 600_000m,
            bankAccount: "0987 654 321");

        var tenantSvc = new CurrentTenantService();
        var propSvc = new CurrentPropertyService();
        var dispatcher = new SpyNotificationDispatcher();
        var handler = new ProcessSepayWebhookCommandHandler(db, tenantSvc, propSvc, dispatcher);

        var cmd = new ProcessSepayWebhookCommand(
            Id: 55001,
            Gateway: "MBBank",
            TransactionDate: "2026-11-21 10:15:00",
            AccountNumber: "0987654321",
            SubAccount: null,
            Code: "RESABC123",
            Content: "DATPHONG RESABC123",
            TransferType: "in",
            Description: "MBVCB.123.DATPHONG RESABC123",
            TransferAmount: 600_000m,
            Accumulated: 10_600_000m,
            ReferenceCode: "FT2611210001");

        // Act 1: First webhook settles deposit & confirms reservation
        var firstResult = await handler.Handle(cmd, CancellationToken.None);

        Assert.Equal("confirmed", firstResult.Status);
        Assert.Equal(reservation.Id, firstResult.ReservationId);
        Assert.Equal(ReservationStatus.Confirmed, reservation.Status);
        Assert.NotNull(reservation.SmartLockPin);
        Assert.Equal(6, reservation.SmartLockPin!.Length);
        Assert.True(reservation.SmartLockPin.All(char.IsDigit));
        Assert.Equal("Active", reservation.SmartLockStatus);
        Assert.NotNull(reservation.SmartLockActivatedAtUtc);

        var payment = Assert.Single(db.PaymentList);
        Assert.Equal(PaymentMethod.BankTransfer, payment.Method);
        Assert.Equal(PaymentStatus.Completed, payment.Status);
        Assert.Equal(600_000m, payment.Amount);
        Assert.StartsWith("SEPAY-55001|FT2611210001", payment.TransactionRef);
        Assert.Contains("SEPAY-55001", db.LockedIdempotencyKeys);
        Assert.Contains(reservation.Id, db.LockedReservationIds);
        Assert.Contains(reservation.RoomId, db.LockedRoomIds);

        Assert.Single(dispatcher.ConfirmedReservations);
        Assert.Equal(property.Id.ToString(), dispatcher.ConfirmedReservations[0].PropertyId);
        Assert.Single(dispatcher.ConfirmedPayments);
        Assert.Equal("SepayVietQR", dispatcher.ConfirmedPayments[0].PaymentMethod);

        // Act 2: Duplicate webhook with same SePay Id -> idempotent duplicate
        var duplicateResult = await handler.Handle(cmd, CancellationToken.None);

        Assert.Equal("duplicate", duplicateResult.Status);
        Assert.Single(db.PaymentList);
        Assert.Single(dispatcher.ConfirmedReservations);
        Assert.Single(dispatcher.ConfirmedPayments);
    }

    [Fact]
    public async Task ProcessSepayWebhook_PartialPayment_DoesNotConfirm_UntilCumulativeReachesRequiredAmount()
    {
        var db = new SepayFakeDbContext();
        var (_, _, reservation) = SeedReservationWithBank(
            db,
            confirmationCode: "RES-PRT777",
            totalAmount: 1_500_000m,
            depositRequired: 500_000m,
            bankAccount: "0111222333");

        var dispatcher = new SpyNotificationDispatcher();
        var handler = new ProcessSepayWebhookCommandHandler(db, new CurrentTenantService(), new CurrentPropertyService(), dispatcher);

        // 1. Partial transfer 200,000 VND (< 500,000 required deposit)
        var partialCmd = new ProcessSepayWebhookCommand(
            Id: 66001,
            Gateway: "Vietcombank",
            TransactionDate: "2026-11-21 11:00:00",
            AccountNumber: "0111222333",
            SubAccount: null,
            Code: null,
            Content: "DATPHONG RESPRT777",
            TransferType: "in",
            Description: null,
            TransferAmount: 200_000m,
            Accumulated: null,
            ReferenceCode: "FT-PART-1");

        var partialResult = await handler.Handle(partialCmd, CancellationToken.None);

        Assert.Equal("partial", partialResult.Status);
        Assert.Equal(ReservationStatus.PendingPayment, reservation.Status);
        Assert.Null(reservation.SmartLockPin);
        Assert.Single(db.PaymentList);
        Assert.Empty(dispatcher.ConfirmedReservations);
        Assert.Empty(dispatcher.ConfirmedPayments);

        // 2. Second transfer 300,000 VND -> cumulative 500,000 VND confirms booking
        var completionCmd = partialCmd with
        {
            Id = 66002,
            TransferAmount = 300_000m,
            ReferenceCode = "FT-PART-2"
        };

        var confirmedResult = await handler.Handle(completionCmd, CancellationToken.None);

        Assert.Equal("confirmed", confirmedResult.Status);
        Assert.Equal(ReservationStatus.Confirmed, reservation.Status);
        Assert.NotNull(reservation.SmartLockPin);
        Assert.Equal(6, reservation.SmartLockPin!.Length);
        Assert.Equal(2, db.PaymentList.Count);
        Assert.Single(dispatcher.ConfirmedReservations);
        Assert.Single(dispatcher.ConfirmedPayments);
    }

    [Fact]
    public async Task ProcessSepayWebhook_ExpiredOnlineHold_AndCancelledReservation_AreNeverRevived()
    {
        var db = new SepayFakeDbContext();
        var (_, _, expiredHold) = SeedReservationWithBank(
            db,
            confirmationCode: "RES-EXP111",
            totalAmount: 1_200_000m,
            depositRequired: 400_000m,
            bankAccount: "0998877665",
            holdExpiresAtUtc: DateTime.UtcNow.AddMinutes(-5));

        var (_, _, cancelledRes) = SeedReservationWithBank(
            db,
            confirmationCode: "RES-CNC222",
            totalAmount: 1_200_000m,
            depositRequired: 400_000m,
            bankAccount: "0998877665",
            status: ReservationStatus.Cancelled);

        var dispatcher = new SpyNotificationDispatcher();
        var handler = new ProcessSepayWebhookCommandHandler(db, new CurrentTenantService(), new CurrentPropertyService(), dispatcher);

        // 1. Expired hold transfer -> alert only, DO NOT revive
        var expiredResult = await handler.Handle(new ProcessSepayWebhookCommand(
            Id: 77001,
            Gateway: "MBBank",
            TransactionDate: "2026-11-21 12:00:00",
            AccountNumber: "0998877665",
            SubAccount: null,
            Code: "RESEXP111",
            Content: "DATPHONG RESEXP111",
            TransferType: "in",
            Description: null,
            TransferAmount: 400_000m,
            Accumulated: null,
            ReferenceCode: "FT-LATE-1"), CancellationToken.None);

        Assert.Equal("expired_hold_alert", expiredResult.Status);
        Assert.Equal(ReservationStatus.PendingPayment, expiredHold.Status);
        Assert.Null(expiredHold.SmartLockPin);

        // 2. Cancelled reservation transfer -> alert only, DO NOT revive
        var cancelledResult = await handler.Handle(new ProcessSepayWebhookCommand(
            Id: 77002,
            Gateway: "MBBank",
            TransactionDate: "2026-11-21 12:05:00",
            AccountNumber: "0998877665",
            SubAccount: null,
            Code: "RESCNC222",
            Content: "DATPHONG RESCNC222",
            TransferType: "in",
            Description: null,
            TransferAmount: 1_200_000m,
            Accumulated: null,
            ReferenceCode: "FT-LATE-2"), CancellationToken.None);

        Assert.Equal("expired_hold_alert", cancelledResult.Status);
        Assert.Equal(ReservationStatus.Cancelled, cancelledRes.Status);
        Assert.Null(cancelledRes.SmartLockPin);

        Assert.Empty(db.PaymentList);
        Assert.Empty(dispatcher.ConfirmedReservations);
        Assert.Equal(2, db.AuditLogList.Count(a => a.EntityName == "SepayExpiredHoldAlert"));
    }

    [Fact]
    public async Task ProcessSepayWebhook_BankAccountMismatch_ReturnsIgnored()
    {
        var db = new SepayFakeDbContext();
        var (_, _, reservation) = SeedReservationWithBank(
            db,
            confirmationCode: "RES-ACC999",
            totalAmount: 900_000m,
            depositRequired: 900_000m,
            bankAccount: "0987654321");

        var handler = new ProcessSepayWebhookCommandHandler(db, new CurrentTenantService(), new CurrentPropertyService());

        var result = await handler.Handle(new ProcessSepayWebhookCommand(
            Id: 78001,
            Gateway: "MBBank",
            TransactionDate: "2026-11-21 12:15:00",
            AccountNumber: "0000111122",
            SubAccount: null,
            Code: "RESACC999",
            Content: "DATPHONG RESACC999",
            TransferType: "in",
            Description: null,
            TransferAmount: 900_000m,
            Accumulated: null,
            ReferenceCode: "FT-WRONG-ACC"), CancellationToken.None);

        Assert.Equal("ignored", result.Status);
        Assert.Equal(ReservationStatus.PendingPayment, reservation.Status);
        Assert.Empty(db.PaymentList);
    }

    [Fact]
    public async Task ProcessSepayWebhook_SubscriptionUpgrade_ActivatesTenantSubscription_AndDeduplicates()
    {
        var db = new SepayFakeDbContext();
        var tenant = new Tenant
        {
            Id = Guid.NewGuid(),
            Code = "T-SUB",
            Name = "Saigon Boutique Hotel",
            Slug = "saigon-boutique",
            SubscriptionTier = SubscriptionTier.Basic
        };
        db.TenantList.Add(tenant);

        var subscription = new Subscription
        {
            Id = Guid.NewGuid(),
            TenantId = tenant.Id,
            Tier = SubscriptionTier.Basic,
            BillingCycle = BillingCycle.Monthly,
            Status = SubscriptionStatus.Active,
            PricePerCycle = 299_000m,
            Currency = "VND",
            CurrentPeriodStartUtc = DateTime.UtcNow.AddDays(-10),
            CurrentPeriodEndUtc = DateTime.UtcNow.AddDays(20)
        };
        db.SubscriptionList.Add(subscription);

        var subPayment = new SubscriptionPayment
        {
            Id = Guid.NewGuid(),
            TenantId = tenant.Id,
            SubscriptionId = subscription.Id,
            Amount = 699_000m,
            Method = PaymentMethod.VNPay,
            Status = PaymentStatus.Pending,
            TransactionRef = "SUB_2_1_A1B2C3D4E5",
            InvoiceNumber = "INV-SUB-20261121-2-1-A1B2C3",
            CreatedAtUtc = DateTime.UtcNow
        };
        db.SubscriptionPaymentList.Add(subPayment);

        var handler = new ProcessSepayWebhookCommandHandler(db, new CurrentTenantService(), new CurrentPropertyService());

        var cmd = new ProcessSepayWebhookCommand(
            Id: 88001,
            Gateway: "MBBank",
            TransactionDate: "2026-11-21 13:00:00",
            AccountNumber: "0999888777",
            SubAccount: null,
            Code: null,
            Content: "NANGCAP SUB21A1B2C3D4E5",
            TransferType: "in",
            Description: "Upgrade to Pro",
            TransferAmount: 699_000m,
            Accumulated: null,
            ReferenceCode: "FT-SUB-01",
            ExpectedPlatformAccountNumber: "0999888777");

        // Act 1: Confirm & activate subscription upgrade
        var result = await handler.Handle(cmd, CancellationToken.None);

        Assert.Equal("confirmed", result.Status);
        Assert.Equal(subPayment.Id, result.SubscriptionPaymentId);
        Assert.Equal(PaymentStatus.Completed, subPayment.Status);
        Assert.Equal(PaymentMethod.BankTransfer, subPayment.Method);
        Assert.NotNull(subPayment.PaidAtUtc);
        Assert.Equal(SubscriptionTier.Pro, subscription.Tier);
        Assert.Equal(SubscriptionStatus.Active, subscription.Status);
        Assert.Equal(SubscriptionTier.Pro, tenant.SubscriptionTier);
        Assert.Contains(db.AuditLogList, a => a.EntityName == "SubscriptionUpgrade" && a.EntityId == subscription.Id);

        // Act 2: Duplicate webhook -> idempotent duplicate
        var duplicate = await handler.Handle(cmd, CancellationToken.None);
        Assert.Equal("duplicate", duplicate.Status);
    }

    [Fact]
    public async Task SubscriptionsController_GetSubscriptionVietQr_DevFallbackAndNonDev422()
    {
        var db = new SepayFakeDbContext();
        var tenantId = Guid.NewGuid();
        var subPayment = new SubscriptionPayment
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            SubscriptionId = Guid.NewGuid(),
            Amount = 699_000m,
            Method = PaymentMethod.VNPay,
            Status = PaymentStatus.Pending,
            TransactionRef = "SUB_2_1_A1B2C3D4E5",
            CreatedAtUtc = DateTime.UtcNow
        };
        db.SubscriptionPaymentList.Add(subPayment);

        var tenantSvc = new CurrentTenantService { TenantId = tenantId };
        var propSvc = new CurrentPropertyService();
        var userCtx = new CurrentUserContext(tenantSvc, propSvc);
        userCtx.SetUser(Guid.NewGuid(), "owner@hotel.vn", GlobalUserRole.TenantStaff);
        userCtx.SetMembershipContext(tenantId, TenantStatus.Active, null, null, StaffRole.Owner, null, isTenantWide: true);

        var vietQrService = new VietQrService();
        var queryHandler = new GetSubscriptionVietQrQueryHandler(db, tenantSvc, userCtx, vietQrService);
        var sender = new DelegateSender((req, ct) => req switch
        {
            GetSubscriptionVietQrQuery q => WrapResult(queryHandler.Handle(q, ct)),
            _ => throw new NotSupportedException()
        });

        var controller = new SubscriptionsController(sender);
        var emptyConfig = BuildConfig(new Dictionary<string, string?>());

        // 1. Development with empty platform config -> uses dev demo MBBank fallback
        var devResult = await controller.GetSubscriptionVietQr(
            subPayment.Id,
            emptyConfig,
            new StubHostEnvironment(Environments.Development),
            CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(devResult);
        var apiResponse = Assert.IsType<ApiResponse<SubscriptionVietQrDto>>(ok.Value);
        Assert.True(apiResponse.Success);
        Assert.NotNull(apiResponse.Data);
        Assert.Equal(subPayment.Id, apiResponse.Data!.PaymentId);
        Assert.Equal("SUB_2_1_A1B2C3D4E5", apiResponse.Data.TransactionRef);
        Assert.Equal("NANGCAP SUB21A1B2C3D4E5", apiResponse.Data.TransferContent);
        Assert.Equal(699_000m, apiResponse.Data.Amount);
        Assert.Equal("970422", apiResponse.Data.BankBin);
        Assert.Equal("0999888777", apiResponse.Data.BankAccountNumber);
        Assert.Equal("HOTEL SAAS PLATFORM", apiResponse.Data.BankAccountHolder);
        Assert.StartsWith("https://img.vietqr.io/image/970422-0999888777-compact2.png", apiResponse.Data.QrImageUrl);

        // 2. Non-Development with empty platform config -> 422 ERR_BANK_ACCOUNT_NOT_CONFIGURED
        var prodResult = await controller.GetSubscriptionVietQr(
            subPayment.Id,
            emptyConfig,
            new StubHostEnvironment(Environments.Production),
            CancellationToken.None);

        var unproc = Assert.IsType<UnprocessableEntityObjectResult>(prodResult);
        var failResp = Assert.IsType<ApiResponse<object?>>(unproc.Value);
        Assert.False(failResp.Success);
        Assert.Equal("ERR_BANK_ACCOUNT_NOT_CONFIGURED", failResp.ErrorCode);
    }

    [Fact]
    public void VietQrService_HyphenatedConfirmationCode_ProducesCleanAlphanumericMemo_AndOptionalSepayQrImage()
    {
        var defaultService = new VietQrService();
        var payload = new VietQrPayload(
            BankBin: "970422",
            AccountNumber: "0987654321",
            AccountName: "KHACH SAN SAIGON",
            Amount: 1_500_000m,
            Description: "DATPHONG RES-ABC123",
            ConfirmationCode: "RES-ABC123");

        var defaultResult = defaultService.GenerateDynamicQr(payload);

        Assert.Equal("DATPHONG RESABC123", defaultResult.Description);
        Assert.DoesNotContain("-", defaultResult.Description);
        Assert.StartsWith("https://img.vietqr.io/image/970422-0987654321-compact2.png", defaultResult.QrImageUrl);
        Assert.Contains("addInfo=DATPHONG+RESABC123", defaultResult.QrImageUrl);

        var sepayConfig = BuildConfig(new Dictionary<string, string?>
        {
            ["Payment:Sepay:UseSepayQrImage"] = "true"
        });
        var sepayService = new VietQrService(sepayConfig);
        var sepayResult = sepayService.GenerateDynamicQr(payload);

        Assert.Equal("DATPHONG RESABC123", sepayResult.Description);
        Assert.Equal(
            "https://qr.sepay.vn/img?acc=0987654321&bank=MBBank&amount=1500000&des=DATPHONG+RESABC123",
            sepayResult.QrImageUrl);
    }

    // ── Test Helpers & Fakes ─────────────────────────────────────────────────

    private static IConfiguration BuildConfig(Dictionary<string, string?> values) =>
        new ConfigurationBuilder().AddInMemoryCollection(values).Build();

    private static WebhooksController CreateWebhooksController(
        ISender sender,
        IConfiguration config,
        IHostEnvironment env,
        string? authorizationHeader)
    {
        var httpContext = new DefaultHttpContext();
        if (!string.IsNullOrEmpty(authorizationHeader))
        {
            httpContext.Request.Headers["Authorization"] = authorizationHeader;
        }

        return new WebhooksController(sender, config, env)
        {
            ControllerContext = new ControllerContext { HttpContext = httpContext }
        };
    }

    private static SepayWebhookPayload CreateSamplePayload(long id) => new()
    {
        Id = id,
        Gateway = "MBBank",
        TransactionDate = "2026-11-21 10:00:00",
        AccountNumber = "0987654321",
        Code = "RESABC123",
        Content = "DATPHONG RESABC123",
        TransferType = "in",
        Description = "Test SePay transfer",
        TransferAmount = 500_000m,
        ReferenceCode = $"FT-{id}"
    };

    private static (Tenant Tenant, Property Property, Reservation Reservation) SeedReservationWithBank(
        SepayFakeDbContext db,
        string confirmationCode,
        decimal totalAmount,
        decimal depositRequired,
        string bankAccount,
        ReservationStatus status = ReservationStatus.PendingPayment,
        DateTime? holdExpiresAtUtc = null)
    {
        var tenant = new Tenant
        {
            Id = Guid.NewGuid(),
            Code = $"T-{confirmationCode}",
            Name = "Test Hotel Group",
            Slug = $"tenant-{Guid.NewGuid():N}"
        };
        var property = new Property
        {
            Id = Guid.NewGuid(),
            TenantId = tenant.Id,
            Code = $"P-{confirmationCode}",
            Name = "Test Hotel Branch",
            Slug = $"prop-{Guid.NewGuid():N}"
        };
        var snapshot = new ReservationSnapshot
        {
            IsOnlineHold = true,
            HoldExpiresAtUtc = holdExpiresAtUtc ?? DateTime.UtcNow.AddMinutes(15),
            DepositRequired = depositRequired,
            RoomTypeName = "Deluxe Sea View",
            TotalAmount = totalAmount
        };
        var reservation = new Reservation
        {
            Id = Guid.NewGuid(),
            TenantId = tenant.Id,
            PropertyId = property.Id,
            RoomId = Guid.NewGuid(),
            ConfirmationCode = confirmationCode,
            Status = status,
            TotalAmount = totalAmount,
            GuestName = "Nguyễn Văn Test",
            GuestEmail = "guest@test.local",
            CheckInDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(1)),
            CheckOutDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(2)),
            Notes = ReservationSnapshotHelper.Serialize(snapshot),
            CreatedAtUtc = DateTime.UtcNow
        };
        var printConfig = new PrintTemplateConfig
        {
            Id = Guid.NewGuid(),
            TenantId = tenant.Id,
            PropertyId = property.Id,
            HeaderCompanyName = property.Name,
            BankName = "MBBank",
            BankAccountNumber = bankAccount,
            BankAccountHolder = "TEST HOTEL"
        };

        db.TenantList.Add(tenant);
        db.PropertyList.Add(property);
        db.ReservationList.Add(reservation);
        db.PrintTemplateConfigList.Add(printConfig);
        return (tenant, property, reservation);
    }

    private static async Task<object?> WrapResult<T>(Task<T> task) => await task;

    private sealed class StubHostEnvironment : IHostEnvironment
    {
        public StubHostEnvironment(string environmentName) => EnvironmentName = environmentName;
        public string EnvironmentName { get; set; }
        public string ApplicationName { get; set; } = "HotelSaas.WebApi";
        public string ContentRootPath { get; set; } = string.Empty;
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }

    private sealed class DelegateSender : ISender
    {
        private readonly Func<object, CancellationToken, Task<object?>> _responder;
        public List<object> SentRequests { get; } = new();

        public DelegateSender(Func<object, CancellationToken, Task<object?>> responder) => _responder = responder;

        public async Task<TResponse> Send<TResponse>(IRequest<TResponse> request, CancellationToken cancellationToken = default)
        {
            SentRequests.Add(request);
            var response = await _responder(request, cancellationToken);
            return (TResponse)response!;
        }

        public Task Send<TRequest>(TRequest request, CancellationToken cancellationToken = default) where TRequest : IRequest
        {
            SentRequests.Add(request);
            return Task.CompletedTask;
        }

        public Task<object?> Send(object request, CancellationToken cancellationToken = default)
        {
            SentRequests.Add(request);
            return _responder(request, cancellationToken);
        }

        public IAsyncEnumerable<TResponse> CreateStream<TResponse>(IStreamRequest<TResponse> request, CancellationToken cancellationToken = default) =>
            throw new NotImplementedException();

        public IAsyncEnumerable<object?> CreateStream(object request, CancellationToken cancellationToken = default) =>
            throw new NotImplementedException();
    }

    private sealed class SpyNotificationDispatcher : INotificationDispatcher
    {
        public List<(string PropertyId, string ReservationId, string ConfirmationCode, decimal DepositPaid)> ConfirmedReservations { get; } = new();
        public List<(string PropertyId, string ReservationId, decimal PaidAmount, string PaymentMethod)> ConfirmedPayments { get; } = new();

        public Task NotifyNewReservationConfirmedAsync(
            string propertyId,
            string reservationId,
            string confirmationCode,
            string guestName,
            string roomTypeName,
            decimal totalAmount,
            decimal depositPaid,
            CancellationToken cancellationToken = default)
        {
            ConfirmedReservations.Add((propertyId, reservationId, confirmationCode, depositPaid));
            return Task.CompletedTask;
        }

        public Task NotifyReservationStatusChangedAsync(
            string propertyId,
            string reservationId,
            string confirmationCode,
            string previousStatus,
            string newStatus,
            CancellationToken cancellationToken = default) => Task.CompletedTask;

        public Task NotifyHousekeepingAlertAsync(
            string propertyId,
            string roomNumber,
            string roomStatus,
            string message,
            CancellationToken cancellationToken = default) => Task.CompletedTask;

        public Task NotifyBookingPaymentConfirmedAsync(
            string propertyId,
            string reservationId,
            string confirmationCode,
            string guestName,
            decimal totalAmount,
            decimal paidAmount,
            string paymentMethod,
            CancellationToken cancellationToken = default)
        {
            ConfirmedPayments.Add((propertyId, reservationId, paidAmount, paymentMethod));
            return Task.CompletedTask;
        }

        public Task NotifyBookingCancellationRequestedAsync(
            string propertyId,
            string reservationId,
            string confirmationCode,
            string guestName,
            string reason,
            decimal refundableAmount,
            CancellationToken cancellationToken = default) => Task.CompletedTask;

        public Task<bool> NotifyHoldExpiredAsync(
            string propertyId,
            string reservationId,
            string confirmationCode,
            string roomTypeName,
            CancellationToken cancellationToken = default) => Task.FromResult(true);
    }

    private sealed class NoopTransaction : IDbContextTransaction
    {
        public Guid TransactionId { get; } = Guid.NewGuid();
        public void Commit() { }
        public Task CommitAsync(CancellationToken cancellationToken = default) => Task.CompletedTask;
        public void Dispose() { }
        public ValueTask DisposeAsync() => ValueTask.CompletedTask;
        public void Rollback() { }
        public Task RollbackAsync(CancellationToken cancellationToken = default) => Task.CompletedTask;
    }

    private sealed class EfMethodStripper : ExpressionVisitor
    {
        private readonly IQueryable _root;
        private EfMethodStripper(IQueryable root) => _root = root;

        public static Expression Strip(Expression expression, IQueryable root) =>
            new EfMethodStripper(root).Visit(expression);

        protected override Expression VisitMethodCall(MethodCallExpression node)
        {
            if (node.Method.Name is "IgnoreQueryFilters" or "AsNoTracking" or "Include" or "ThenInclude" or "AsSplitQuery")
            {
                return Visit(node.Arguments[0]);
            }

            return base.VisitMethodCall(node);
        }

        protected override Expression VisitConstant(ConstantExpression node)
        {
            if (node.Value != null && node.Value.GetType().IsGenericType)
            {
                var def = node.Value.GetType().GetGenericTypeDefinition();
                if (def == typeof(FakeAsyncDbSet<>) || def == typeof(FakeAsyncQueryable<>))
                {
                    return _root.Expression;
                }
            }

            return base.VisitConstant(node);
        }
    }

    private sealed class FakeAsyncEnumerator<T> : IAsyncEnumerator<T>
    {
        private readonly IEnumerator<T> _inner;
        public FakeAsyncEnumerator(IEnumerator<T> inner) => _inner = inner;
        public T Current => _inner.Current;
        public ValueTask<bool> MoveNextAsync() => ValueTask.FromResult(_inner.MoveNext());
        public ValueTask DisposeAsync()
        {
            _inner.Dispose();
            return ValueTask.CompletedTask;
        }
    }

    private sealed class FakeAsyncQueryProvider<TEntity> : IAsyncQueryProvider where TEntity : class
    {
        private readonly List<TEntity> _data;
        public FakeAsyncQueryProvider(List<TEntity> data) => _data = data;

        public IQueryable CreateQuery(Expression expression)
        {
            var elementType = expression.Type.GetGenericArguments().First();
            return (IQueryable)Activator.CreateInstance(
                typeof(FakeAsyncQueryable<>).MakeGenericType(elementType),
                expression, this)!;
        }

        public IQueryable<TElement> CreateQuery<TElement>(Expression expression) =>
            new FakeAsyncQueryable<TElement>(expression, this);

        public object? Execute(Expression expression)
        {
            var root = _data.AsQueryable();
            return root.Provider.Execute(EfMethodStripper.Strip(expression, root));
        }

        public TResult Execute<TResult>(Expression expression)
        {
            var root = _data.AsQueryable();
            return root.Provider.Execute<TResult>(EfMethodStripper.Strip(expression, root));
        }

        public TResult ExecuteAsync<TResult>(Expression expression, CancellationToken cancellationToken = default)
        {
            var expectedResultType = typeof(TResult).GetGenericArguments()[0];
            var root = _data.AsQueryable();
            var rewritten = EfMethodStripper.Strip(expression, root);
            var executionResult = typeof(IQueryProvider)
                .GetMethod(nameof(IQueryProvider.Execute), 1, new[] { typeof(Expression) })!
                .MakeGenericMethod(expectedResultType)
                .Invoke(root.Provider, new object[] { rewritten });

            return (TResult)typeof(Task).GetMethod(nameof(Task.FromResult))!
                .MakeGenericMethod(expectedResultType)
                .Invoke(null, new[] { executionResult })!;
        }
    }

    private sealed class FakeAsyncQueryable<TElement> : IOrderedQueryable<TElement>, IAsyncEnumerable<TElement>
    {
        private readonly Expression _expression;
        private readonly IAsyncQueryProvider _provider;

        public FakeAsyncQueryable(Expression expression, IAsyncQueryProvider provider)
        {
            _expression = expression;
            _provider = provider;
        }

        Type IQueryable.ElementType => typeof(TElement);
        Expression IQueryable.Expression => _expression;
        IQueryProvider IQueryable.Provider => _provider;

        public IEnumerator<TElement> GetEnumerator() =>
            _provider.Execute<IEnumerable<TElement>>(_expression).GetEnumerator();

        IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();

        public IAsyncEnumerator<TElement> GetAsyncEnumerator(CancellationToken cancellationToken = default) =>
            new FakeAsyncEnumerator<TElement>(GetEnumerator());
    }

    private sealed class FakeAsyncDbSet<TEntity> : DbSet<TEntity>, IQueryable<TEntity>, IAsyncEnumerable<TEntity>
        where TEntity : class
    {
        private readonly List<TEntity> _data;
        private readonly FakeAsyncQueryProvider<TEntity> _provider;
        private readonly Expression _expression;

        public FakeAsyncDbSet(List<TEntity> data)
        {
            _data = data;
            _provider = new FakeAsyncQueryProvider<TEntity>(data);
            _expression = Expression.Constant(this);
        }

        public override IEntityType EntityType => null!;
        Type IQueryable.ElementType => typeof(TEntity);
        Expression IQueryable.Expression => _expression;
        IQueryProvider IQueryable.Provider => _provider;

        public IEnumerator<TEntity> GetEnumerator() => _data.GetEnumerator();
        IEnumerator IEnumerable.GetEnumerator() => _data.GetEnumerator();

        public override IAsyncEnumerator<TEntity> GetAsyncEnumerator(CancellationToken cancellationToken = default) =>
            new FakeAsyncEnumerator<TEntity>(_data.GetEnumerator());

        public override EntityEntry<TEntity> Add(TEntity entity)
        {
            _data.Add(entity);
            return null!;
        }
    }

    private sealed class SepayFakeDbContext : IApplicationDbContext
    {
        public List<Tenant> TenantList { get; } = new();
        public List<Property> PropertyList { get; } = new();
        public List<Reservation> ReservationList { get; } = new();
        public List<Payment> PaymentList { get; } = new();
        public List<PrintTemplateConfig> PrintTemplateConfigList { get; } = new();
        public List<Subscription> SubscriptionList { get; } = new();
        public List<SubscriptionPayment> SubscriptionPaymentList { get; } = new();
        public List<SubscriptionPlan> SubscriptionPlanList { get; } = new();
        public List<AuditLog> AuditLogList { get; } = new();

        public List<string> LockedIdempotencyKeys { get; } = new();
        public List<Guid> LockedReservationIds { get; } = new();
        public List<Guid> LockedRoomIds { get; } = new();

        public SepayFakeDbContext()
        {
            Tenants = new FakeAsyncDbSet<Tenant>(TenantList);
            Properties = new FakeAsyncDbSet<Property>(PropertyList);
            Reservations = new FakeAsyncDbSet<Reservation>(ReservationList);
            Payments = new FakeAsyncDbSet<Payment>(PaymentList);
            PrintTemplateConfigs = new FakeAsyncDbSet<PrintTemplateConfig>(PrintTemplateConfigList);
            Subscriptions = new FakeAsyncDbSet<Subscription>(SubscriptionList);
            SubscriptionPayments = new FakeAsyncDbSet<SubscriptionPayment>(SubscriptionPaymentList);
            SubscriptionPlans = new FakeAsyncDbSet<SubscriptionPlan>(SubscriptionPlanList);
            AuditLogs = new FakeAsyncDbSet<AuditLog>(AuditLogList);
        }

        public DbSet<Tenant> Tenants { get; }
        public DbSet<Property> Properties { get; }
        public DbSet<Reservation> Reservations { get; }
        public DbSet<Payment> Payments { get; }
        public DbSet<PrintTemplateConfig> PrintTemplateConfigs { get; }
        public DbSet<Subscription> Subscriptions { get; }
        public DbSet<SubscriptionPayment> SubscriptionPayments { get; }
        public DbSet<SubscriptionPlan> SubscriptionPlans { get; }
        public DbSet<AuditLog> AuditLogs { get; }

        public DbSet<User> Users => throw new NotImplementedException();
        public DbSet<RefreshToken> RefreshTokens => throw new NotImplementedException();
        public DbSet<AccessRole> AccessRoles => throw new NotImplementedException();
        public DbSet<PermissionFunction> PermissionFunctions => throw new NotImplementedException();
        public DbSet<RolePermission> RolePermissions => throw new NotImplementedException();
        public DbSet<TenantStaff> TenantStaffMembers => throw new NotImplementedException();
        public DbSet<RoomType> RoomTypes => throw new NotImplementedException();
        public DbSet<Room> Rooms => throw new NotImplementedException();
        public DbSet<SystemBanner> SystemBanners => throw new NotImplementedException();
        public DbSet<PropertySurchargePolicy> PropertySurchargePolicies => throw new NotImplementedException();
        public DbSet<RoomTypeRate> RoomTypeRates => throw new NotImplementedException();
        public DbSet<RoomTypeRateAudit> RoomTypeRateAudits => throw new NotImplementedException();
        public DbSet<Invoice> Invoices => throw new NotImplementedException();
        public DbSet<InvoiceItem> InvoiceItems => throw new NotImplementedException();
        public DbSet<GuestLoyaltyMembership> GuestLoyaltyMemberships => throw new NotImplementedException();
        public DbSet<LoyaltyPointTransaction> LoyaltyPointTransactions => throw new NotImplementedException();
        public DbSet<TenantContract> TenantContracts => throw new NotImplementedException();
        public DbSet<SocialIdentity> SocialIdentities => throw new NotImplementedException();
        public DbSet<GuestReview> GuestReviews => throw new NotImplementedException();
        public DbSet<AiUsageLog> AiUsageLogs => throw new NotImplementedException();

        public Task<IDbContextTransaction> BeginTransactionAsync(CancellationToken cancellationToken = default) =>
            Task.FromResult<IDbContextTransaction>(new NoopTransaction());

        public Task LockUserRowAsync(Guid userId, CancellationToken cancellationToken = default) =>
            Task.CompletedTask;

        public Task LockRoomTypeRowAsync(Guid roomTypeId, Guid tenantId, Guid propertyId, CancellationToken cancellationToken = default) =>
            Task.CompletedTask;

        public Task LockRoomRowAsync(Guid roomId, Guid tenantId, Guid propertyId, CancellationToken cancellationToken = default)
        {
            LockedRoomIds.Add(roomId);
            return Task.CompletedTask;
        }

        public Task LockReservationRowAsync(Guid reservationId, Guid tenantId, Guid propertyId, CancellationToken cancellationToken = default)
        {
            LockedReservationIds.Add(reservationId);
            return Task.CompletedTask;
        }

        public Task LockIdempotencyKeyAsync(Guid propertyId, string idempotencyKey, CancellationToken cancellationToken = default)
        {
            LockedIdempotencyKeys.Add(idempotencyKey);
            return Task.CompletedTask;
        }

        public Task<int> UpdateRoomStatusAtomicAsync(
            Guid roomId,
            Guid tenantId,
            Guid propertyId,
            RoomStatus expectedOldStatus,
            RoomStatus newStatus,
            DateTime updatedAtUtc,
            CancellationToken cancellationToken = default) => Task.FromResult(1);

        public Task<int> SaveChangesAsync(CancellationToken cancellationToken = default) =>
            Task.FromResult(1);
    }
}
