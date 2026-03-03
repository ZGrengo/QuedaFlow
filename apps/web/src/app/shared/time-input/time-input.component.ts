import {
  Component,
  Input,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  AfterViewInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule, Validators, ValidatorFn } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  normalizeTimeInput,
  timeFormatValidator,
  timeRangeValidator,
  timeStepValidator
} from './time-normalize';

@Component({
  selector: 'qf-time-input',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatIconModule],
  template: `
    <mat-form-field appearance="outline" class="qf-time-input">
      <mat-label>{{ label }}</mat-label>
      <input
        matInput
        type="text"
        [value]="displayValue"
        (input)="onInput($event)"
        (blur)="onBlur()"
        [placeholder]="placeholder"
        [attr.required]="required ? '' : null"
        #textInput
      />
      <div
        matSuffix
        class="time-picker-trigger"
        aria-label="Abrir selector de hora"
        (click)="openNativePicker()"
      >
        <input
          #nativeTimeInput
          type="time"
          [value]="nativeTimeValue"
          [step]="stepSeconds"
          class="native-time-overlay"
          (change)="onNativeChange($event)"
        />
        <span class="time-picker-icon">
          <mat-icon>schedule</mat-icon>
        </span>
      </div>
      <mat-hint *ngIf="!(control?.touched && control?.dirty && control?.errors)">
        {{ helper || 'Ej: 09:00 o 17:30' }}
      </mat-hint>
      <mat-error *ngIf="control?.touched && control?.dirty && errorMessage">
        {{ errorMessage }}
      </mat-error>
    </mat-form-field>
  `,
  styles: [`
    .time-picker-trigger {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      margin-left: -42px;
      cursor: pointer;
      border-radius: 50%;
    }

    .time-picker-trigger:hover .time-picker-icon {
      opacity: 0.8;
    }

    .time-picker-icon {
      pointer-events: none;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .time-picker-icon mat-icon {
      font-size: 22px;
      width: 22px;
      height: 22px;
      color: #707070;
      opacity: 0.9;
    }

    .native-time-overlay {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      min-width: 44px;
      min-height: 44px;
      margin: 0;
      padding: 0;
      border: none;
      background: transparent;
      cursor: pointer;
      opacity: 0;
      font-size: 16px;
    }

    .qf-time-input {
      display: block;
    }
  `]
})
export class TimeInputComponent implements OnInit, OnDestroy, AfterViewInit {
  /** Control de formulario (no usar [formControl] para evitar conflicto con la directiva de Angular) */
  @Input() control!: FormControl<string>;
  @Input() label = 'Hora';
  @Input() required = false;
  @Input() minuteStep = 15;
  @Input() allowAnyMinute = true;
  @Input() helper = '';

  @ViewChild('nativeTimeInput') nativeTimeInput?: ElementRef<HTMLInputElement>;
  @ViewChild('textInput') textInput?: ElementRef<HTMLInputElement>;

  displayValue = '';
  placeholder = '09:00';
  stepSeconds = 15 * 60;
  private destroy$ = new Subject<void>();

  /** Valor para el input nativo: solo HH:MM válido, para que el selector no se bloquee */
  get nativeTimeValue(): string {
    const v = this.control?.value;
    if (v && typeof v === 'string' && /^\d{2}:\d{2}$/.test(v)) return v;
    return '';
  }

  get errorMessage(): string {
    const c = this.control;
    if (!c?.errors) return '';
    if (c.errors['required']) return 'Campo requerido';
    if (c.errors['timeFormat']) return 'Formato esperado HH:MM';
    if (c.errors['timeRange']) return 'Hora fuera de rango (00:00–23:59)';
    if (c.errors['timeStep']) return `Usa intervalos de ${this.minuteStep} min (ej: 00, 15, 30, 45)`;
    return '';
  }

  ngOnInit(): void {
    if (!this.control) return;
    this.stepSeconds = this.minuteStep * 60;
    this.displayValue = this.control.value ?? '';
    this.control.valueChanges.pipe(takeUntil(this.destroy$)).subscribe((v) => {
      this.displayValue = v ?? '';
    });
    const validators: ValidatorFn[] = [
      timeFormatValidator,
      timeRangeValidator
    ];
    if (!this.allowAnyMinute) {
      validators.push(timeStepValidator(this.minuteStep));
    }
    if (this.required) {
      validators.push(Validators.required);
    }
    this.control.addValidators(validators);
    this.control.updateValueAndValidity({ emitEvent: false });
  }

  ngAfterViewInit(): void {
    if (this.control?.value) {
      this.displayValue = this.control.value;
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const raw = input.value;
    this.control?.setValue(raw, { emitEvent: true });
    this.displayValue = raw;
  }

  onBlur(): void {
    const raw = this.control?.value ?? '';
    if (!raw.trim()) return;
    const result = normalizeTimeInput(raw);
    if (result.value) {
      this.control?.setValue(result.value, { emitEvent: true });
      this.displayValue = result.value;
    }
    this.control?.markAsTouched();
    this.control?.updateValueAndValidity();
  }

  onNativeChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const v = input.value;
    if (v) {
      this.control?.setValue(v, { emitEvent: true });
      this.displayValue = v;
    }
  }

  /** Abre el selector nativo de hora al hacer clic en el icono */
  openNativePicker(): void {
    const el = this.nativeTimeInput?.nativeElement;
    if (!el) return;

    const anyEl = el as any;
    if (typeof anyEl.showPicker === 'function') {
      anyEl.showPicker();
    } else {
      el.focus();
      el.click();
    }
  }
}
