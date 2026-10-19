import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  forwardRef,
  HostListener,
  Input,
  Output,
  ViewChild,
  computed,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormsModule } from '@angular/forms';
import { removeVietnameseAccents } from '../../../core/models/location.model';

export interface SearchableSelectItem {
  value: string;
  label: string;
  subLabel?: string;
  badge?: string;
}

@Component({
  selector: 'app-searchable-select',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SearchableSelectComponent),
      multi: true
    }
  ],
  template: `
    <div class="relative w-full text-left" #container>
      <!-- Trigger Button -->
      <button
        #trigger
        [id]="controlId"
        [attr.aria-label]="label || placeholder"
        [attr.aria-invalid]="invalid ? 'true' : null"
        [attr.aria-describedby]="describedBy || null"
        aria-haspopup="listbox"
        [attr.aria-controls]="isOpen() ? listId : null"
        (keydown.arrowdown)="$event.preventDefault(); openDropdown()"
        type="button"
        [disabled]="disabled || loading"
        (click)="toggleDropdown()"
        class="w-full min-h-11 flex items-center justify-between text-left text-base py-2 pl-3 pr-12 border rounded-xl bg-white transition-all shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-slate-50 disabled:text-slate-600 disabled:cursor-not-allowed"
        [class.border-rose-400]="invalid"
        [class.border-slate-300]="!invalid && !isOpen()"
        [class.border-indigo-500]="isOpen()"
        [class.ring-2]="isOpen()"
        [class.ring-indigo-100]="isOpen()"
        [attr.aria-expanded]="isOpen()"
      >
        <div class="flex items-center gap-2 truncate flex-1 min-w-0 pr-1">
          @if (loading) {
            <i class="pi pi-spin pi-spinner text-xs text-indigo-600 shrink-0"></i>
            <span class="text-xs text-slate-400">Đang tải danh sách...</span>
          } @else if (selectedItem()) {
            <span class="truncate font-medium text-slate-800">{{ selectedItem()?.label }}</span>
            @if (selectedItem()?.badge) {
              <span class="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-semibold shrink-0">
                {{ selectedItem()?.badge }}
              </span>
            }
          } @else {
            <span class="text-slate-400 text-xs sm:text-sm truncate">{{ placeholder }}</span>
          }
        </div>

        <div class="flex items-center gap-1 shrink-0 text-slate-400">
          <i
            class="pi pi-chevron-down text-xs transition-transform duration-200"
            [class.rotate-180]="isOpen()"
          ></i>
        </div>
      </button>
      @if (selectedItem() && !disabled && !loading) {
        <button type="button" aria-label="Xóa lựa chọn" (click)="clearSelection($event)"
          class="absolute top-0 right-0 min-h-11 min-w-11 text-slate-600 hover:text-indigo-700 rounded-xl">
          <i class="pi pi-times" aria-hidden="true"></i>
        </button>
      }

      <!-- Dropdown Panel -->
      @if (isOpen() && !disabled) {
        <div
          class="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150"
          style="max-height: 280px; display: flex; flex-direction: column;"
        >
          <!-- Search Box -->
          <div class="p-2 border-b border-slate-100 bg-slate-50/80 sticky top-0 z-10">
            <div class="relative">
              <i class="pi pi-search absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
              <input
                type="text"
                [ngModel]="searchQuery()"
                (ngModelChange)="updateQuery($event)"
                role="combobox"
                [attr.aria-label]="searchPlaceholder"
                aria-autocomplete="list"
                aria-expanded="true"
                [attr.aria-controls]="listId"
                [attr.aria-activedescendant]="activeIndex() >= 0 && activeIndex() < filteredItems().length ? listId + '-' + activeIndex() : null"
                (keydown)="onSearchKeydown($event)"
                [ngModelOptions]="{standalone: true}"
                [placeholder]="searchPlaceholder"
                class="w-full min-h-11 text-base pl-8 pr-12 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                #searchInput
              />
              @if (searchQuery()) {
                <button
                  type="button"
                  (click)="updateQuery('')"
                  aria-label="Xóa nội dung tìm"
                  class="absolute right-0 top-0 min-w-11 min-h-11 text-slate-600"
                >
                  <i class="pi pi-times text-[10px]"></i>
                </button>
              }
            </div>
          </div>

          <!-- Items List -->
          <div [id]="listId" role="listbox" [attr.aria-label]="label || placeholder" class="overflow-y-auto flex-1 divide-y divide-slate-50 py-1">
            @if (filteredItems().length === 0) {
              <div class="p-4 text-center text-xs text-slate-400">
                <i class="pi pi-inbox text-base mb-1 block text-slate-300"></i>
                <span>{{ emptyMessage }}</span>
              </div>
            } @else {
              @for (item of filteredItems(); track item.value; let index = $index) {
                <button
                  role="option"
                  tabindex="-1"
                  [id]="listId + '-' + index"
                  [attr.aria-selected]="item.value === currentValue()"
                  [class.bg-indigo-100]="index === activeIndex()"
                  type="button"
                  (click)="selectItem(item)"
                  class="w-full min-h-11 text-left px-3 py-2 text-sm hover:bg-indigo-50/70 transition-colors flex items-center justify-between gap-2 cursor-pointer"
                  [class.bg-indigo-50]="item.value === currentValue()"
                  [class.text-indigo-700]="item.value === currentValue()"
                  [class.font-semibold]="item.value === currentValue()"
                >
                  <div class="truncate flex items-center gap-1.5 flex-1 min-w-0">
                    <span class="truncate">{{ item.label }}</span>
                    @if (item.subLabel) {
                      <span class="text-[10px] text-slate-400 truncate">({{ item.subLabel }})</span>
                    }
                  </div>
                  <div class="flex items-center gap-1.5 shrink-0">
                    @if (item.badge) {
                      <span class="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-500 font-medium">
                        {{ item.badge }}
                      </span>
                    }
                    @if (item.value === currentValue()) {
                      <i class="pi pi-check text-xs text-indigo-600 font-bold"></i>
                    }
                  </div>
                </button>
              }
            }
          </div>
        </div>
      }
    </div>
  `
})
export class SearchableSelectComponent implements ControlValueAccessor {
  private static nextId = 0;
  private readonly options = signal<SearchableSelectItem[]>([]);
  @Input() set items(value: SearchableSelectItem[]) { this.options.set(value ?? []); this.activeIndex.set(-1); }
  get items(): SearchableSelectItem[] { return this.options(); }
  @Input() controlId = `searchable-select-${++SearchableSelectComponent.nextId}`;
  @Input() label = '';
  @Input() describedBy = '';
  get listId(): string { return `${this.controlId}-options`; }
  readonly activeIndex = signal(-1);
  private readonly changeDetector = inject(ChangeDetectorRef);
  @ViewChild('trigger') private trigger?: ElementRef<HTMLButtonElement>;
  @ViewChild('searchInput') set searchInput(element: ElementRef<HTMLInputElement> | undefined) {
    element?.nativeElement.focus();
  }
  @Input() placeholder = '-- Chọn --';
  @Input() searchPlaceholder = 'Gõ để tìm nhanh...';
  @Input() disabled = false;
  @Input() loading = false;
  @Input() invalid = false;
  @Input() emptyMessage = 'Không tìm thấy kết quả phù hợp';

  @Output() selectionChange = new EventEmitter<string>();

  readonly isOpen = signal(false);
  readonly searchQuery = signal('');
  readonly currentValue = signal<string>('');

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  constructor(private readonly elementRef: ElementRef) {}

  @HostListener('document:click', ['$event'])
  onClickOutside(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.closeDropdown();
    }
  }

  @HostListener('keydown.escape', ['$event'])
  onEscape(event: Event): void {
    if (!this.isOpen()) return;
    event.stopPropagation();
    event.preventDefault();
    this.closeDropdown();
    this.trigger?.nativeElement.focus();
  }

  @HostListener('document:focusin', ['$event'])
  onFocusOutside(event: FocusEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target)) this.closeDropdown();
  }

  @HostListener('focusout', ['$event'])
  onBlur(event: FocusEvent): void {
    if (!this.elementRef.nativeElement.contains(event.relatedTarget)) {
      this.closeDropdown();
      this.onTouched();
    }
  }

  openDropdown(): void {
    if (this.disabled || this.loading) return;
    this.updateQuery('');
    this.isOpen.set(true);
  }

  updateQuery(value: string): void { this.searchQuery.set(value); this.activeIndex.set(-1); }

  onSearchKeydown(event: KeyboardEvent): void {
    if (this.disabled || this.loading) return;
    const items = this.filteredItems();
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!items.length) return;
      const index = this.activeIndex();
      this.activeIndex.set(index < 0 ? (event.key === 'ArrowDown' ? 0 : items.length - 1)
        : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length);
      this.elementRef.nativeElement.querySelector(`#${this.listId}-${this.activeIndex()}`)?.scrollIntoView?.({ block: 'nearest' });
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const selected = items[this.activeIndex()];
      if (selected) this.selectItem(selected);
    }
  }

  readonly selectedItem = computed(() => {
    const val = this.currentValue();
    return this.items.find(item => item.value === val) || null;
  });

  readonly filteredItems = computed(() => {
    const query = this.searchQuery().trim();
    if (!query) return this.items;

    const normQuery = removeVietnameseAccents(query);
    return this.items.filter(item => {
      const normLabel = removeVietnameseAccents(item.label);
      const normSub = item.subLabel ? removeVietnameseAccents(item.subLabel) : '';
      return (
        normLabel.includes(normQuery) ||
        normSub.includes(normQuery) ||
        item.value.toLowerCase().includes(query.toLowerCase())
      );
    });
  });

  toggleDropdown(): void {
    if (this.disabled || this.loading) return;
    if (this.isOpen()) this.closeDropdown();
    else this.openDropdown();
  }

  closeDropdown(): void {
    if (this.isOpen()) {
      this.isOpen.set(false);
      this.onTouched();
    }
  }

  selectItem(item: SearchableSelectItem): void {
    if (this.disabled || this.loading) return;
    this.currentValue.set(item.value);
    this.onChange(item.value);
    this.selectionChange.emit(item.value);
    this.closeDropdown();
    this.trigger?.nativeElement.focus();
  }

  clearSelection(event: Event): void {
    event.stopPropagation();
    if (this.disabled || this.loading) return;
    this.currentValue.set('');
    this.onChange('');
    this.selectionChange.emit('');
    this.onTouched();
    this.closeDropdown();
    this.trigger?.nativeElement.focus();
  }

  // ControlValueAccessor implementation
  writeValue(value: string): void {
    this.currentValue.set(value || '');
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState?(isDisabled: boolean): void {
    this.disabled = isDisabled;
    if (isDisabled) this.closeDropdown();
    this.changeDetector.markForCheck();
  }
}
