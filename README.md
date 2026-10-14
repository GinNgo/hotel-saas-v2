# 🏨 Hotel SaaS Platform v2

> Hệ thống quản lý khách sạn / nhà nghỉ dạng SaaS với phân quyền RBAC

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | .NET 10, EF Core 10, MediatR (CQRS) |
| Frontend | Angular 22, PrimeNG, Chart.js |
| Database | PostgreSQL 17 |
| Realtime | SignalR |
| AI | Gemini API |
| CI/CD | GitHub Actions |
| Container | Docker + Docker Compose |

## Project Structure

```
hotel-saas-v2/
├── backend/          # .NET 10 Clean Architecture
│   ├── src/
│   │   ├── HotelSaas.Domain/         # Entities, Enums, Interfaces
│   │   ├── HotelSaas.Application/    # CQRS Commands/Queries, DTOs
│   │   ├── HotelSaas.Infrastructure/ # EF Core, Services, Jobs
│   │   └── HotelSaas.WebApi/         # Controllers, Middleware, Hubs
│   └── tests/
├── frontend/         # Angular 22 SPA
├── docker/           # Docker Compose files
├── docs/             # SRS, SDD, ADR, Test Plans
└── .github/          # CI/CD Workflows
```

## Product Roadmap

The implementation roadmap is tracked in [docs/implementation-phases.md](docs/implementation-phases.md), with the MVP commitment in [docs/srs/08-kpi-commitment.md](docs/srs/08-kpi-commitment.md). It prioritizes internal hotel operations, hourly and overnight stays, tenant organizations with one or multiple properties, and branch-scoped permissions. Minimal online booking shares inventory and holds with internal bookings. Vietnamese AI-assisted room search is part of the academic MVP, using validated backend search results rather than inventing prices or availability. Platform-wide catalog/maps and automated subscription billing are deferred unless required by the course rubric. Phase status is planned, not verified completion.

## Quick Start

### Prerequisites
- .NET 10 SDK
- Node.js 22+
- PostgreSQL 17 (or Docker)
- Angular CLI

### Backend
```bash
cd backend
dotnet restore
dotnet build
dotnet run --project src/HotelSaas.WebApi
```

### Frontend
```bash
cd frontend
npm install
ng serve
```

### Docker (All-in-one)
```bash
cd docker
docker compose up -d
```

## Team Guidelines

- Branch strategy: `main` → `develop` → `feature/*`
- Commit convention: [Conventional Commits](https://www.conventionalcommits.org/)
- All changes via Pull Request with review
- See [docs/coding-convention.md](docs/coding-convention.md) for details

## License

This project is developed as an academic project for Software Engineering course.
