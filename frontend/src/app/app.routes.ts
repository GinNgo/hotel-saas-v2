import { Routes } from '@angular/router';
import { authGuard, platformAdminGuard } from './core/guards/auth.guard';
import { permissionGuard } from './core/guards/permission.guard';
import { unsavedChangesGuard } from './core/guards/unsaved-changes.guard';

export const routes: Routes = [
  // 1. Root URL -> Chuyển hướng trực tiếp vào Cổng Đặt phòng Công khai & Trang chủ Hệ thống
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'booking'
  },

  // 2. Canonical Auth Routes (/auth/*)
  {
    path: 'auth',
    loadComponent: () => import('./layouts/auth-layout/auth-layout').then(m => m.AuthLayoutComponent),
    children: [
      { path: '', redirectTo: 'login', pathMatch: 'full' },
      {
        path: 'login',
        loadComponent: () => import('./features/auth/login/login.page').then(m => m.LoginPage)
      },
      {
        path: 'register',
        loadComponent: () => import('./features/auth/register/register.page').then(m => m.RegisterPage)
      },
      {
        path: 'confirm-email',
        loadComponent: () => import('./features/auth/confirm-email/confirm-email.page').then(m => m.ConfirmEmailPage)
      },
      {
        path: 'partner-register',
        canDeactivate: [unsavedChangesGuard],
        loadComponent: () => import('./features/auth/partner-register/partner-register.page').then(m => m.PartnerRegisterPage)
      },
      {
        path: 'forgot-password',
        loadComponent: () => import('./features/auth/forgot-password/forgot-password.page').then(m => m.ForgotPasswordPage)
      },
      {
        path: 'reset-password',
        loadComponent: () => import('./features/auth/reset-password/reset-password.page').then(m => m.ResetPasswordPage)
      }
    ]
  },

  // 3. Top-level Auth Redirect Aliases (/login -> auth/login, ...)
  { path: 'login', redirectTo: 'auth/login', pathMatch: 'full' },
  { path: 'register', redirectTo: 'auth/register', pathMatch: 'full' },
  { path: 'confirm-email', redirectTo: 'auth/confirm-email', pathMatch: 'full' },
  { path: 'partner-register', redirectTo: 'auth/partner-register', pathMatch: 'full' },
  { path: 'forgot-password', redirectTo: 'auth/forgot-password', pathMatch: 'full' },
  { path: 'reset-password', redirectTo: 'auth/reset-password', pathMatch: 'full' },

  // 4. Public Booking & Guest Portal (Trang chủ khách sạn & Trải nghiệm Khách lưu trú)
  {
    path: 'booking',
    loadComponent: () =>
      import('./layouts/guest-layout/guest-layout').then(m => m.GuestLayoutComponent),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/public-booking/booking.page').then(m => m.BookingPageComponent)
      },
      {
        path: 'explore',
        loadComponent: () =>
          import('./features/public-booking/explore-search.page').then(
            m => m.ExploreSearchPageComponent
          )
      },
      {
        path: 'destinations',
        loadComponent: () =>
          import('./features/public-booking/destination-explore.page').then(
            m => m.DestinationExplorePageComponent
          )
      },
      {
        path: 'destinations/:slug',
        loadComponent: () =>
          import('./features/public-booking/destination-explore.page').then(
            m => m.DestinationExplorePageComponent
          )
      },
      {
        path: 'brands',
        loadComponent: () =>
          import('./features/public-booking/tenant-brand.page').then(
            m => m.TenantBrandPageComponent
          )
      },
      {
        path: 'brands/:tenantSlug',
        loadComponent: () =>
          import('./features/public-booking/tenant-brand.page').then(
            m => m.TenantBrandPageComponent
          )
      },
      {
        path: 'properties/:slug',
        loadComponent: () =>
          import('./features/public-booking/property-detail.page').then(
            m => m.PropertyDetailPageComponent
          )
      },
      {
        path: 'deals',
        loadComponent: () =>
          import('./features/public-booking/promotions.page').then(m => m.PromotionsPageComponent)
      },
      {
        path: 'lookup',
        loadComponent: () =>
          import('./features/public-booking/booking-lookup.page').then(
            m => m.BookingLookupPageComponent
          )
      },
      {
        path: 'hold',
        canDeactivate: [unsavedChangesGuard],
        loadComponent: () =>
          import('./features/public-booking/booking-hold.page').then(
            m => m.BookingHoldPageComponent
          )
      },
      {
        path: 'hold/:token',
        canDeactivate: [unsavedChangesGuard],
        loadComponent: () =>
          import('./features/public-booking/booking-hold.page').then(
            m => m.BookingHoldPageComponent
          )
      },
      {
        path: 'status/:token',
        loadComponent: () =>
          import('./features/public-booking/booking-status.page').then(
            m => m.BookingStatusPageComponent
          )
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./features/public-booking/member/guest-profile.page').then(
            m => m.GuestProfilePageComponent
          )
      }
    ]
  },

  // 5. Legacy /admin/* Redirect Aliases -> Canonical Root Admin/PMS Routes
  {
    path: 'admin',
    children: [
      { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
      { path: 'dashboard', redirectTo: '/dashboard', pathMatch: 'full' },
      { path: 'properties', redirectTo: '/properties', pathMatch: 'full' },
      { path: 'rooms', redirectTo: '/rooms', pathMatch: 'full' },
      { path: 'room-types', redirectTo: '/room-types', pathMatch: 'full' },
      { path: 'housekeeping', redirectTo: '/housekeeping', pathMatch: 'full' },
      { path: 'policies', redirectTo: '/policies', pathMatch: 'full' },
      { path: 'rates', redirectTo: '/rates', pathMatch: 'full' },
      { path: 'reservations', redirectTo: '/reservations', pathMatch: 'full' },
      { path: 'payments', redirectTo: '/payments', pathMatch: 'full' },
      { path: 'reports', redirectTo: '/reports', pathMatch: 'full' },
      { path: 'subscriptions', redirectTo: '/subscriptions', pathMatch: 'full' },
      { path: 'audit-logs', redirectTo: '/audit-logs', pathMatch: 'full' },
      { path: 'ops-readiness', redirectTo: '/ops-readiness', pathMatch: 'full' },
      { path: 'staff', redirectTo: '/staff', pathMatch: 'full' },
      { path: 'roles', redirectTo: '/roles', pathMatch: 'full' },
      { path: 'guests', redirectTo: '/guests', pathMatch: 'full' },
      { path: 'promotions', redirectTo: '/promotions', pathMatch: 'full' },
      { path: 'reviews', redirectTo: '/reviews', pathMatch: 'full' },
      { path: 'plans', redirectTo: '/plans', pathMatch: 'full' },
      { path: 'contracts', redirectTo: '/contracts', pathMatch: 'full' },
      { path: 'platform-tenants', redirectTo: '/platform-tenants', pathMatch: 'full' },
      { path: 'tenants', redirectTo: '/platform-tenants', pathMatch: 'full' },
      { path: 'admin-banners', redirectTo: '/admin-banners', pathMatch: 'full' },
      { path: 'banners', redirectTo: '/admin-banners', pathMatch: 'full' },
      { path: 'support-grants', redirectTo: '/support-grants', pathMatch: 'full' },
      { path: 'support-access', redirectTo: '/support-grants', pathMatch: 'full' }
    ]
  },

  // 6. Canonical Admin/PMS & Governance Management Routes (/dashboard, /rooms, /housekeeping...)
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layouts/admin-layout/admin-layout').then(m => m.AdminLayoutComponent),
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard.page').then(m => m.DashboardPage)
      },
      {
        path: 'properties',
        canActivate: [permissionGuard],
        canDeactivate: [unsavedChangesGuard],
        data: { permission: 'PROPERTIES', action: 1 },
        loadComponent: () => import('./features/properties/properties.page').then(m => m.PropertiesPage)
      },
      {
        path: 'rooms',
        canActivate: [permissionGuard],
        data: { permission: 'ROOMS', action: 1 },
        loadComponent: () => import('./features/rooms/rooms.page').then(m => m.RoomsPage)
      },
      {
        path: 'room-types',
        canActivate: [permissionGuard],
        data: { permission: 'ROOM_TYPES', action: 1 },
        loadComponent: () => import('./features/room-types/room-types.page').then(m => m.RoomTypesPage)
      },
      {
        path: 'housekeeping',
        canActivate: [permissionGuard],
        data: { permission: 'HOUSEKEEPING', action: 1 },
        loadComponent: () => import('./features/housekeeping/housekeeping.page').then(m => m.HousekeepingPage)
      },
      {
        path: 'policies',
        canActivate: [permissionGuard],
        canDeactivate: [unsavedChangesGuard],
        data: { permission: 'PROPERTIES', action: 1 },
        loadComponent: () => import('./features/policies/policies.page').then(m => m.PoliciesPage)
      },
      {
        path: 'rates',
        canActivate: [permissionGuard],
        canDeactivate: [unsavedChangesGuard],
        data: { permission: 'ROOM_TYPES', action: 1 },
        loadComponent: () => import('./features/rates/rates.page').then(m => m.RatesPage)
      },
      {
        path: 'reservations',
        canActivate: [permissionGuard],
        data: { permission: 'RESERVATIONS', action: 1 },
        loadComponent: () => import('./features/reservations/reservations.page').then(m => m.ReservationsPage)
      },
      {
        path: 'payments',
        canActivate: [permissionGuard],
        data: { permission: 'PAYMENTS', action: 1 },
        loadComponent: () => import('./features/payments/payments.page').then(m => m.PaymentsPage)
      },
      {
        path: 'reports',
        canActivate: [permissionGuard],
        data: { permission: 'REPORTS', action: 1 },
        loadComponent: () => import('./features/reports/reports.page').then(m => m.ReportsPage)
      },
      {
        path: 'subscriptions',
        canActivate: [permissionGuard],
        data: { permission: 'SUBSCRIPTIONS', action: 1 },
        loadComponent: () => import('./features/subscriptions/subscriptions.page').then(m => m.SubscriptionsPage)
      },
      {
        path: 'audit-logs',
        canActivate: [permissionGuard],
        data: { permission: 'AUDIT_LOGS', action: 1 },
        loadComponent: () => import('./features/audit-logs/audit-logs.page').then(m => m.AuditLogsPage)
      },
      {
        path: 'ops-readiness',
        canActivate: [platformAdminGuard],
        loadComponent: () => import('./features/ops-readiness/ops-readiness.page').then(m => m.OpsReadinessPage)
      },
      {
        path: 'staff',
        canActivate: [permissionGuard],
        data: { permission: 'STAFF', action: 1 },
        loadComponent: () => import('./features/staff/staff.page').then(m => m.StaffPage)
      },
      {
        path: 'roles',
        canActivate: [permissionGuard],
        data: { permission: 'ROLES', action: 1 },
        loadComponent: () => import('./features/staff/roles-management.component').then(m => m.RolesManagementComponent)
      },
      {
        path: 'guests',
        canActivate: [permissionGuard],
        data: { permission: 'GUESTS', action: 1 },
        loadComponent: () => import('./features/guests/guests.page').then(m => m.GuestsPage)
      },
      {
        path: 'promotions',
        canActivate: [permissionGuard],
        data: { permission: 'PROMOTIONS', action: 1 },
        loadComponent: () => import('./features/promotions/promotions.page').then(m => m.PromotionsPageComponent)
      },
      {
        path: 'reviews',
        canActivate: [permissionGuard],
        data: { permission: 'REVIEWS', action: 1 },
        loadComponent: () => import('./features/reviews/reviews.page').then(m => m.ReviewsPage)
      },
      {
        path: 'plans',
        canActivate: [platformAdminGuard],
        loadComponent: () => import('./features/admin-plans/admin-plans.page').then(m => m.AdminPlansPage)
      },
      {
        path: 'contracts',
        canActivate: [platformAdminGuard],
        canDeactivate: [unsavedChangesGuard],
        loadComponent: () => import('./features/admin-contracts/admin-contracts.page').then(m => m.AdminContractsPage)
      },
      {
        path: 'platform-tenants',
        canActivate: [platformAdminGuard],
        loadComponent: () => import('./features/platform-tenants/platform-tenants.page').then(m => m.PlatformTenantsPage)
      },
      {
        path: 'tenants',
        redirectTo: 'platform-tenants',
        pathMatch: 'full'
      },
      {
        path: 'admin-banners',
        canActivate: [platformAdminGuard],
        loadComponent: () => import('./features/admin-banners/admin-banners.page').then(m => m.AdminBannersPage)
      },
      {
        path: 'banners',
        redirectTo: 'admin-banners',
        pathMatch: 'full'
      },
      {
        path: 'support-grants',
        canActivate: [permissionGuard],
        data: { permission: 'SUBSCRIPTIONS', action: 1 },
        loadComponent: () => import('./features/support-grants/support-grants.page').then(m => m.SupportGrantsPage)
      },
      {
        path: 'support-access',
        redirectTo: 'support-grants',
        pathMatch: 'full'
      }
    ]
  },

  // 7. Printable Documents Routes (Standalone sheets)
  {
    path: 'print/invoice/:id',
    loadComponent: () => import('./features/print/print-invoice.page').then(m => m.PrintInvoicePage)
  },
  {
    path: 'print/voucher/:token',
    loadComponent: () => import('./features/print/print-voucher.page').then(m => m.PrintVoucherPage)
  },
  {
    path: 'print/contract/:id',
    loadComponent: () => import('./features/print/print-contract.page').then(m => m.PrintContractPage)
  },

  // 8. Forbidden Route
  {
    path: 'forbidden',
    loadComponent: () => import('./features/forbidden/forbidden.page').then(m => m.ForbiddenPage)
  },

  // Fallback -> Về lại trang chủ Booking
  { path: '**', redirectTo: 'booking' }
];
