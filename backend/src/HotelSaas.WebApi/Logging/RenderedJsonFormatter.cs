using System.IO;
using Serilog.Events;
using Serilog.Formatting;
using Serilog.Formatting.Json;

namespace HotelSaas.WebApi.Logging;

/// <summary>
/// Parameterless <see cref="ITextFormatter"/> wrapping Serilog's <see cref="JsonFormatter"/> with
/// <c>renderMessage: true</c> so <c>Serilog.Settings.Configuration</c> reliably emits <c>RenderedMessage</c>
/// in JSON console logs for human-readable Grafana/Loki log lines.
/// </summary>
public sealed class RenderedJsonFormatter : ITextFormatter
{
    private readonly JsonFormatter _inner = new(renderMessage: true);

    public void Format(LogEvent logEvent, TextWriter output) => _inner.Format(logEvent, output);
}
