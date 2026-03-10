import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { DetectedShift } from '@domain/index';
import { minToHhmm, hhmmToMin } from '@domain/index';
import { TimeInputComponent } from '../../../shared/time-input';
import { dateToLocalISOString } from '../../../core/utils/date-format';

@Component({
  selector: 'app-shift-editor',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatButtonModule,
    MatIconModule,
    TimeInputComponent
  ],
  template: `
    <div class="shift-editor" [formGroup]="shiftForm">
      <div class="shift-editor-fields">
        <mat-form-field appearance="outline" class="date-field">
          <mat-label>Fecha</mat-label>
          <input matInput [matDatepicker]="picker" formControlName="date" [min]="minDate" [max]="maxDate">
          <mat-datepicker-toggle matSuffix [for]="picker"></mat-datepicker-toggle>
          <mat-datepicker #picker></mat-datepicker>
        </mat-form-field>

        <div class="time-row">
          <qf-time-input
            label="Inicio"
            [control]="$any(shiftForm.get('startTime'))"
            [required]="true"
            helper="HH:MM">
          </qf-time-input>
          <qf-time-input
            label="Fin"
            [control]="$any(shiftForm.get('endTime'))"
            [required]="true"
            helper="HH:MM">
          </qf-time-input>
        </div>

      </div>
      <button mat-icon-button color="warn" type="button" (click)="onDelete()" class="delete-btn" aria-label="Eliminar turno">
        <mat-icon>delete</mat-icon>
      </button>
    </div>
  `,
  styles: [`
    .shift-editor {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
      background: #fafafa;
      margin-bottom: 8px;
      box-sizing: border-box;
      min-width: 0;
    }

    .shift-editor-fields {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: flex-start;
    }

    .date-field {
      flex: 1;
      min-width: 120px;
    }

    .time-row {
      display: flex;
      gap: 12px;
      flex: 1;
      min-width: 0;
    }

    .time-row qf-time-input {
      min-width: 180px;
      flex: 1;
    }

    .time-field {
      min-width: 80px;
      flex: 1;
      max-width: 120px;
    }

    .notes {
      display: flex;
      align-items: center;
      gap: 4px;
      color: #666;
      font-size: 0.875rem;
      padding: 8px 0;
      width: 100%;
    }

    .notes mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      flex-shrink: 0;
    }

    .delete-btn {
      flex-shrink: 0;
      margin-top: 0;
    }

    @media (max-width: 600px) {
      .shift-editor {
        flex-wrap: wrap;
        padding: 12px;
      }

      .shift-editor-fields {
        flex: 1 1 100%;
        flex-direction: column;
      }

      .date-field {
        width: 100%;
        min-width: 0;
      }

      .time-row {
        width: 100%;
        max-width: none;
      }

      .time-field {
        flex: 1;
        min-width: 0;
        max-width: none;
      }

      .delete-btn {
        position: absolute;
        top: 4px;
        right: 8px;
        min-width: 44px;
        min-height: 44px;
      }

      .shift-editor {
        position: relative;
        padding-top: 44px;
      }
    }

    @media (max-width: 480px) {
      .time-row {
        flex-direction: column;
      }

      .time-row qf-time-input {
        min-width: 0;
        width: 100%;
      }

      .notes {
        font-size: 0.8rem;
      }
    }
  `]
})
export class ShiftEditorComponent implements OnInit {
  @Input() shift!: DetectedShift;
  @Input() minDate!: Date;
  @Input() maxDate!: Date;
  @Output() shiftChange = new EventEmitter<DetectedShift>();
  @Output() delete = new EventEmitter<void>();

  shiftForm: FormGroup;

  constructor(private fb: FormBuilder) {
    this.shiftForm = this.fb.group({
      date: ['', Validators.required],
      startTime: ['', Validators.required],
      endTime: ['', Validators.required],
      crossesMidnight: [false]
    });

    // Emit changes when form values change
    this.shiftForm.valueChanges.subscribe(() => {
      if (this.shiftForm.valid) {
        this.emitShift();
      }
    });
  }

  ngOnInit() {
    // Initialize form with shift values
    const date = new Date(this.shift.dateISO);
    // Handle endMin = 1440 (midnight) - show as 00:00
    const endTime = this.shift.endMin === 1440 ? '00:00' : minToHhmm(this.shift.endMin);
    this.shiftForm.patchValue({
      date,
      startTime: minToHhmm(this.shift.startMin),
      endTime,
      crossesMidnight: this.shift.crossesMidnight
    }, { emitEvent: false });
  }

  private emitShift() {
    const formValue = this.shiftForm.value;
    const date = formValue.date as Date;
    const dateISO = dateToLocalISOString(date);
    const startMin = hhmmToMin(formValue.startTime);
    // Handle 00:00 as end time - convert to 1440 (end of day)
    let endMin = formValue.endTime === '00:00' ? 1440 : hhmmToMin(formValue.endTime);
    const crossesMidnight = endMin < startMin || endMin === 1440;

    const updatedShift: DetectedShift = {
      dateISO,
      startMin,
      endMin,
      crossesMidnight,
      confidence: this.shift.confidence
    };

    this.shiftForm.patchValue({ crossesMidnight }, { emitEvent: false });
    this.shiftChange.emit(updatedShift);
  }

  onDelete() {
    this.delete.emit();
  }
}

