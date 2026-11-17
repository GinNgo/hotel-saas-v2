import '@angular/compiler';
import { JSDOM } from 'jsdom';

if (typeof document === 'undefined') {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: 'http://localhost',
  });
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    HTMLElement: dom.window.HTMLElement,
    Node: dom.window.Node,
  });
}

import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExploreSearchPageComponent } from './explore-search.page';
import { PublicBookingService } from '../../core/services/public-booking.service';
import { LocationService } from '../../core/services/location.service';
import {
  LandmarkDto,
  PublicPropertyDto,
  TouristZoneDto,
} from '../../core/models/public-booking.model';

try {
  TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
} catch {}

describe('ExploreSearchPageComponent (Geo-Search, Canonical Catalog & Split Map)', () => {
  let queryParamsSubject: BehaviorSubject<Record<string, string>>;
  let mockBookingService: {
    getProperties: ReturnType<typeof vi.fn>;
    getTouristZones: ReturnType<typeof vi.fn>;
    getLandmarks: ReturnType<typeof vi.fn>;
  };
  let mockLocationService: {
    reverseGeocode: ReturnType<typeof vi.fn>;
  };
  let mockRouter: {
    navigate: ReturnType<typeof vi.fn>;
  };

  const sampleProperties: PublicPropertyDto[] = [
    {
      propertyId: 'prop-no-coords',
      tenantId: 't-1',
      tenantBrandName: 'Brand One',
      name: 'Central Host Without Coords',
      slug: 'central-host-no-coords',
      propertyType: 'Hotel',
      addressLine: '10 Lê Lợi',
      wardName: 'Bến Thành',
      provinceCode: '79',
      provinceName: 'TP. Hồ Chí Minh',
      thumbnailUrl: '/images/saigon-riverside-tower.png',
      galleryUrls: [],
      allowedRentalTypes: ['Daily'],
      overnightCheckInTime: '21:00',
      overnightCheckOutTime: '10:00',
      cleaningBufferMinutes: 30,
      ratingAverage: 4.5,
      reviewCount: 12,
      nearbyLandmarks: [],
      startingPriceForSelectedMode: 850000,
      dailyStartingPrice: 850000,
      availableRoomTypes: [],
      distanceMeters: 350,
      distanceFormatted: 'Cách 350m',
    },
    {
      propertyId: 'prop-with-coords',
      tenantId: 't-2',
      tenantBrandName: 'Riverside Group',
      name: 'An Lâm Saigon Luxury',
      slug: 'an-lam-saigon',
      propertyType: 'Resort',
      addressLine: '21 Nguyễn Văn Linh',
      wardName: 'Thảo Điền',
      provinceCode: '79',
      provinceName: 'TP. Hồ Chí Minh',
      latitude: 10.8035,
      longitude: 106.7351,
      thumbnailUrl: '/images/saigon-riverside-tower.png',
      galleryUrls: [],
      allowedRentalTypes: ['Daily', 'Hourly'],
      overnightCheckInTime: '21:00',
      overnightCheckOutTime: '10:00',
      cleaningBufferMinutes: 30,
      ratingAverage: 4.9,
      reviewCount: 84,
      nearbyLandmarks: [],
      startingPriceForSelectedMode: 1450000,
      dailyStartingPrice: 1450000,
      availableRoomTypes: [],
      distanceMeters: 2400,
      isExpandedNearbySuggestion: true,
    },
  ];

  beforeEach(async () => {
    TestBed.resetTestingModule();
    queryParamsSubject = new BehaviorSubject<Record<string, string>>({});

    mockBookingService = {
      getProperties: vi.fn().mockReturnValue(of(sampleProperties)),
      getTouristZones: vi.fn().mockReturnValue(
        of([
          {
            slug: 'quan-1-tphcm',
            name: 'TP. Hồ Chí Minh - Trung Tâm Quận 1',
            provinceCode: '79',
            provinceName: 'TP. Hồ Chí Minh',
            landmarksCount: 6,
            latitude: 10.7769,
            longitude: 106.7009,
          } satisfies TouristZoneDto,
        ])
      ),
      getLandmarks: vi.fn().mockReturnValue(
        of([
          {
            slug: 'cho-ben-thanh',
            name: 'Chợ Bến Thành',
            touristZoneSlug: 'quan-1-tphcm',
            provinceCode: '79',
            latitude: 10.7725,
            longitude: 106.698,
          } satisfies LandmarkDto,
        ])
      ),
    };

    mockLocationService = {
      reverseGeocode: vi.fn().mockReturnValue(
        of({
          provinceCode: '79',
          provinceName: 'TP. Hồ Chí Minh',
          nearestLandmarkSlug: 'cho-ben-thanh',
          nearestLandmarkName: 'Chợ Bến Thành',
          distanceMeters: 250,
          distanceFormatted: '250m',
          displayLabel: 'Gần Chợ Bến Thành, TP. Hồ Chí Minh (250m)',
        })
      ),
    };

    mockRouter = {
      navigate: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [ExploreSearchPageComponent],
      providers: [
        { provide: PublicBookingService, useValue: mockBookingService },
        { provide: LocationService, useValue: mockLocationService },
        { provide: Router, useValue: mockRouter },
        {
          provide: ActivatedRoute,
          useValue: { queryParams: queryParamsSubject.asObservable() },
        },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('syncs queryParams, defaults sortBy to distance_asc when GPS coordinates are provided, and resolves GPS banner label', () => {
    queryParamsSubject.next({
      userLatitude: '10.7725',
      userLongitude: '106.6980',
      maxDistanceMeters: '5000',
      minPrice: '500000',
      maxPrice: '2000000',
    });

    const fixture = TestBed.createComponent(ExploreSearchPageComponent);
    fixture.detectChanges();
    const comp = fixture.componentInstance;

    expect(comp.sortBy()).toBe('distance_asc');
    expect(comp.maxDistanceMeters()).toBe(5000);
    expect(comp.minPrice()).toBe(500000);
    expect(comp.maxPrice()).toBe(2000000);
    expect(comp.selectedPriceRangeKey()).toBe('custom');
    expect(mockLocationService.reverseGeocode).toHaveBeenCalledWith(10.7725, 106.698);
    expect(comp.activeGeoLabel()).toBe('📍 Gần Chợ Bến Thành, TP. Hồ Chí Minh (250m)');
    expect(comp.pageTitle()).toContain('Chỗ nghỉ gần Gần Chợ Bến Thành');

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('[data-testid="active-gps-banner"]')).not.toBeNull();
  });

  it('builds canonical destinationSuggestions without corrupted diacritic slugs and avoids invalid TouristZone slugs', () => {
    const fixture = TestBed.createComponent(ExploreSearchPageComponent);
    fixture.detectChanges();
    const suggestions = fixture.componentInstance.destinationSuggestions();

    const slugs = suggestions.map(s => s.slug);
    expect(slugs).not.toContain('h--ho-n-ki-m');
    expect(slugs).toContain('ho-hoan-kiem');
    expect(slugs).toContain('ha-noi-pho-co');
    expect(slugs).toContain('da-lat');

    // Ninh Bình has no dedicated backend tourist zone, so its zone highlight must be emitted as Province
    const ninhBinhZone = suggestions.find(s => s.provinceCode === '37' && s.id.startsWith('prov-zone-'));
    expect(ninhBinhZone).toBeDefined();
    expect(ninhBinhZone?.type).toBe('Province');

    // Loaded properties are merged as Property suggestions with coordinates
    const propSuggestion = suggestions.find(
      s => s.type === 'Property' && s.slug === 'an-lam-saigon'
    );
    expect(propSuggestion).toBeDefined();
    expect(propSuggestion?.latitude).toBe(10.8035);
    expect(propSuggestion?.longitude).toBe(106.7351);
  });

  it('renders distance badges and expanded nearby badges in both List View and Map Split View', () => {
    const fixture = TestBed.createComponent(ExploreSearchPageComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;

    const listDistBadges = el.querySelectorAll('[data-testid="property-distance-badge"]');
    expect(listDistBadges.length).toBe(2);
    expect(listDistBadges[0].textContent).toContain('Cách 350m');
    expect(listDistBadges[1].textContent).toContain('Cách 2.4km');
    expect(el.querySelector('[data-testid="expanded-nearby-badge"]')?.textContent).toContain(
      'Gợi ý mở rộng lân cận'
    );

    // Switch to Map Split View
    fixture.componentInstance.switchViewMode('map');
    fixture.detectChanges();

    const mapDistBadges = el.querySelectorAll('[data-testid="map-property-distance-badge"]');
    expect(mapDistBadges.length).toBe(2);
    expect(mapDistBadges[0].textContent).toContain('Cách 350m');
    expect(mapDistBadges[1].textContent).toContain('Cách 2.4km');
  });

  it('auto-selects the first property with coordinates when entering map view or loading results in map view', () => {
    const fixture = TestBed.createComponent(ExploreSearchPageComponent);
    const comp = fixture.componentInstance;
    comp.viewMode.set('map');
    fixture.detectChanges();

    // First property has no lat/lng, so second property (with coordinates) should be auto-selected
    expect(comp.selectedMapProperty()?.propertyId).toBe('prop-with-coords');
  });
});
