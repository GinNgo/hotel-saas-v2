import '@angular/compiler';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { PhotoGalleryModalComponent } from './photo-gallery-modal.component';

describe('Photo gallery modal', () => {
  const photos = [{ url: '/one.jpg', title: 'Một' }, { url: '/two.jpg', title: 'Hai' }];
  beforeEach(() => TestBed.resetTestingModule());

  it('updates the active image when async photos change without changing the index', () => {
    const component = TestBed.createComponent(PhotoGalleryModalComponent).componentInstance;
    expect(component.currentPhoto()).toBeNull();
    component.photos = photos;
    expect(component.currentPhoto()?.url).toBe('/one.jpg');
    component.photos = [{ url: '/new.jpg', title: 'Mới' }];
    expect(component.currentPhoto()?.url).toBe('/new.jpg');
  });

  it('normalizes indexes after shrinking photos and rejects invalid navigation', () => {
    const component = TestBed.createComponent(PhotoGalleryModalComponent).componentInstance;
    component.isOpen = true;
    component.photos = photos;
    component.selectPhoto(1);
    component.photos = [photos[0]];
    expect(component.currentIndex()).toBe(0);
    component.selectPhoto(-1);
    component.selectPhoto(Number.NaN);
    expect(component.currentIndex()).toBe(0);
  });

  it('does not navigate or emit while closed', () => {
    const component = TestBed.createComponent(PhotoGalleryModalComponent).componentInstance;
    component.photos = photos;
    const closed = vi.spyOn(component.close, 'emit');
    component.nextPhoto();
    component.selectPhoto(1);
    component.closeModal();
    expect(component.currentIndex()).toBe(0);
    expect(closed).not.toHaveBeenCalled();
  });

  it('renders an honest empty state and exposes selected thumbnail semantics', () => {
    const fixture = TestBed.createComponent(PhotoGalleryModalComponent);
    fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.textContent).toContain('Chưa có ảnh');
    expect(element.textContent).not.toContain('Ảnh 1 / 0');
    fixture.componentRef.setInput('photos', photos);
    fixture.detectChanges();
    expect(element.querySelector('button[aria-current="true"]')?.getAttribute('aria-label')).toContain('Một');
  });

  it('handles arrows and Escape only inside the open dialog', () => {
    const fixture = TestBed.createComponent(PhotoGalleryModalComponent);
    fixture.componentRef.setInput('photos', photos);
    fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges();
    const dialog: HTMLElement = fixture.nativeElement.querySelector('[role="dialog"]');
    const closed = vi.spyOn(fixture.componentInstance.close, 'emit');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(fixture.componentInstance.currentIndex()).toBe(0);
    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(fixture.componentInstance.currentIndex()).toBe(1);
    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(fixture.componentInstance.currentIndex()).toBe(0);
    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(closed).toHaveBeenCalledOnce();
  });

  it('shows a failed-image state without replacing it with a stock photo', () => {
    const fixture = TestBed.createComponent(PhotoGalleryModalComponent);
    fixture.componentRef.setInput('photos', photos);
    fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    element.querySelector('img[loading="eager"]')?.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(element.textContent).toContain('Không tải được ảnh');
    expect(element.querySelector('img[loading="eager"]')).toBeNull();
    fixture.componentInstance.nextPhoto();
    fixture.detectChanges();
    expect(element.querySelector('img[loading="eager"]')?.getAttribute('src')).toBe('/two.jpg');
  });
});
