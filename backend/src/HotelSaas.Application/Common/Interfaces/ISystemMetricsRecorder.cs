namespace HotelSaas.Application.Common.Interfaces;

/// <summary>
/// Abstraction for recording operational and security telemetry metrics from Application and Infrastructure layers.
/// </summary>
public interface ISystemMetricsRecorder
{
    void RecordVnpayIpnResult(string rspCode);
    void IncrementSignalRConnection();
    void DecrementSignalRConnection();
    void RecordIsolationBlock(string errorCode);
    void RecordSepayWebhook(string status);
    void RecordRateLimited(string policy);
}
