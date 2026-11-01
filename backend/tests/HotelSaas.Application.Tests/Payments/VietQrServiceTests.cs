using System;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Infrastructure.Services;
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
}
