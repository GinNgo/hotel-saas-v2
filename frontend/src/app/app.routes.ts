import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { permissionGuard } from './core/guards/permission.guard';

export const routes: Routes = [
  // 1. Root URL -> Chuyển hướng trực tiếp vào Cổng Đặt phòng Công khai & Trang chủ Hệ thống
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'booking'
  },

  // 2. Auth Routes có prefix /auth
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
        path: 'partner-register',
        loadComponent: () => import('./features/auth/partner-register/partner-register.page').then(m => m.PartnerRegisterPage)
      }
    ]
  },

  // 3. Auth Routes trực tiếp (/login, /register, /partner-register)
  {
    path: '',
    loadComponent: () => import('./layouts/auth-layout/auth-layout').then(m => m.AuthLayoutComponent),
    children: [
      {
        path: 'login',
        loadComponent: () => import('./features/auth/login/login.page').then(m => m.LoginPage)
      },
      {
        path: 'register',
        loadComponent: () => import('./features/auth/register/register.page').then(m => m.RegisterPage)
      },
      {
        path: 'partner-register',
        loadComponent: () => import('./features/auth/partner-register/partner-register.page').then(m => m.PartnerRegisterPage)
      }
    ]
  },

  // 4. Public Booking & Guest Portal (Trang chủ khách sạn)
  {
    path: 'booking',
    loadComponent: () => import('./features/public-booking/booking.page').then(m => m.BookingPage)
  },
  {
    path: 'booking/hold/:token',
    loadComponent: () => import('./features/public-booking/booking-hold.page').then(m => m.BookingHoldPage)
  },
  {
    path: 'booking/lookup',
    loadComponent: () => import('./features/public-booking/booking-status.page').then(m => m.BookingStatusPage)
  },
  {
    path: 'booking/status/:token',
    loadComponent: () => import('./features/public-booking/booking-status.page').then(m => m.BookingStatusPage)
  },

  // 5. Admin Management Routes (Hỗ trợ tiền tố /admin/...)
  {
    path: 'admin',
    canActivate: [authGuard],
    loadComponent: () => import('./layouts/admin-layout/admin-layout').then(m => m.AdminLayoutComponent),
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard.page').then(m => m.DashboardPage)
      },
      {
        path: 'properties',
        canActivate: [permissionGuard],
        data: { permission: 'PROPERTIES', action: 1 },
        loadComponent: () => import('./features/properties/properties.page').then(m => m.PropertiesPage)
      },
      {
        path: 'rooms',
        canActivate: [permissionGuard],
        data: { permission: 'ROOMS', action: 1 },
        loadComponent: () => import('./features/rooms/rooms.page').then(m => m.RoomsPage)
      },
      { path: 'room-types', redirectTo: 'dashboard', pathMatch: 'full' },

      // Phân hệ Housekeeping do Trần Trọng Tân phụ trách (tích hợp qua branch feature/tan-housekeeping)
      { path: 'housekeeping', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'policies',
        canActivate: [permissionGuard],
        data: { permission: 'PROPERTIES', action: 1 },
        loadComponent: () => import('./features/policies/policies.page').then(m => m.PoliciesPage)
      },
      {
        path: 'rates',
        canActivate: [permissionGuard],
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
        loadComponent: () => import('./features/reports/reports.page').then(m => m.ReportsPage)
      },
      {
        path: 'subscriptions',
        loadComponent: () => import('./features/subscriptions/subscriptions.page').then(m => m.SubscriptionsPage)
      }
    ]
  },

  // 6. Admin Management Routes trực tiếp (/dashboard, /rooms, /housekeeping...)
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
        data: { permission: 'PROPERTIES', action: 1 },
        loadComponent: () => import('./features/properties/properties.page').then(m => m.PropertiesPage)
      },
      {
        path: 'rooms',
        canActivate: [permissionGuard],
        data: { permission: 'ROOMS', action: 1 },
        loadComponent: () => import('./features/rooms/rooms.page').then(m => m.RoomsPage)
      },
      { path: 'room-types', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'housekeeping', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'policies',
        canActivate: [permissionGuard],
        data: { permission: 'PROPERTIES', action: 1 },
        loadComponent: () => import('./features/policies/policies.page').then(m => m.PoliciesPage)
      },
      {
        path: 'rates',
        canActivate: [permissionGuard],
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
        loadComponent: () => import('./features/reports/reports.page').then(m => m.ReportsPage)
      },
      {
        path: 'subscriptions',
        loadComponent: () => import('./features/subscriptions/subscriptions.page').then(m => m.SubscriptionsPage)
      }
    ]
  },

  // 7. Forbidden Route
  {
    path: 'forbidden',
    loadComponent: () => import('./features/forbidden/forbidden.page').then(m => m.ForbiddenPage)
  },

  // Fallback -> Về lại trang chủ Booking
  { path: '**', redirectTo: 'booking' }
];
