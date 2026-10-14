import { Component, Input, Output, EventEmitter, HostListener, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface GalleryPhotoItem {
  readonly url: string;
  readonly title: string;
  readonly category?: string;
}

@Component({
  selector: 'app-photo-gallery-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      *ngIf="isOpen"
      class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/92 backdrop-blur-md transition-opacity duration-300 animate-fadeIn"
      role="dialog"
      aria-modal="true"
      [attr.aria-label]="title || 'Bộ sưu tập hình ảnh'"
      (click)="onBackdropClick($event)">

      <!-- Modal Container -->
      <div
        class="relative w-full max-w-5xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden max-h-[92vh]"
        (click)="$event.stopPropagation()">

        <!-- Header Bar -->
        <header class="px-5 py-4 border-b border-slate-800 flex items-center justify-between text-white shrink-0 bg-slate-950/60">
          <div class="min-w-0 pr-4">
            <div class="flex items-center gap-2">
              <span *ngIf="currentPhoto()?.category" class="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                {{ currentPhoto()?.category }}
              </span>
              <span class="text-xs text-slate-400 font-medium">
                Ảnh {{ currentIndex() + 1 }} / {{ photos.length }}
              </span>
            </div>
            <h3 class="text-base sm:text-lg font-bold text-slate-100 truncate mt-0.5">
              {{ title || 'Bộ sưu tập hình ảnh' }}
            </h3>
          </div>

          <!-- Close Button -->
          <button
            type="button"
            (click)="closeModal()"
            class="w-10 h-10 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors shrink-0 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            aria-label="Đóng bộ sưu tập ảnh">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </header>

        <!-- Main Photo Stage with Navigation Arrows -->
        <div class="relative flex-1 bg-slate-950 flex items-center justify-center min-h-[300px] sm:min-h-[440px] max-h-[58vh] overflow-hidden select-none">
          <!-- Previous Button -->
          <button
            *ngIf="photos.length > 1"
            type="button"
            (click)="prevPhoto()"
            class="absolute left-3 sm:left-5 z-20 w-11 h-11 rounded-full bg-slate-900/80 hover:bg-indigo-600 border border-slate-700/80 text-white flex items-center justify-center backdrop-blur-xs transition-all shadow-lg active:scale-95 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            aria-label="Xem ảnh trước">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
            </svg>
          </button>

          <!-- Active Photo Image Display -->
          <div class="w-full h-full flex items-center justify-center p-2 sm:p-4">
            <img
              *ngIf="currentPhoto()"
              [src]="currentPhoto()?.url"
              [alt]="currentPhoto()?.title || title"
              class="max-w-full max-h-[54vh] object-contain rounded-xl shadow-2xl transition-all duration-300 ease-out"
              loading="eager"
            />
          </div>

          <!-- Next Button -->
          <button
            *ngIf="photos.length > 1"
            type="button"
            (click)="nextPhoto()"
            class="absolute right-3 sm:right-5 z-20 w-11 h-11 rounded-full bg-slate-900/80 hover:bg-indigo-600 border border-slate-700/80 text-white flex items-center justify-center backdrop-blur-xs transition-all shadow-lg active:scale-95 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            aria-label="Xem ảnh tiếp theo">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>
            </svg>
          </button>

          <!-- Bottom Caption Overlay on Active Photo -->
          <div *ngIf="currentPhoto()?.title" class="absolute bottom-3 left-4 right-4 z-10 pointer-events-none">
            <div class="inline-block max-w-full bg-slate-900/85 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-slate-700/80 text-xs sm:text-sm text-slate-200 font-medium truncate shadow-md">
              {{ currentPhoto()?.title }}
            </div>
          </div>
        </div>

        <!-- Thumbnails Strip Bar -->
        <footer class="p-3 sm:p-4 bg-slate-950/90 border-t border-slate-800 shrink-0">
          <div class="flex items-center gap-2.5 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-slate-700">
            <button
              *ngFor="let photo of photos; let i = index"
              type="button"
              (click)="selectPhoto(i)"
              [class.ring-2]="currentIndex() === i"
              [class.ring-indigo-500]="currentIndex() === i"
              [class.opacity-100]="currentIndex() === i"
              [class.opacity-45]="currentIndex() !== i"
              class="relative w-16 h-12 sm:w-20 sm:h-14 rounded-xl overflow-hidden shrink-0 border border-slate-700 hover:opacity-100 transition-all focus:outline-none">
              <img
                [src]="photo.url"
                [alt]="photo.title"
                class="w-full h-full object-cover"
                loading="lazy"
              />
            </button>
          </div>
        </footer>

      </div>
    </div>
  `,
  styles: [`
    @keyframes fadeIn {
      from { opacity: 0; transform: scale(0.98); }
      to { opacity: 1; transform: scale(1); }
    }
    .animate-fadeIn {
      animation: fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
  `]
})
export class PhotoGalleryModalComponent {
  @Input() isOpen = false;
  @Input() title = '';
  @Input() photos: GalleryPhotoItem[] = [];

  @Input() set activeIndex(val: number) {
    if (val >= 0 && val < (this.photos?.length || 1)) {
      this.currentIndex.set(val);
    }
  }

  @Output() close = new EventEmitter<void>();

  currentIndex = signal<number>(0);

  currentPhoto = computed(() => {
    const list = this.photos;
    const idx = this.currentIndex();
    if (!list || list.length === 0) return null;
    return list[idx] || list[0];
  });

  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent): void {
    if (!this.isOpen) return;

    if (event.key === 'Escape') {
      this.closeModal();
    } else if (event.key === 'ArrowLeft') {
      this.prevPhoto();
    } else if (event.key === 'ArrowRight') {
      this.nextPhoto();
    }
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('fixed')) {
      this.closeModal();
    }
  }

  selectPhoto(index: number): void {
    this.currentIndex.set(index);
  }

  prevPhoto(): void {
    const total = this.photos.length;
    if (total <= 1) return;
    const cur = this.currentIndex();
    this.currentIndex.set(cur === 0 ? total - 1 : cur - 1);
  }

  nextPhoto(): void {
    const total = this.photos.length;
    if (total <= 1) return;
    const cur = this.currentIndex();
    this.currentIndex.set(cur === total - 1 ? 0 : cur + 1);
  }

  closeModal(): void {
    this.close.emit();
  }
}
