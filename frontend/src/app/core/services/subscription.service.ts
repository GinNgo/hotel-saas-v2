import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  TenantSubscriptionDto,
  SubscriptionPackageDto,
  UpgradeSubscriptionRequest,
  SubscriptionUpgradeInitiationDto,
  ConfirmSubscriptionPaymentResultDto
} from '../models/subscription.model';

interface ApiEnvelope<T> {
  data?: T;
}

function unwrapPayload<T>(res: ApiEnvelope<T> | T): T {
  if (res && typeof res === 'object' && 'data' in res && res.data !== undefined) {
    return res.data;
  }
  return res as T;
}

@Injectable({ providedIn: 'root' })
export class SubscriptionService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/subscriptions`;

  /**
   * Retrieves active subscription details, quotas, pending payment, and payment history for the current tenant.
   */
  getCurrentSubscription(): Observable<TenantSubscriptionDto> {
    return this.http
      .get<ApiEnvelope<TenantSubscriptionDto> | TenantSubscriptionDto>(`${this.apiUrl}/current`)
      .pipe(map(res => unwrapPayload(res)));
  }

  /**
   * Retrieves active SaaS subscription packages catalog sourced live from SubscriptionPlans.
   */
  getAvailablePlans(): Observable<SubscriptionPackageDto[]> {
    return this.http
      .get<ApiEnvelope<SubscriptionPackageDto[]> | SubscriptionPackageDto[]>(`${this.apiUrl}/plans`)
      .pipe(map(res => unwrapPayload(res)));
  }

  /**
   * Initiates a subscription upgrade by creating a Pending SubscriptionPayment and optional VNPay checkout URL.
   */
  upgradeSubscription(
    targetTier: number,
    billingCycle: 0 | 1 = 0,
    returnUrl?: string
  ): Observable<SubscriptionUpgradeInitiationDto> {
    const body: UpgradeSubscriptionRequest = { targetTier, billingCycle, returnUrl };
    return this.http
      .post<ApiEnvelope<SubscriptionUpgradeInitiationDto> | SubscriptionUpgradeInitiationDto>(
        `${this.apiUrl}/upgrade`,
        body
      )
      .pipe(map(res => unwrapPayload(res)));
  }

  /**
   * Confirms a pending subscription payment (e.g., sandbox/manual confirmation) and upgrades the tenant subscription.
   */
  confirmPayment(paymentId: string, gatewayTransactionNo?: string): Observable<ConfirmSubscriptionPaymentResultDto> {
    return this.http
      .post<ApiEnvelope<ConfirmSubscriptionPaymentResultDto> | ConfirmSubscriptionPaymentResultDto>(
        `${this.apiUrl}/payments/${paymentId}/confirm`,
        { gatewayTransactionNo }
      )
      .pipe(map(res => unwrapPayload(res)));
  }

  /**
   * Verifies VNPay browser return query parameters and activates the upgraded tier.
   */
  verifyVnpayReturn(vnpayParams: Record<string, string>): Observable<ConfirmSubscriptionPaymentResultDto> {
    return this.http
      .post<ApiEnvelope<ConfirmSubscriptionPaymentResultDto> | ConfirmSubscriptionPaymentResultDto>(
        `${this.apiUrl}/vnpay-return`,
        vnpayParams
      )
      .pipe(map(res => unwrapPayload(res)));
  }
}
