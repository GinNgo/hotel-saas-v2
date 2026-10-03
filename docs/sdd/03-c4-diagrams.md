# 📐 C4 Model Diagrams

> **Tài liệu:** SDD-03 | **Phiên bản:** 1.0 | **Ngày:** 2026-10-03
> **Rubric mapping:** TC2.1 Mức 5 (context + component diagram)
> **Loại sơ đồ:** Context Diagram, Container Diagram, Component Diagram

---

## Level 1: System Context Diagram

> Ai tương tác với hệ thống? Hệ thống tích hợp với cái gì?

```mermaid
flowchart TD
    Guest["🧑 Guest<br/>(Khách đặt phòng)<br/>───<br/>Tìm kiếm, đặt phòng,<br/>thanh toán, review"]
    Staff["👷 Staff<br/>(Lễ tân, Buồng phòng)<br/>───<br/>Check-in/out, housekeeping,<br/>quản lý phòng"]
    Owner["👤 Owner / Manager<br/>(Chủ/Quản lý cơ sở)<br/>───<br/>Cấu hình, RBAC,<br/>reports, AI"]
    Admin["🔑 Platform Admin<br/>───<br/>Duyệt property,<br/>quản lý subscription"]

    System["🏨 Hotel SaaS Platform<br/>───<br/>Hệ thống quản lý<br/>khách sạn / nhà nghỉ<br/>SaaS + RBAC"]

    VNPay["💳 VNPay Gateway<br/>───<br/>Xử lý thanh toán<br/>online"]
    GeminiAI["🤖 Gemini AI API<br/>───<br/>Chatbot, pricing,<br/>reports"]
    EmailSvc["📧 Email Service<br/>(SMTP)<br/>───<br/>Confirmation,<br/>notification"]
    MapSvc["🗺️ Leaflet Maps<br/>───<br/>Hiển thị vị trí<br/>property"]

    Guest -->|"Đặt phòng,<br/>thanh toán"| System
    Staff -->|"Quản lý<br/>operations"| System
    Owner -->|"Cấu hình,<br/>báo cáo"| System
    Admin -->|"Quản trị<br/>platform"| System

    System -->|"Payment API"| VNPay
    System -->|"AI Inference"| GeminiAI
    System -->|"Send emails"| EmailSvc
    System -->|"Map tiles"| MapSvc

    style System fill:#1565c0,color:#fff
```

---

## Level 2: Container Diagram

> Hệ thống gồm những container (process/deployment unit) nào?

```mermaid
flowchart TD
    subgraph Users["Người dùng"]
        Browser["🌐 Web Browser<br/>(Guest / Staff / Owner)"]
    end

    subgraph Platform["🏨 Hotel SaaS Platform"]
        SPA["📱 Angular 22 SPA<br/>───<br/>PrimeNG, Chart.js<br/>Leaflet, SignalR Client<br/>───<br/>Port: 4200"]

        API["⚙️ .NET 10 Web API<br/>───<br/>REST + SignalR<br/>MediatR (CQRS)<br/>JWT + RBAC<br/>───<br/>Port: 5000"]

        DB["🗄️ PostgreSQL 17<br/>───<br/>EF Core 10<br/>Global Query Filters<br/>───<br/>Port: 5432"]

        Cache["⚡ Redis 7<br/>───<br/>Session cache<br/>Rate limiting<br/>───<br/>Port: 6379"]

        Seq["📊 Seq<br/>───<br/>Structured logs<br/>Dashboard<br/>───<br/>Port: 5341"]
    end

    subgraph External["Dịch vụ bên ngoài"]
        VNPay["💳 VNPay"]
        Gemini["🤖 Gemini AI"]
        SMTP["📧 SMTP"]
    end

    Browser -->|"HTTPS"| SPA
    SPA -->|"REST API + SignalR<br/>(JSON over HTTPS)"| API
    API -->|"Npgsql<br/>(TCP 5432)"| DB
    API -->|"StackExchange.Redis<br/>(TCP 6379)"| Cache
    API -->|"Serilog<br/>(HTTP 5341)"| Seq
    API -->|"HTTPS"| VNPay
    API -->|"HTTPS"| Gemini
    API -->|"SMTP"| SMTP

    style SPA fill:#e8f5e9
    style API fill:#e3f2fd
    style DB fill:#fff3e0
    style Cache fill:#fce4ec
    style Seq fill:#f3e5f5
```

---

## Level 3: Component Diagram — API (bên trong .NET 10 Web API)

> Bên trong API container có những component nào?

```mermaid
flowchart TD
    subgraph WebAPI["🌐 WebAPI Layer"]
        AuthCtrl["AuthController<br/>Login, Register,<br/>Refresh, Logout"]
        RoomCtrl["RoomController<br/>CRUD Rooms,<br/>Room Status"]
        ResCtrl["ReservationController<br/>CRUD Bookings,<br/>Check-in/out"]
        PayCtrl["PaymentController<br/>VNPay, Cash,<br/>Refund"]
        HKCtrl["HousekeepingController<br/>Tasks CRUD"]
        ReportCtrl["ReportController<br/>Revenue, Analytics"]
        AICtrl["AiController<br/>Chatbot, Pricing"]
        AdminCtrl["AdminController<br/>Platform mgmt"]

        MW["Middleware Pipeline"]
        MW --> TenantMW["TenantMiddleware<br/>Extract TenantId"]
        MW --> AuthMW["JwtBearerAuth<br/>Validate token"]
        MW --> RBACHandler["PermissionHandler<br/>Bitmask check"]
        MW --> ErrMW["ErrorHandling<br/>Global exception"]

        Hubs["SignalR Hubs"]
        Hubs --> RoomHub["RoomStatusHub<br/>Broadcast changes"]
        Hubs --> NotifHub["NotificationHub<br/>Push notifications"]
    end

    subgraph Application["⚙️ Application Layer"]
        AuthHandlers["Auth Handlers<br/>RegisterCommand<br/>LoginQuery"]
        RoomHandlers["Room Handlers<br/>CreateRoomCommand<br/>GetRoomsQuery"]
        ResHandlers["Reservation Handlers<br/>CreateBookingCommand<br/>CheckInCommand"]
        PayHandlers["Payment Handlers<br/>ProcessPaymentCommand<br/>VNPayCallbackCommand"]
        HKHandlers["Housekeeping Handlers<br/>CreateTaskCommand<br/>CompleteTaskCommand"]
        Validators["FluentValidation<br/>Validators"]
    end

    subgraph Infra["🔧 Infrastructure Layer"]
        DbCtx["ApplicationDbContext<br/>EF Core 10<br/>Global Query Filters"]
        TenantSvc["CurrentTenantService"]
        EmailSvc["EmailService"]
        AISvc["GeminiAiService"]
        VNPaySvc["VNPayService"]
        BgJobs["Background Workers<br/>BookingHoldCleanup<br/>NotificationRetention"]
    end

    AuthCtrl --> AuthHandlers
    RoomCtrl --> RoomHandlers
    ResCtrl --> ResHandlers
    PayCtrl --> PayHandlers
    HKCtrl --> HKHandlers

    AuthHandlers --> DbCtx
    RoomHandlers --> DbCtx
    ResHandlers --> DbCtx
    PayHandlers --> VNPaySvc
    HKHandlers --> DbCtx

    ResHandlers --> RoomHub
    AISvc --> Gemini["🤖 Gemini API"]

    style WebAPI fill:#fce4ec
    style Application fill:#e3f2fd
    style Infra fill:#fff3e0
```

---

## Level 3: Component Diagram — Frontend (bên trong Angular 22 SPA)

```mermaid
flowchart TD
    subgraph Core["Core Module"]
        AuthSvc["AuthService<br/>Login, Token mgmt"]
        PermSvc["PermissionService<br/>Check user perms"]
        TenantSvc["TenantService<br/>Current property"]
        JwtInt["JwtInterceptor<br/>Attach token to requests"]
        ErrInt["ErrorInterceptor<br/>Handle 401, 403, 500"]
        AuthGuard["AuthGuard<br/>Route protection"]
        PermGuard["PermissionGuard<br/>RBAC route check"]
    end

    subgraph Features["Feature Modules"]
        AuthFeat["Auth Feature<br/>Login, Register,<br/>Forgot Password"]
        DashFeat["Dashboard Feature<br/>KPI cards, charts"]
        RoomFeat["Rooms Feature<br/>Room grid, calendar"]
        ResFeat["Reservations Feature<br/>Booking list, form"]
        HKFeat["Housekeeping Feature<br/>Task board"]
        FinFeat["Finance Feature<br/>Payments, Invoices"]
        AdminFeat["Admin Feature<br/>Roles, Users, Settings"]
        PublicFeat["Public Feature<br/>Search, Booking,<br/>Property page"]
    end

    subgraph Shared["Shared Module"]
        DataTable["DataTable Component"]
        Dialog["Dialog Component"]
        Toast["Toast Notification"]
        Sidebar["Sidebar Drawer"]
        ChatWidget["AI Chat Widget"]
    end

    subgraph Layout["Layout"]
        TopBar["TopBar<br/>Search, notifications, user"]
        SideNav["SideNav<br/>Menu items by permission"]
        Content["Content Area<br/>Router outlet"]
    end

    AuthGuard --> AuthSvc
    PermGuard --> PermSvc
    Features --> Core
    Features --> Shared
    Layout --> Features
```

---

*Tài liệu này chứa 4 C4 diagrams (Context + Container + 2 Component), phục vụ TC2.1 Mức 5.*
