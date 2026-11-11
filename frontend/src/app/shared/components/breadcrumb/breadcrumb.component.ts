import { Component, computed, inject, input } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router, NavigationEnd, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs/operators';
import { BreadcrumbItem, buildBreadcrumbItems } from '../../../core/services/breadcrumb.utils';

/**
 * Reusable, accessible Breadcrumb navigation component.
 * Automatically tracks current location in the application hierarchy based on Angular Router events,
 * and supports custom breadcrumb items override.
 */
@Component({
  selector: 'app-breadcrumb',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    @if (items().length > 0) {
      <nav aria-label="Điều hướng phân cấp" class="flex items-center min-w-0 py-1" data-testid="app-breadcrumb">
        <!-- Optional Quick Back Button when deep in hierarchy -->
        @if (items().length > 1 && showBackButton()) {
          <button
            type="button"
            (click)="navigateBack()"
            class="mr-2.5 inline-flex items-center justify-center w-7 h-7 rounded-lg border border-[var(--surface-border)] bg-[var(--surface-card)] text-[var(--text-muted)] hover:text-emerald-700 hover:border-emerald-300 dark:hover:text-emerald-400 transition-all cursor-pointer shadow-2xs shrink-0"
            title="Quay lại trang trước"
            aria-label="Quay lại trang trước"
            data-testid="breadcrumb-back-btn"
          >
            <i class="pi pi-arrow-left text-xs"></i>
          </button>
        }

        <ol class="flex items-center flex-wrap gap-1.5 sm:gap-2 text-xs sm:text-sm font-medium min-w-0">
          @for (item of items(); track item.url; let i = $index) {
            <li class="inline-flex items-center gap-1.5 min-w-0">
              @if (!item.isLast) {
                <a
                  [routerLink]="item.url"
                  class="inline-flex items-center gap-1.5 text-[var(--text-muted)] hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors rounded-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500/40"
                  [attr.aria-label]="item.label"
                >
                  @if (item.icon) {
                    <i [class]="item.icon + ' text-xs opacity-70'"></i>
                  }
                  <span class="truncate">{{ item.label }}</span>
                </a>
                <i
                  class="pi pi-chevron-right text-[10px] text-[var(--text-muted)] opacity-50 select-none ml-1 shrink-0"
                  aria-hidden="true"
                ></i>
              } @else {
                <span
                  class="inline-flex items-center gap-1.5 text-[var(--text-main)] font-semibold truncate max-w-[240px] sm:max-w-md"
                  aria-current="page"
                >
                  @if (item.icon) {
                    <i [class]="item.icon + ' text-xs text-emerald-600 dark:text-emerald-400'"></i>
                  }
                  <span class="truncate">{{ item.label }}</span>
                </span>
              }
            </li>
          }
        </ol>
      </nav>
    }
  `
})
export class BreadcrumbComponent {
  private readonly router = inject(Router);
  private readonly location = inject(Location);

  /**
   * Optional manual override of breadcrumb items if page wants custom titles (e.g. specific room or property name).
   */
  readonly customItems = input<BreadcrumbItem[] | null>(null);

  /**
   * Whether to show the quick back-to-previous-level button when inside sub-routes.
   */
  readonly showBackButton = input<boolean>(true);

  // Reactive URL tracking via Signals
  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(e => e.urlAfterRedirects || e.url),
      startWith(this.router.url)
    ),
    { initialValue: this.router.url }
  );

  /**
   * Computed list of breadcrumb items.
   */
  readonly items = computed<BreadcrumbItem[]>(() => {
    const custom = this.customItems();
    if (custom && custom.length > 0) {
      return custom;
    }
    return buildBreadcrumbItems(this.currentUrl());
  });

  /**
   * Navigates back either to the immediate parent breadcrumb item or via browser history.
   */
  navigateBack(): void {
    const list = this.items();
    if (list.length >= 2) {
      const parentItem = list[list.length - 2];
      void this.router.navigateByUrl(parentItem.url);
    } else {
      this.location.back();
    }
  }
}
