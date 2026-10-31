import { JSDOM } from 'jsdom';

if (typeof document === 'undefined') {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: 'http://localhost'
  });
  const win = dom.window;
  (globalThis as any).window = win;
  (globalThis as any).document = win.document;
  (globalThis as any).HTMLElement = win.HTMLElement;
  (globalThis as any).customElements = win.customElements;
  (globalThis as any).Node = win.Node;
  (globalThis as any).MutationObserver = win.MutationObserver;
}

import '@angular/compiler';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { AuditLogService } from './audit-log.service';
import { environment } from '../../../environments/environment';

try {
  TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
} catch {
  // Already initialized
}

describe('AuditLogService Unit Tests', () => {
  let service: AuditLogService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [AuditLogService]
    });
    service = TestBed.inject(AuditLogService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('1. should query audit logs with query params', () => {
    service.getAuditLogs({
      action: 'Update',
      entityName: 'RoomTypeRate',
      propertyId: 'prop-123',
      page: 1,
      pageSize: 20
    }).subscribe(res => {
      expect(res.success).toBe(true);
      expect(res.data?.items.length).toBe(1);
    });

    const req = httpMock.expectOne(req =>
      req.url === `${environment.apiUrl}/audit-logs` &&
      req.params.get('action') === 'Update' &&
      req.params.get('entityName') === 'RoomTypeRate' &&
      req.params.get('propertyId') === 'prop-123' &&
      req.params.get('page') === '1' &&
      req.params.get('pageSize') === '20'
    );
    expect(req.request.method).toBe('GET');

    req.flush({
      success: true,
      data: {
        items: [{ id: '1', action: 'Update', entityName: 'RoomTypeRate' }],
        totalCount: 1,
        page: 1,
        pageSize: 20,
        totalPages: 1,
        hasPreviousPage: false,
        hasNextPage: false
      },
      message: null,
      timestamp: new Date().toISOString()
    });
  });

  it('2. should fetch audit log detail by ID and include propertyId param', () => {
    service.getAuditLogById('log-123', 'prop-456').subscribe(res => {
      expect(res.success).toBe(true);
      expect(res.data?.id).toBe('log-123');
    });

    const req = httpMock.expectOne(req =>
      req.url === `${environment.apiUrl}/audit-logs/log-123` &&
      req.params.get('propertyId') === 'prop-456'
    );
    expect(req.request.method).toBe('GET');

    req.flush({
      success: true,
      data: {
        id: 'log-123',
        action: 'Update',
        entityName: 'RoomTypeRate',
        changes: [{ fieldName: 'NightlyPrice', oldValue: '850000', newValue: '950000' }]
      },
      message: null,
      timestamp: new Date().toISOString()
    });
  });
});

