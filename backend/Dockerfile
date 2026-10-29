# ═══════════════════════════════════════════════════════════════
# Hotel SaaS Platform — Backend WebApi (.NET 10)
# Multi-stage Enterprise Dockerfile
# ═══════════════════════════════════════════════════════════════

ARG DOTNET_VERSION=10.0-preview

# ── Stage 1: Dependency Restore & Build ──
FROM mcr.microsoft.com/dotnet/sdk:${DOTNET_VERSION} AS build
WORKDIR /src

# Copy project definition files first to optimize Docker layer caching
COPY HotelSaas.slnx ./
COPY src/HotelSaas.Domain/HotelSaas.Domain.csproj src/HotelSaas.Domain/
COPY src/HotelSaas.Application/HotelSaas.Application.csproj src/HotelSaas.Application/
COPY src/HotelSaas.Infrastructure/HotelSaas.Infrastructure.csproj src/HotelSaas.Infrastructure/
COPY src/HotelSaas.WebApi/HotelSaas.WebApi.csproj src/HotelSaas.WebApi/

# Restore dependencies
RUN dotnet restore src/HotelSaas.WebApi/HotelSaas.WebApi.csproj

# Copy the rest of the backend source code
COPY src/ src/

# Publish Release binaries
WORKDIR /src/src/HotelSaas.WebApi
RUN dotnet publish -c Release -o /app/publish --no-restore

# ── Stage 2: Production Minimal Runtime (Non-root) ──
FROM mcr.microsoft.com/dotnet/aspnet:${DOTNET_VERSION} AS runtime
WORKDIR /app

# Configure default container environment
ENV ASPNETCORE_URLS=http://+:5000 \
    ASPNETCORE_ENVIRONMENT=Production \
    DOTNET_RUNNING_IN_CONTAINER=true

# Copy published artifacts from build stage
COPY --from=build /app/publish .

# Security hardening: run as non-root user 'app' (UID 1654)
USER app

EXPOSE 5000

# Container healthcheck against lightweight /health endpoint
HEALTHCHECK --interval=20s --timeout=4s --retries=3 --start-period=10s \
  CMD wget -qO- http://localhost:5000/health || exit 1

ENTRYPOINT ["dotnet", "HotelSaas.WebApi.dll"]
