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
import { TokenStorageService } from './token-storage.service';
import { environment } from '../../../environments/environment';

try {
  TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
} catch {
  // Already initialized
}

describe('AuditLogService Unit Tests', () => {
  let service: AuditLogService;
  let httpMock: HttpTestingController;
  let mockGlobalRole: string | null = 'Owner';

  beforeEach(() => {
    mockGlobalRole = 'Owner';
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        AuditLogService,
        {
          provide: TokenStorageService,
          useValue: {
            getDecodedToken: () => (mockGlobalRole ? { globalRole: mockGlobalRole } : null)
          }
        }
      ]
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

  it('3. should forward tenantId, propertyId, and userId query params cleanly', () => {
    service.getAuditLogs({
      tenantId: 'tenant-001',
      propertyId: 'prop-002',
      userId: 'user-003',
      search: 'nguyen van a',
      page: 1,
      pageSize: 20
    }).subscribe(res => {
      expect(res.success).toBe(true);
    });

    const req = httpMock.expectOne(r =>
      r.url === `${environment.apiUrl}/audit-logs` &&
      r.params.get('tenantId') === 'tenant-001' &&
      r.params.get('propertyId') === 'prop-002' &&
      r.params.get('userId') === 'user-003' &&
      r.params.get('search') === 'nguyen van a'
    );
    expect(req.request.method).toBe('GET');

    req.flush({
      success: true,
      data: {
        items: [],
        totalCount: 0,
        page: 1,
        pageSize: 20,
        totalPages: 0,
        hasPreviousPage: false,
        hasNextPage: false
      },
      message: null,
      timestamp: new Date().toISOString()
    });
  });

  it('4. should route SuperAdmin requests to /platform/audit-logs with tenantId filter', () => {
    mockGlobalRole = 'SuperAdmin';
    service.getAuditLogs({
      tenantId: 'tenant-sa-99',
      action: 'LoginFailed',
      page: 1,
      pageSize: 20
    }).subscribe(res => {
      expect(res.success).toBe(true);
    });

    const req = httpMock.expectOne(r =>
      r.url === `${environment.apiUrl}/platform/audit-logs` &&
      r.params.get('tenantId') === 'tenant-sa-99' &&
      r.params.get('action') === 'LoginFailed'
    );
    expect(req.request.method).toBe('GET');

    req.flush({
      success: true,
      data: {
        items: [],
        totalCount: 0,
        page: 1,
        pageSize: 20,
        totalPages: 0,
        hasPreviousPage: false,
        hasNextPage: false
      },
      message: null,
      timestamp: new Date().toISOString()
    });
  });
});

