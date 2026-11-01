using System.Net;
using HotelSaas.Application.Common.Interfaces;
using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using MimeKit;

namespace HotelSaas.Infrastructure.Services;

/// <summary>
/// Implements email delivery using SMTP (supporting Gmail SMTP and standard TLS servers) via MailKit.
/// </summary>
public sealed class GmailSmtpEmailService : IEmailService
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<GmailSmtpEmailService> _logger;

    public GmailSmtpEmailService(IConfiguration configuration, ILogger<GmailSmtpEmailService> logger)
    {
        _configuration = configuration;
        _logger = logger;
    }

    /// <inheritdoc />
    public async Task<bool> SendVerificationEmailAsync(
        string targetEmail,
        string customerName,
        string verificationUrl,
        long expiresInMinutes = 30,
        CancellationToken cancellationToken = default)
    {
        var subject = "Xác thực email tài khoản - LuxeStay";
        var safeName = WebUtility.HtmlEncode(string.IsNullOrWhiteSpace(customerName) ? "Quý khách" : customerName.Trim());
        var safeUrl = WebUtility.HtmlEncode(verificationUrl);

        var htmlBody = $"""
        <!doctype html>
        <html lang="vi">
          <body style="margin:0;background:#f5f0e8;font-family:Arial,sans-serif;color:#17332d">
            <div style="display:none;max-height:0;overflow:hidden;opacity:0">Xác thực địa chỉ email LuxeStay của bạn.</div>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:38px 14px;background:#f5f0e8">
              <tr><td align="center">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#fffdf9;border:1px solid #e5dccd;border-radius:24px;overflow:hidden;box-shadow:0 18px 50px rgba(23,51,45,.10)">
                  <tr><td style="padding:16px 32px;background:#d8a84e;color:#17332d;font-size:12px;font-weight:700;letter-spacing:2.4px;text-transform:uppercase">LuxeStay · Xác minh danh tính</td></tr>
                  <tr><td style="padding:36px 32px;background:#173f37;color:#fff"><h1 style="margin:0;font-family:Georgia,serif;font-size:32px;font-weight:normal">Xác thực địa chỉ email</h1></td></tr>
                  <tr><td style="padding:32px">
                    <p>Xin chào <strong>{safeName}</strong>,</p>
                    <p style="line-height:1.65;color:#49635d">Xác thực địa chỉ này để bảo vệ tài khoản, tích điểm thành viên và nhận thông tin đặt phòng an toàn. Liên kết bảo mật này chỉ dùng một lần và hết hạn sau <strong>{expiresInMinutes} phút</strong>.</p>
                    <div style="margin:28px 0;text-align:center">
                      <a href="{safeUrl}" style="display:inline-block;padding:14px 32px;border-radius:999px;background:#d8a84e;color:#17332d;text-decoration:none;font-weight:700;font-size:15px;box-shadow:0 4px 12px rgba(216,168,78,0.35)">Xác thực tài khoản ngay →</a>
                    </div>
                    <p style="margin-top:26px;padding:14px 16px;background:#fff8e8;border-left:4px solid #d8a84e;font-size:13px;line-height:1.55;color:#5e5138">Nếu bạn không yêu cầu đăng ký tài khoản này, vui lòng bỏ qua email và không nhấp vào liên kết.</p>
                  </td></tr>
                  <tr><td style="padding:20px 32px;background:#173f37;font-size:12px;color:#dce9e5">LuxeStay Hospitality Group · Bảo mật & Định danh Khách lưu trú</td></tr>
                </table>
              </td></tr>
            </table>
          </body>
        </html>
        """;

        return await SendMimeMessageAsync(targetEmail, customerName, subject, htmlBody, cancellationToken);
    }

    /// <inheritdoc />
    public async Task<bool> SendWelcomeEmailAsync(
        string targetEmail,
        string customerName,
        CancellationToken cancellationToken = default)
    {
        var subject = "Chào mừng bạn gia nhập LuxeStay Hospitality";
        var safeName = WebUtility.HtmlEncode(string.IsNullOrWhiteSpace(customerName) ? "Quý khách" : customerName.Trim());

        var htmlBody = $"""
        <!doctype html>
        <html lang="vi">
          <body style="margin:0;background:#f5f0e8;font-family:Arial,sans-serif;color:#17332d">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:38px 14px;background:#f5f0e8">
              <tr><td align="center">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#fffdf9;border:1px solid #e5dccd;border-radius:24px;overflow:hidden;box-shadow:0 18px 50px rgba(23,51,45,.10)">
                  <tr><td style="padding:16px 32px;background:#d8a84e;color:#17332d;font-size:12px;font-weight:700;letter-spacing:2.4px;text-transform:uppercase">LuxeStay · Hội viên Khách hàng</td></tr>
                  <tr><td style="padding:36px 32px;background:#173f37;color:#fff"><h1 style="margin:0;font-family:Georgia,serif;font-size:32px;font-weight:normal">Chào mừng đến với LuxeStay</h1></td></tr>
                  <tr><td style="padding:32px">
                    <p>Xin chào <strong>{safeName}</strong>,</p>
                    <p style="line-height:1.65;color:#49635d">Tài khoản của bạn đã được khởi tạo thành công trên hệ thống quản lý & đặt phòng khách sạn toàn quốc LuxeStay.</p>
                    <ul style="line-height:1.8;color:#49635d">
                      <li>Đặt phòng khách sạn theo giờ, qua đêm và theo ngày với giá ưu đãi.</li>
                      <li>Tích điểm hội viên và nâng hạng thẻ tự động sau mỗi kỳ lưu trú.</li>
                      <li>Theo dõi lịch sử hóa đơn Folio và check-in không cần chờ đợi.</li>
                    </ul>
                  </td></tr>
                  <tr><td style="padding:20px 32px;background:#173f37;font-size:12px;color:#dce9e5">LuxeStay Hospitality Group · Trải nghiệm Nghỉ dưỡng Cao cấp</td></tr>
                </table>
              </td></tr>
            </table>
          </body>
        </html>
        """;

        return await SendMimeMessageAsync(targetEmail, customerName, subject, htmlBody, cancellationToken);
    }

    private async Task<bool> SendMimeMessageAsync(
        string targetEmail,
        string customerName,
        string subject,
        string htmlBody,
        CancellationToken cancellationToken)
    {
        var isEnabled = _configuration.GetValue("Smtp:Enabled", true);
        if (!isEnabled || string.IsNullOrWhiteSpace(targetEmail))
        {
            _logger.LogInformation("Email delivery skipped: service disabled or target email empty ({TargetEmail})", targetEmail);
            return false;
        }

        var host = _configuration["Smtp:Host"] ?? "smtp.gmail.com";
        var port = _configuration.GetValue("Smtp:Port", 587);
        var username = _configuration["Smtp:Username"] ?? "ngovotuananh@gmail.com";
        var password = _configuration["Smtp:Password"];
        var senderName = _configuration["Smtp:SenderName"] ?? "LuxeStay Hospitality Group";

        if (string.IsNullOrWhiteSpace(password))
        {
            _logger.LogWarning("Smtp:Password is not configured. Email to {TargetEmail} could not be dispatched via Gmail SMTP.", targetEmail);
            return false;
        }

        try
        {
            var message = new MimeMessage();
            message.From.Add(new MailboxAddress(senderName, username));
            message.To.Add(new MailboxAddress(customerName, targetEmail));
            message.Subject = subject;

            var bodyBuilder = new BodyBuilder
            {
                HtmlBody = htmlBody
            };
            message.Body = bodyBuilder.ToMessageBody();

            using var client = new SmtpClient();
            await client.ConnectAsync(host, port, SecureSocketOptions.StartTls, cancellationToken);
            await client.AuthenticateAsync(username, password.Replace(" ", string.Empty), cancellationToken);
            await client.SendAsync(message, cancellationToken);
            await client.DisconnectAsync(true, cancellationToken);

            _logger.LogInformation("Email successfully dispatched to {TargetEmail} via SMTP {Host}:{Port}", targetEmail, host, port);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send email to {TargetEmail} via SMTP {Host}:{Port}", targetEmail, host, port);
            return false;
        }
    }
}
