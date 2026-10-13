import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  TenantSubscriptionDto,
  SubscriptionPackageDto,
  UpgradeSubscriptionRequest
} from '../models/subscription.model';

@Injectable({ providedIn: 'root' })
export class SubscriptionService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/subscriptions`;

  /**
   * Retrieves active subscription details and quota status for the current tenant.
   */
  getCurrentSubscription(): Observable<TenantSubscriptionDto> {
    return this.http.get<any>(`${this.apiUrl}/current`).pipe(
      map(res => (res.data ? res.data : res) as TenantSubscriptionDto)
    );
  }

  /**
   * Retrieves standard subscription packages catalog.
   */
  getAvailablePlans(): Observable<SubscriptionPackageDto[]> {
    return this.http.get<any>(`${this.apiUrl}/plans`).pipe(
      map(res => (res.data ? res.data : res) as SubscriptionPackageDto[])
    );
  }

  /**
   * Upgrades the tenant to a higher subscription tier.
   */
  upgradeSubscription(targetTier: number): Observable<TenantSubscriptionDto> {
    const body: UpgradeSubscriptionRequest = { targetTier };
    return this.http.post<any>(`${this.apiUrl}/upgrade`, body).pipe(
      map(res => (res.data ? res.data : res) as TenantSubscriptionDto)
    );
  }
}
