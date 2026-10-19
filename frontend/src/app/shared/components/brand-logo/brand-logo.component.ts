import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-brand-logo',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a [routerLink]="linkTarget" class="inline-flex items-center gap-2.5 group focus:outline-none cursor-pointer">
      <!-- Master SVG Logo Mark with Double-Bezel Framing -->
      <div
        [class]="containerClass"
        class="relative shrink-0 transition-transform duration-300 group-hover:scale-105"
      >
        <svg
          viewBox="0 0 120 120"
          class="w-full h-full drop-shadow-sm"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="luxeGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#FCE7B8" />
              <stop offset="50%" stop-color="#C5A880" />
              <stop offset="100%" stop-color="#A67C52" />
            </linearGradient>
            <radialGradient id="luxeDeepBackdrop" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="#1C2541" stop-opacity="0.95" />
              <stop offset="100%" stop-color="#0B132B" stop-opacity="1" />
            </radialGradient>
          </defs>

          <!-- Outer Double-Bezel Frame -->
          <rect x="6" y="6" width="108" height="108" rx="28" fill="url(#luxeDeepBackdrop)" stroke="#C5A880" stroke-width="1.5" stroke-opacity="0.45"/>
          <rect x="12" y="12" width="96" height="96" rx="22" stroke="#FFFFFF" stroke-width="0.75" stroke-opacity="0.18"/>

          <!-- Architectural Portal & Monogram L-S Archway -->
          <path d="M42 82V46C42 36.0589 50.0589 28 60 28C69.9411 28 78 36.0589 78 46V82" stroke="url(#luxeGoldGrad)" stroke-width="4" stroke-linecap="round"/>
          <path d="M42 64H78" stroke="#C5A880" stroke-width="1.5" stroke-opacity="0.6" stroke-dasharray="3 3"/>

          <!-- Geometric Diamond Accent & Star -->
          <polygon points="60,40 67,49 60,58 53,49" fill="url(#luxeGoldGrad)" />
          <circle cx="60" cy="74" r="3.5" fill="#FFFFFF" fill-opacity="0.9" />
        </svg>
      </div>

      <!-- Optional Wordmark & Tagline -->
      @if (showWordmark) {
        <div class="flex flex-col">
          <div class="flex items-center gap-1.5">
            <span
              [class]="textColorClass"
              class="font-black tracking-tight text-lg leading-tight uppercase font-serif"
            >
              Luxe<span class="text-amber-500">Stay</span>
            </span>
            <span class="px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-widest bg-amber-400/15 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              Cloud
            </span>
          </div>
          @if (showTagline) {
            <span [class]="taglineColorClass" class="text-[10px] font-semibold tracking-wider uppercase opacity-75">
              Hospitality PMS &amp; Booking
            </span>
          }
        </div>
      }
    </a>
  `
})
export class BrandLogoComponent {
  @Input() size: 'sm' | 'md' | 'lg' = 'md';
  @Input() variant: 'dark' | 'light' = 'dark';
  @Input() showWordmark: boolean = true;
  @Input() showTagline: boolean = true;
  @Input() linkTarget: string = '/booking';

  get containerClass(): string {
    switch (this.size) {
      case 'sm': return 'w-8 h-8';
      case 'lg': return 'w-12 h-12';
      default: return 'w-9 h-9';
    }
  }

  get textColorClass(): string {
    return this.variant === 'light' ? 'text-white' : 'text-slate-900 dark:text-white';
  }

  get taglineColorClass(): string {
    return this.variant === 'light' ? 'text-slate-300' : 'text-slate-500 dark:text-slate-400';
  }
}
