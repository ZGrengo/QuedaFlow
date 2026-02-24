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
    MatIconModule
  ],
  template: `
    <div class="shift-editor" [formGroup]="shiftForm">
      <mat-form-field appearance="outline" class="date-field">
        <mat-label>Fecha</mat-label>
        <input matInput [matDatepicker]="picker" formControlName="date" [min]="minDate" [max]="maxDate">
        <mat-datepicker-toggle matSuffix [for]="picker"></mat-datepicker-toggle>
        <mat-datepicker #picker></mat-datepicker>
      </mat-form-field>

      <mat-form-field appearance="outline" class="time-field">
        <mat-label>Inicio</mat-label>
        <input matInput formControlName="startTime" placeholder="HH:MM">
      </mat-form-field>

      <mat-form-field appearance="outline" class="time-field">
        <mat-label>Fin</mat-label>
        <input matInput formControlName="endTime" placeholder="HH:MM">
      </mat-form-field>

      <div class="notes" *ngIf="shiftForm.get('crossesMidnight')?.value">
        <mat-icon>info</mat-icon>
        <span>Este turno cruza medianoche</span>
      </div>

      <button mat-icon-button color="warn" type="button" (click)="onDelete()" class="delete-btn">
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
    }

    .date-field {
      flex: 1;
      min-width: 140px;
    }

    .time-field {
      width: 100px;
    }

    .notes {
      display: flex;
      align-items: center;
      gap: 4px;
      color: #666;
      font-size: 0.875rem;
      padding: 8px;
      flex: 1;
    }

    .notes mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .delete-btn {
      margin-top: 8px;
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
      startTime: ['', [Validators.required, Validators.pattern(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/)]],
      endTime: ['', [Validators.required, Validators.pattern(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/)]],
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
    const dateISO = date.toISOString().split('T')[0];
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

