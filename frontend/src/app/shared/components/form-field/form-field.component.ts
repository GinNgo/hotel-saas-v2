import { ChangeDetectionStrategy, Component, Directive, computed, input } from '@angular/core';

@Component({
  selector: 'app-form-field',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-form-field' },
  template: `
    <div class="flex items-center justify-between mb-1.5">
      <label [for]="controlId()" [id]="controlId() + '-label'" class="app-field-label !mb-0">
        {{ label() }} @if (required()) { <span aria-hidden="true">*</span><span class="sr-only"> (bắt buộc)</span> }
      </label>
      <ng-content select="[slot=action], [slot=label-end]" />
    </div>
    <ng-content />
    @if (hint()) { <p [id]="controlId() + '-hint'" class="app-field-hint">{{ hint() }}</p> }
    @if (error()) { <p [id]="controlId() + '-error'" class="app-field-error" role="alert">{{ error() }}</p> }
  `,
})
export class FormFieldComponent {
  readonly controlId = input.required<string>();
  readonly label = input.required<string>();
  readonly required = input(false);
  readonly hint = input('');
  readonly error = input('');
  readonly descriptionIds = computed(() => [this.hint() ? `${this.controlId()}-hint` : '',
    this.error() ? `${this.controlId()}-error` : ''].filter(Boolean).join(' '));
}

@Directive({
  selector: 'input[appFormControl],textarea[appFormControl],select[appFormControl]',
  standalone: true,
  host: {
    class: 'app-form-control',
    '[id]': 'controlId()',
    '[attr.aria-describedby]': 'descriptionIds()',
    '[attr.aria-invalid]': 'isInvalid()',
  },
})
export class FormControlDirective {
  readonly field = input<FormFieldComponent | null>(null, { alias: 'appFormControl' });

  readonly controlId = computed(() => this.field()?.controlId() || null);
  readonly descriptionIds = computed(() => this.field()?.descriptionIds() || null);
  readonly isInvalid = computed(() => (this.field()?.error() ? 'true' : null));
}
