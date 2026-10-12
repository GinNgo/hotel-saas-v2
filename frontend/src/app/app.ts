import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Toast } from 'primeng/toast';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { AuthService } from './core/services/auth.service';

/**
 * Root Component của ứng dụng Hotel SaaS.
 * Bao gồm Toast và ConfirmDialog toàn cục của PrimeNG.
 */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, Toast, ConfirmDialog],
  template: `
    <p-toast position="top-right" />
    <p-confirmdialog />
    <router-outlet />
  `
})
export class App implements OnInit {
  private readonly authService = inject(AuthService);

  ngOnInit(): void {
    this.authService.initializeUser();
  }
}
