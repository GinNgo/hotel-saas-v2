import { ChangeDetectionStrategy, Component, Directive, computed, input } from '@angular/core';

@Component({
  selector: 'app-form-field',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-form-field' },
  template: `
    <label [for]="controlId()" [id]="controlId() + '-label'" class="app-field-label">
      {{ label() }} @if (required()) { <span aria-hidden="true">*</span><span class="sr-only"> (bắt buộc)</span> }
    </label>
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
    '[id]': 'field().controlId()',
    '[attr.aria-describedby]': 'field().descriptionIds() || null',
    '[attr.aria-invalid]': 'field().error() ? "true" : null',
  },
})
export class FormControlDirective {
  readonly field = input.required<FormFieldComponent>({ alias: 'appFormControl' });
}
