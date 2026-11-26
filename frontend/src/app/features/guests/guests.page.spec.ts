import '@angular/compiler';
import { DestroyRef, Injector, runInInjectionContext } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';
import { of, Subject } from 'rxjs';
import { GuestsPage } from './guests.page';
import { GuestService } from '../../core/services/guest.service';
import { AlertService } from '../../core/services/alert.service';
import { GuestDetailDto, GuestDirectoryItemDto, UpdateGuestNotesRequest } from '../../core/models/guest.model';

describe('GuestsPage CRM — Phone-less Guests, VIP Override & Blacklist', () => {
  function setup() {
    const phoneLessGuest: GuestDirectoryItemDto = {
      id: '11111111-1111-1111-1111-111111111111',
      guestKey: 'email:nophone@example.test',
      vipOverride: null,
      fullName: 'Khách Không SĐT',
      email: 'nophone@example.test',
      phoneNumber: '',
      totalBookings: 1,
      completedStays: 1,
      cancelledBookings: 0,
      totalSpent: 1_200_000,
      loyaltyTier: 'Standard',
      pointsBalance: 0,
      isVip: false,
      isBlacklisted: false,
      notes: 'Ghi chú cũ'
    };

    const historyResponse: GuestDetailDto = {
      profile: { ...phoneLessGuest, vipOverride: true, isVip: true, isBlacklisted: true, notes: 'Ghi chú từ lịch sử' },
      bookings: []
    };

    const savedPayloads: UpdateGuestNotesRequest[] = [];
    const guestService = {
      getGuestDirectory: vi.fn(() =>
        of({
          items: [phoneLessGuest],
          totalCount: 1,
          page: 1,
          pageSize: 20,
          totalPages: 1,
          hasPreviousPage: false,
          hasNextPage: false
        })
      ),
      getGuestHistory: vi.fn(() => of(historyResponse)),
      updateGuestNotes: vi.fn((payload: UpdateGuestNotesRequest) => {
        savedPayloads.push(payload);
        return of(true);
      })
    };

    const alertService = {
      toastSuccess: vi.fn(),
      toastError: vi.fn()
    };

    const destroyRef: DestroyRef = {
      destroyed: false,
      onDestroy: () => () => {}
    };

    const injector = Injector.create({
      providers: [
        { provide: GuestService, useValue: guestService },
        { provide: AlertService, useValue: alertService },
        { provide: DestroyRef, useValue: destroyRef }
      ]
    });

    const page = runInInjectionContext(injector, () => new GuestsPage());
    return { page, phoneLessGuest, guestService, alertService, savedPayloads };
  }

  it('loads phone-less guest using guestKey and opens history with guestKey', () => {
    const { page, phoneLessGuest, guestService } = setup();
    page.ngOnInit();

    expect(page.guestList()).toHaveLength(1);
    expect(page.guestList()[0].guestKey).toBe('email:nophone@example.test');
    expect(page.guestList()[0].phoneNumber).toBe('');

    page.viewGuestDetails(phoneLessGuest);

    expect(guestService.getGuestHistory).toHaveBeenCalledWith('', 'email:nophone@example.test');
    expect(page.vipOverride).toBe(true);
    expect(page.blacklisted).toBe(true);
    expect(page.noteContent).toBe('Ghi chú từ lịch sử');
  });

  it('saves guestKey, VIP nullable override, and blacklist flag and recomputes auto VIP when reset to null', () => {
    const { page, phoneLessGuest, savedPayloads, alertService } = setup();
    page.viewGuestDetails(phoneLessGuest);

    page.noteContent = 'Khách đặc biệt';
    page.vipOverride = false;
    page.blacklisted = true;
    page.saveGuestNotes();

    expect(savedPayloads).toEqual([
      {
        phoneNumber: '',
        guestKey: 'email:nophone@example.test',
        notes: 'Khách đặc biệt',
        isVip: false,
        isBlacklisted: true
      }
    ]);
    expect(page.selectedGuest()?.isVip).toBe(false);
    expect(page.selectedGuest()?.isBlacklisted).toBe(true);
    expect(alertService.toastSuccess).toHaveBeenCalled();

    // Resetting manual VIP override back to null restores automatic VIP evaluation (false for 1 stay / 1.2M VND)
    page.vipOverride = true;
    page.saveGuestNotes();
    expect(page.selectedGuest()?.isVip).toBe(true);

    page.vipOverride = null;
    page.saveGuestNotes();
    expect(page.selectedGuest()?.vipOverride).toBeNull();
    expect(page.selectedGuest()?.isVip).toBe(false);
  });

  it('does not overwrite unsaved note, VIP, or blacklist edits when getGuestHistory resolves asynchronously', () => {
    const { page, phoneLessGuest, guestService } = setup();
    const history$ = new Subject<GuestDetailDto>();
    guestService.getGuestHistory.mockReturnValueOnce(history$);

    page.viewGuestDetails(phoneLessGuest);
    page.noteContent = 'Ghi chú mới đang nhập';
    page.vipOverride = true;
    page.blacklisted = true;
    page.markNotesDirty();

    history$.next({
      profile: { ...phoneLessGuest, vipOverride: null, isVip: false, isBlacklisted: false, notes: 'Ghi chú cũ từ server' },
      bookings: []
    });
    history$.complete();

    expect(page.noteContent).toBe('Ghi chú mới đang nhập');
    expect(page.vipOverride).toBe(true);
    expect(page.blacklisted).toBe(true);
  });
});
