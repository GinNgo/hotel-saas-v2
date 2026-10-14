import '@angular/compiler';
import { describe, it, expect, vi } from 'vitest';
import { Injector, runInInjectionContext } from '@angular/core';
import { App } from './app';
import { AuthService } from './core/services/auth.service';

describe('App', () => {
  it('should create the app and initialize user context', () => {
    const mockAuthService = {
      initializeUser: vi.fn()
    };

    const injector = Injector.create({
      providers: [
        { provide: AuthService, useValue: mockAuthService }
      ]
    });

    const app = runInInjectionContext(injector, () => new App());
    expect(app).toBeTruthy();

    app.ngOnInit();
    expect(mockAuthService.initializeUser).toHaveBeenCalled();
  });
});
