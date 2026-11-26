using System;
using System.Collections.Generic;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Infrastructure.Services;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace HotelSaas.Application.Tests.Payments;

/// <summary>
/// Unit tests for VietQR dynamic payment generation conforming to NAPAS 247 specification (Task A02).
/// </summary>
public sealed class VietQrServiceTests
{
    private readonly IVietQrService _vietQrService = new VietQrService();

    [Fact]
    public void GenerateDynamicQr_ValidPayload_ReturnsCorrectNapasQrUrl()
    {
        // Arrange
        var payload = new VietQrPayload(
            BankBin: "970422",
            AccountNumber: "0987654321",
            AccountName: "KHACH SAN EDENSEE DA LAT",
            Amount: 1850000m,
            Description: "DATPHONG DLE99281",
            ConfirmationCode: "DLE99281"
        );

        // Act
        var result = _vietQrService.GenerateDynamicQr(payload);

        // Assert
        Assert.NotNull(result);
        Assert.Equal("970422", result.BankBin);
        Assert.Contains("MB Bank", result.BankName);
        Assert.Equal("0987654321", result.AccountNumber);
        Assert.Equal(1850000m, result.Amount);
        Assert.Equal("DATPHONG DLE99281", result.Description);
        Assert.Equal("DLE99281", result.ConfirmationCode);
        Assert.StartsWith("https://img.vietqr.io/image/970422-0987654321-compact2.png", result.QrImageUrl);
        Assert.Contains("amount=1850000", result.QrImageUrl);
        Assert.StartsWith("vietqr://pay", result.QuickPayDeepLink);
    }

    [Fact]
    public void GenerateDynamicQr_VietnameseWithAccents_NormalizesAsciiForBankingStandards()
    {
        // Arrange
        var payload = new VietQrPayload(
            BankBin: "970415",
            AccountNumber: "1020304050",
            AccountName: "Khách Sạn Mường Thanh",
            Amount: 750000m,
            Description: "Đặt phòng Sa Pa #991",
            ConfirmationCode: "SP991"
        );

        // Act
        var result = _vietQrService.GenerateDynamicQr(payload);

        // Assert
        Assert.NotNull(result);
        Assert.Equal("KHACH SAN MUONG THANH", result.AccountName);
        Assert.DoesNotContain("Đ", result.Description);
        Assert.DoesNotContain("à", result.Description);
        Assert.Contains("SP991", result.Description);
    }

    [Fact]
    public void GenerateDynamicQr_NullPayload_ThrowsArgumentNullException()
    {
        Assert.Throws<ArgumentNullException>(() => _vietQrService.GenerateDynamicQr(null!));
    }

    [Fact]
    public void GenerateDynamicQr_WhenUseSepayQrImageEnabled_ProducesSepayQrImageUrl()
    {
        // Arrange
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Payment:Sepay:UseSepayQrImage"] = "true"
            })
            .Build();
        var service = new VietQrService(config);
        var payload = new VietQrPayload(
            BankBin: "970422",
            AccountNumber: "0987654321",
            AccountName: "KHACH SAN SAIGON",
            Amount: 1850000m,
            Description: "DATPHONG DLE-99281",
            ConfirmationCode: "DLE-99281");

        // Act
        var result = service.GenerateDynamicQr(payload);

        // Assert
        Assert.Equal("DATPHONG DLE99281", result.Description);
        Assert.Equal(
            "https://qr.sepay.vn/img?acc=0987654321&bank=MBBank&amount=1850000&des=DATPHONG+DLE99281",
            result.QrImageUrl);
    }

    [Theory]
    [InlineData("970416", "ACB")]
    [InlineData("970436", "Vietcombank")]
    [InlineData("970499", "970499")]
    public void GenerateDynamicQr_WhenUseSepayQrImageEnabled_MapsBankBinToSepayCodeOrFallsBackToRawBin(
        string bankBin,
        string expectedBankParam)
    {
        // Arrange
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Payment:Sepay:UseSepayQrImage"] = "true"
            })
            .Build();
        var service = new VietQrService(config);
        var payload = new VietQrPayload(
            BankBin: bankBin,
            AccountNumber: "33958647",
            AccountName: "HOTEL TEST",
            Amount: 500000m,
            Description: "DATPHONG RES123",
            ConfirmationCode: "RES123");

        // Act
        var result = service.GenerateDynamicQr(payload);

        // Assert
        Assert.Equal(
            $"https://qr.sepay.vn/img?acc=33958647&bank={expectedBankParam}&amount=500000&des=DATPHONG+RES123",
            result.QrImageUrl);
    }

    [Fact]
    public void GenerateDynamicQr_WhenUseSepayQrImageDisabled_ProducesVietQrIoImageUrl()
    {
        // Arrange
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Payment:Sepay:UseSepayQrImage"] = "false"
            })
            .Build();
        var service = new VietQrService(config);
        var payload = new VietQrPayload(
            BankBin: "970422",
            AccountNumber: "0987654321",
            AccountName: "KHACH SAN SAIGON",
            Amount: 500000m,
            Description: "DATPHONG RES123",
            ConfirmationCode: "RES123");

        // Act
        var result = service.GenerateDynamicQr(payload);

        // Assert
        Assert.StartsWith("https://img.vietqr.io/image/970422-0987654321-compact2.png", result.QrImageUrl);
    }
}
