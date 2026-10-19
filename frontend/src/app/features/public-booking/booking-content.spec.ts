import '@angular/compiler';
import { CommonModule } from '@angular/common';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { provideRouter, RouterLink } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { BookingPageComponent } from './booking.page';
import { PublicBookingService } from '../../core/services/public-booking.service';
import { CuratedBentoGridComponent } from './components/curated-bento-grid/curated-bento-grid.component';

describe('Discovery content and category controls', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [BookingPageComponent],
      providers: [provideRouter([]), { provide: PublicBookingService, useValue: { getProperties: () => of([]) } }],
    }).overrideComponent(BookingPageComponent, {
      set: { imports: [CommonModule, FormsModule, RouterLink, CuratedBentoGridComponent], schemas: [NO_ERRORS_SCHEMA] },
    });
  });

  it('does not promise inventory, popularity or smart-lock functionality without evidence', () => {
    const fixture = TestBed.createComponent(BookingPageComponent);
    fixture.detectChanges();
    const content = (fixture.nativeElement as HTMLElement).textContent;
    for (const claim of ['500+', 'Smart Lock', 'Bãi tắm riêng', 'hồ bơi vô cực', 'được yêu thích nhất', 'Tìm kiếm thịnh hành']) {
      expect(content).not.toContain(claim);
    }
  });

  it('offers native category buttons wired to supported property filters', () => {
    const fixture = TestBed.createComponent(BookingPageComponent);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    const category = element.querySelector<HTMLButtonElement>('button[aria-label="Khám phá Homestay"]');
    expect(category).not.toBeNull();
    category!.click();
    expect(fixture.componentInstance.searchFilter().propertyTypes).toEqual(['Homestay']);
  });
});
