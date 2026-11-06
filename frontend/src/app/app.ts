import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Toast } from 'primeng/toast';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { AuthService } from './core/services/auth.service';
import { ThemeService } from './core/services/theme.service';
import { LoadingOverlayComponent } from './shared/components/loading-overlay/loading-overlay.component';

/**
 * Root Component của ứng dụng Hotel SaaS.
 * Bao gồm Toast, ConfirmDialog, ThemeService và Centralized Loading Overlay toàn cục.
 */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, Toast, ConfirmDialog, LoadingOverlayComponent],
  template: `
    <app-loading-overlay />
    <p-toast position="top-right" />
    <p-confirmdialog />
    <router-outlet />
  `
})
export class App implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly themeService = inject(ThemeService);

  ngOnInit(): void {
    this.authService.initializeUser();
  }
}
