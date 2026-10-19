import '@angular/compiler';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { RoomDetailModalComponent } from './room-detail-modal.component';
import { PublicRoomTypeAvailabilityDto } from '../../../core/models/public-booking.model';

describe('Room discovery modal', () => {
  const room: PublicRoomTypeAvailabilityDto = {
    roomTypeId: 'room', name: 'Phòng thử nghiệm', maxGuests: 0,
    availableRoomsCount: 0, availableRooms: 0, amenities: [], images: [], calculatedQuoteTotal: 0,
  };

  beforeEach(() => TestBed.resetTestingModule());

  it('renders missing data without invented photos, stock or policies', () => {
    const fixture = TestBed.createComponent(RoomDetailModalComponent);
    fixture.componentRef.setInput('isOpen', true);
    fixture.componentRef.setInput('roomType', room);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('img')).toBeNull();
    expect(element.textContent).toContain('Chưa công bố');
    expect(element.textContent).toContain('Kiểm tra lịch trống ở bước đặt phòng');
    for (const claim of ['Hết phòng', 'King/Queen', '32 m²', 'Thành phố & Vườn', '15 phút', '24 giờ', '14:00']) {
      expect(element.textContent).not.toContain(claim);
    }
    expect(element.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe(room.name);
  });

  it('does not emit selection while closed or without a room identity', () => {
    const component = TestBed.createComponent(RoomDetailModalComponent).componentInstance;
    const selected = vi.spyOn(component.select, 'emit');
    component.roomType = room;
    component.selectRoom();
    component.isOpen = true;
    component.roomType = { ...room, roomTypeId: '' };
    component.selectRoom();
    expect(selected).not.toHaveBeenCalled();
  });

  it('continues to server validation without claiming discovery stock is confirmed', () => {
    const component = TestBed.createComponent(RoomDetailModalComponent).componentInstance;
    const selected = vi.spyOn(component.select, 'emit');
    component.isOpen = true;
    component.roomType = room;
    component.selectRoom();
    expect(selected).toHaveBeenCalledWith(room);
  });

  it('closes on Escape and does not emit gallery actions while closed', () => {
    const fixture = TestBed.createComponent(RoomDetailModalComponent);
    fixture.componentRef.setInput('isOpen', true);
    fixture.componentRef.setInput('roomType', room);
    fixture.detectChanges();
    const closed = vi.spyOn(fixture.componentInstance.close, 'emit');
    const gallery = vi.spyOn(fixture.componentInstance.viewGallery, 'emit');
    fixture.nativeElement.querySelector('[role="dialog"]').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(closed).toHaveBeenCalledOnce();
    fixture.componentRef.setInput('isOpen', false);
    fixture.componentInstance.openGalleryModal();
    expect(gallery).not.toHaveBeenCalled();
  });

  it('keeps published photos and amenities', () => {
    const fixture = TestBed.createComponent(RoomDetailModalComponent);
    fixture.componentRef.setInput('isOpen', true);
    fixture.componentRef.setInput('roomType', { ...room, images: ['/room.jpg'], amenities: ['Wifi'] });
    fixture.componentRef.setInput('displayPrice', 150000);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('img')?.getAttribute('src')).toBe('/room.jpg');
    expect(element.textContent).toContain('Wifi');
    expect(element.textContent).not.toContain('Chưa công bố giá');
  });
});
