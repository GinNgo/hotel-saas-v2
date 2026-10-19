using System;
using System.Collections.Generic;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Payments.Commands.ProcessVnpayIpn;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using HotelSaas.Infrastructure.Persistence;
using HotelSaas.Infrastructure.Persistence.Interceptors;
using HotelSaas.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Npgsql;
using Xunit;

namespace HotelSaas.Application.Tests.Payments;

/// <summary>
/// Unit and integration tests for VNPay Sandbox payment gateway and IPN webhook idempotency.
/// Verified against PostgreSQL 17 test database and VNPay sandbox configuration.
/// </summary>
[Collection("RealDatabaseTests")]
public sealed class VnpayIntegrationTests
{
    private static string GetConnectionString()
    {
        var envConn = Environment.GetEnvironmentVariable("TEST_DB_CONNECTION");
        if (!string.IsNullOrWhiteSpace(envConn)) return envConn;
        var port = Environment.GetEnvironmentVariable("TEST_POSTGRES_PORT") ?? "5435";
        return $"Host=localhost;Port={port};Database=hotel_saas_p1b01a_test;Username=postgres;Password=postgres;";
    }

    private static ApplicationDbContext CreateContext(string schema)
    {
        var builder = new NpgsqlConnectionStringBuilder(GetConnectionString()) { SearchPath = schema };
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(builder.ConnectionString)
            .Options;
        return new ApplicationDbContext(options, new DummyTenantService(), new DummyPropertyService());
    }

    private sealed class DummyTenantService : ICurrentTenantService { public Guid? TenantId { get; set; } }
    private sealed class DummyPropertyService : ICurrentPropertyService
    {
        public Guid? PropertyId { get; set; }
        public bool IsTenantWide { get; set; } = true;
        public IReadOnlyList<Guid> ExcludedPropertyIds { get; set; } = Array.Empty<Guid>();
        public Guid? HeaderPropertyId { get; set; }
        public Guid? TokenPropertyId { get; set; }
    }

    private static IVnpayPaymentService CreateVnpayService()
    {
        var dict = new Dictionary<string, string?>
        {
            ["Payment:Vnpay:TmnCode"] = "TESTONLY",
            ["Payment:Vnpay:HashSecret"] = "test-only-signing-key-not-a-provider-credential",
            ["Payment:Vnpay:Url"] = "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html",
            ["Payment:Vnpay:ReturnUrl"] = "http://localhost:4200/booking/vnpay-return"
        };
        var config = new ConfigurationBuilder().AddInMemoryCollection(dict).Build();
        return new VnpayPaymentService(config);
    }

    [Fact]
    public void VnpayPaymentService_CreatePaymentUrl_GeneratesValidSignedUrlWithHmacSha512()
    {
        var service = CreateVnpayService();
        var resId = Guid.NewGuid();
        var code = "RES-TEST-001";
        decimal amount = 1500000m;

        var result = service.CreatePaymentUrl(resId, code, amount, "Thanh toan dat phong", "127.0.0.1");

        Assert.NotNull(result);
        Assert.StartsWith("https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?", result.PaymentUrl);
        Assert.Contains("vnp_TmnCode=TESTONLY", result.PaymentUrl);
        Assert.Contains("vnp_Amount=150000000", result.PaymentUrl); // 1,500,000 * 100
        Assert.Contains("vnp_CurrCode=VND", result.PaymentUrl);
        Assert.Contains("vnp_SecureHash=", result.PaymentUrl);
        Assert.Equal(code, result.TransactionRef);
    }

    [Fact]
    public void VnpayPaymentService_VerifyCallback_TamperedAmount_ReturnsInvalidChecksum()
    {
        var service = CreateVnpayService();
        var callbackParams = new Dictionary<string, string>
        {
            ["vnp_TmnCode"] = "TESTONLY",
            ["vnp_Amount"] = "999999999", // Tampered
            ["vnp_TxnRef"] = "RES-TAMPERED",
            ["vnp_ResponseCode"] = "00",
            ["vnp_TransactionStatus"] = "00",
            ["vnp_SecureHash"] = "invalid_hash_signature_12345"
        };

        var result = service.VerifyCallback(callbackParams);

        Assert.False(result.IsValid);
        Assert.Equal("97", result.ResponseCode);
    }

    [Fact]
    public async Task ProcessVnpayIpnCommandHandler_ValidTransaction_ConfirmsReservationAndActivatesSmartLock()
    {
        var schema = $"test_vnpay_{Guid.NewGuid():N}";
        await using var conn = new NpgsqlConnection(GetConnectionString());
        await conn.OpenAsync();
        await using (var cmd = conn.CreateCommand())
        {
            cmd.CommandText = $"CREATE SCHEMA IF NOT EXISTS \"{schema}\";";
            await cmd.ExecuteNonQueryAsync();
        }

        try
        {
            await using var context = CreateContext(schema);
            await context.Database.MigrateAsync();

            // 1. Seed Tenant, Property, Room, and Pending Reservation
            var tenant = new Tenant
            {
                Id = Guid.NewGuid(),
                Code = "T-VNP",
                Name = "VNPay Test Tenant",
                Slug = $"vnp-tenant-{Guid.NewGuid():N}"
            };
            context.Tenants.Add(tenant);

            var prop = new Property
            {
                Id = Guid.NewGuid(),
                TenantId = tenant.Id,
                Code = "P-VNP",
                Name = "VNPay Test Property",
                Slug = $"vnp-prop-{Guid.NewGuid():N}"
            };
            context.Properties.Add(prop);

            var roomType = new RoomType
            {
                Id = Guid.NewGuid(),
                TenantId = tenant.Id,
                PropertyId = prop.Id,
                Name = "Deluxe Room",
                Code = "DLX"
            };
            context.RoomTypes.Add(roomType);

            var room = new Room
            {
                Id = Guid.NewGuid(),
                TenantId = tenant.Id,
                PropertyId = prop.Id,
                RoomTypeId = roomType.Id,
                RoomNumber = "VNP-101",
                Status = RoomStatus.Clean
            };
            context.Rooms.Add(room);

            var reservation = new Reservation
            {
                Id = Guid.NewGuid(),
                TenantId = tenant.Id,
                PropertyId = prop.Id,
                RoomId = room.Id,
                ConfirmationCode = $"RES-VNP-{Guid.NewGuid():N}"[..12],
                Status = ReservationStatus.PendingPayment,
                TotalAmount = 1200000m,
                CheckInDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(1)),
                CheckOutDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(2)),
                GuestName = "Nguyễn Văn VNPay",
                GuestEmail = "vnpay.guest@hotelsaas.local"
            };
            context.Reservations.Add(reservation);
            await context.SaveChangesAsync();

            // 2. Prepare Valid Signed IPN Payload
            var vnpayService = CreateVnpayService();
            string secret = "test-only-signing-key-not-a-provider-credential";

            var rawParams = new SortedDictionary<string, string>(StringComparer.Ordinal)
            {
                ["vnp_Amount"] = "120000000", // 1,200,000 * 100
                ["vnp_BankCode"] = "NCB",
                ["vnp_CardType"] = "ATM",
                ["vnp_OrderInfo"] = "Thanh toan don dat phong",
                ["vnp_PayDate"] = DateTime.UtcNow.ToString("yyyyMMddHHmmss"),
                ["vnp_ResponseCode"] = "00",
                ["vnp_TmnCode"] = "TESTONLY",
                ["vnp_TransactionNo"] = "14582910",
                ["vnp_TransactionStatus"] = "00",
                ["vnp_TxnRef"] = reservation.ConfirmationCode
            };

            var sb = new StringBuilder();
            foreach (var (k, v) in rawParams)
            {
                if (sb.Length > 0) sb.Append('&');
                sb.Append(k).Append('=').Append(v);
            }
            using var hmac = new HMACSHA512(Encoding.UTF8.GetBytes(secret));
            var hash = Convert.ToHexStringLower(hmac.ComputeHash(Encoding.UTF8.GetBytes(sb.ToString())));

            var ipnDict = new Dictionary<string, string>(rawParams)
            {
                ["vnp_SecureHash"] = hash
            };

            // 3. Dispatch ProcessVnpayIpnCommand
            var handler = new ProcessVnpayIpnCommandHandler(context, vnpayService);
            var response = await handler.Handle(new ProcessVnpayIpnCommand(ipnDict), CancellationToken.None);

            Assert.Equal("00", response.RspCode);
            Assert.Equal("Confirm Success", response.Message);

            // 4. Verify Database State
            var updatedRes = await context.Reservations.IgnoreQueryFilters().AsNoTracking().FirstAsync(r => r.Id == reservation.Id);
            Assert.Equal(ReservationStatus.Confirmed, updatedRes.Status);
            Assert.NotNull(updatedRes.SmartLockPin);
            Assert.Equal(6, updatedRes.SmartLockPin.Length);
            Assert.Equal("Active", updatedRes.SmartLockStatus);
            Assert.NotNull(updatedRes.SmartLockActivatedAtUtc);

            var payment = await context.Payments.IgnoreQueryFilters().AsNoTracking().FirstAsync(p => p.ReservationId == reservation.Id);
            Assert.Equal(PaymentMethod.VNPay, payment.Method);
            Assert.Equal(PaymentStatus.Completed, payment.Status);
            Assert.Equal(1200000m, payment.Amount);
            Assert.Equal("14582910", payment.TransactionRef);

            // 5. Test Idempotency (Repeat exact same IPN)
            var duplicateResponse = await handler.Handle(new ProcessVnpayIpnCommand(ipnDict), CancellationToken.None);
            Assert.Equal("02", duplicateResponse.RspCode);
            Assert.Equal("Order already confirmed", duplicateResponse.Message);

            // Verify no duplicate payment records created
            var paymentsCount = await context.Payments.IgnoreQueryFilters().CountAsync(p => p.ReservationId == reservation.Id);
            Assert.Equal(1, paymentsCount);
        }
        finally
        {
            await using var dropCmd = conn.CreateCommand();
            dropCmd.CommandText = $"DROP SCHEMA IF EXISTS \"{schema}\" CASCADE;";
            await dropCmd.ExecuteNonQueryAsync();
        }
    }
}
