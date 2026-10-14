import '@angular/compiler';
import { describe, it, expect, beforeEach } from 'vitest';
import { Injector, runInInjectionContext } from '@angular/core';
import { GuestProfilePageComponent } from './guest-profile.page';

describe('GuestProfilePageComponent (Guest Loyalty Portal)', () => {
  let component: GuestProfilePageComponent;

  beforeEach(() => {
    const injector = Injector.create({
      providers: []
    });

    component = runInInjectionContext(injector, () => new GuestProfilePageComponent());
    component.ngOnInit();
  });

  it('should initialize and load demo guest portal data', () => {
    expect(component).toBeTruthy();
    expect(component.memberships().length).toBeGreaterThan(0);
    expect(component.pointLedger().length).toBeGreaterThan(0);
    expect(component.invoices().length).toBeGreaterThan(0);
  });

  it('should compute primaryMembership and totalAvailablePoints accurately', () => {
    const primary = component.primaryMembership();
    expect(primary).toBeTruthy();
    expect(primary?.tier).toBe('Gold');

    const totalPoints = component.totalAvailablePoints();
    const manualSum = component.memberships().reduce((acc, m) => acc + m.pointsBalance, 0);
    expect(totalPoints).toBe(manualSum);
  });

  it('should compute totalRefundedPoints from Refunded transactions in ledger', () => {
    const refundedPoints = component.totalRefundedPoints();
    expect(refundedPoints).toBe(60);
  });

  it('should filter pointLedger by transaction type', () => {
    component.selectedPointFilter.set('ALL');
    expect(component.filteredPointLedger().length).toBe(component.pointLedger().length);

    component.selectedPointFilter.set('Earned');
    expect(component.filteredPointLedger().every(tx => tx.type === 'Earned')).toBe(true);

    component.selectedPointFilter.set('Redeemed');
    expect(component.filteredPointLedger().every(tx => tx.type === 'Redeemed')).toBe(true);

    component.selectedPointFilter.set('Refunded');
    expect(component.filteredPointLedger().every(tx => tx.type === 'Refunded')).toBe(true);
  });

  it('should enroll new property membership, award 50 bonus points, and record Bonus transaction', () => {
    const initialMembershipsCount = component.memberships().length;
    const initialLedgerCount = component.pointLedger().length;
    const available = component.availablePropertiesToJoin();
    expect(available.length).toBeGreaterThan(0);

    const target = available[0];
    component.enrollPropertyMembership(target);

    // Membership count increased by 1
    expect(component.memberships().length).toBe(initialMembershipsCount + 1);
    const enrolled = component.memberships().find(m => m.tenantId === target.tenantId);
    expect(enrolled).toBeDefined();
    expect(enrolled?.pointsBalance).toBe(50);
    expect(enrolled?.tier).toBe('Silver');

    // Available list removed joined property
    expect(component.availablePropertiesToJoin().some(p => p.propertyId === target.propertyId)).toBe(false);

    // Point ledger prepended with Bonus transaction
    expect(component.pointLedger().length).toBe(initialLedgerCount + 1);
    const topTx = component.pointLedger()[0];
    expect(topTx.type).toBe('Bonus');
    expect(topTx.pointsDelta).toBe(50);
  });

  it('should return human-readable labels for invoice status and rental type', () => {
    expect(component.getInvoiceStatusLabel('Paid')).toBe('Đã thanh toán');
    expect(component.getInvoiceStatusLabel('Refunded')).toBe('Đã hoàn tiền & hoàn điểm');
    expect(component.getInvoiceStatusLabel('Cancelled')).toBe('Đã hủy');

    expect(component.getRentalTypeLabel('Hourly')).toBe('Thuê theo giờ');
    expect(component.getRentalTypeLabel('Overnight')).toBe('Qua đêm');
    expect(component.getRentalTypeLabel('Daily')).toBe('Theo ngày');
  });

  it('should switch active navigation tab', () => {
    component.activeTab.set('loyalty_wallet');
    expect(component.activeTab()).toBe('loyalty_wallet');

    component.activeTab.set('settings');
    expect(component.activeTab()).toBe('settings');
  });
});
