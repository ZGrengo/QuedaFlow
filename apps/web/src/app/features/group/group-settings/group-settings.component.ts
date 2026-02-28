import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { GroupService, Group } from '../../../core/services/group.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../core/components/confirm-dialog/confirm-dialog.component';
import { AuthService } from '../../../core/services/auth.service';
import { hhmmToMin, minToHhmm, timeRangesOverlap } from '@domain/index';

const DOW_LABELS: Record<number, string> = {
  0: 'Domingo',
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado'
};

@Component({
  selector: 'app-group-settings',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatSelectModule,
    MatDialogModule,
    MatSnackBarModule
  ],
  template: `
    <div class="qf-page container">
      <div class="nav-back">
        <button mat-stroked-button class="qf-btn-secondary" [routerLink]="['/g', code]">
          <mat-icon>arrow_back</mat-icon>
          Volver al grupo
        </button>
      </div>

      <div *ngIf="!isHost" class="forbidden">
        <mat-card class="qf-surface">
          <mat-card-content>
            <p class="qf-muted">Solo el host puede configurar el grupo.</p>
          </mat-card-content>
        </mat-card>
      </div>

      <div *ngIf="isHost && group">
        <mat-card class="qf-surface">
          <mat-card-header>
            <mat-card-title>Configuración del Grupo</mat-card-title>
            <mat-card-subtitle>Rango de planificación, buffer y ventanas bloqueadas</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <form [formGroup]="settingsForm" (ngSubmit)="onSaveSettings()">
              <div class="form-section">
                <h3>Ventana de planificación</h3>
                <div class="form-row">
                  <mat-form-field appearance="outline">
                    <mat-label>Inicio</mat-label>
                    <input matInput [matDatepicker]="startPicker" formControlName="planning_start_date">
                    <mat-datepicker-toggle matSuffix [for]="startPicker"></mat-datepicker-toggle>
                    <mat-datepicker #startPicker></mat-datepicker>
                  </mat-form-field>
                  <mat-form-field appearance="outline">
                    <mat-label>Fin</mat-label>
                    <input matInput [matDatepicker]="endPicker" formControlName="planning_end_date">
                    <mat-datepicker-toggle matSuffix [for]="endPicker"></mat-datepicker-toggle>
                    <mat-datepicker #endPicker></mat-datepicker>
                  </mat-form-field>
                </div>
              </div>

              <div class="form-section">
                <h3>Otros ajustes</h3>
                <div class="form-row">
                  <mat-form-field appearance="outline">
                    <mat-label>Buffer antes de trabajo (min)</mat-label>
                    <input matInput type="number" formControlName="buffer_before_work_min" min="0" max="120">
                    <mat-hint>Minutos de margen antes del inicio del turno</mat-hint>
                  </mat-form-field>
                  <mat-form-field appearance="outline">
                    <mat-label>Umbral amarillo (0-1)</mat-label>
                    <input matInput type="number" formControlName="yellow_threshold" min="0" max="1" step="0.01">
                  </mat-form-field>
                  <mat-form-field appearance="outline">
                    <mat-label>Duración mínima reunión (min)</mat-label>
                    <input matInput type="number" formControlName="min_meeting_duration_min" min="15" max="480">
                  </mat-form-field>
                </div>
              </div>

              <button mat-raised-button class="qf-btn-primary" type="submit" [disabled]="settingsForm.invalid || saving">
                Guardar configuración
              </button>
            </form>
          </mat-card-content>
        </mat-card>

        <mat-card class="qf-surface blocked-windows">
          <mat-card-header>
            <mat-card-title>Ventanas bloqueadas</mat-card-title>
            <mat-card-subtitle>Franjas horarias excluidas del cálculo (ej. 00:00-07:59)</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <form [formGroup]="windowForm" (ngSubmit)="onAddWindow()">
              <div class="form-row">
                <mat-form-field appearance="outline">
                  <mat-label>Inicio (HH:MM)</mat-label>
                  <input matInput formControlName="start_time" placeholder="00:00">
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>Fin (HH:MM)</mat-label>
                  <input matInput formControlName="end_time" placeholder="07:59">
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>Día</mat-label>
                  <mat-select formControlName="dow">
                    <mat-option [value]="null">Todos los días</mat-option>
                    <mat-option *ngFor="let d of dowOptions" [value]="d.value">{{ d.label }}</mat-option>
                  </mat-select>
                </mat-form-field>
              </div>
              <button mat-raised-button class="qf-btn-accent" type="submit" [disabled]="windowForm.invalid">
                Añadir franja
              </button>
            </form>

            <div class="windows-list">
              <div *ngFor="let w of blockedWindows" class="window-item">
                <span>{{ minToHhmm(w.start_min) }} - {{ minToHhmm(w.end_min) }}</span>
                <span class="dow">{{ w.dow === null ? 'Todos' : DOW_LABELS[w.dow] }}</span>
                <button mat-icon-button color="warn" (click)="deleteWindow(w.id!)">
                  <mat-icon>delete</mat-icon>
                </button>
              </div>
              <div *ngIf="blockedWindows.length === 0" class="empty">No hay ventanas bloqueadas</div>
            </div>
          </mat-card-content>
        </mat-card>
      </div>
    </div>
  `,
  styles: [`
    .container { padding: 16px; }
    .nav-back { margin-bottom: 16px; }
    .forbidden { padding: 24px; }
    .form-section { margin-bottom: 24px; }
    .form-section h3 { margin: 0 0 12px 0; font-size: 1rem; }
    .form-row { display: flex; gap: 16px; margin-bottom: 16px; flex-wrap: wrap; }
    .form-row mat-form-field { flex: 1; min-width: 140px; }
    .blocked-windows { margin-top: 24px; }
    .windows-list { margin-top: 16px; }
    .window-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 0;
      border-bottom: 1px solid rgba(0, 0, 0, 0.08);
    }
    .window-item .dow { color: var(--qf-text-muted); font-size: 0.875rem; }
    .empty { padding: 16px; color: var(--qf-text-muted); }
  `]
})
export class GroupSettingsComponent implements OnInit {
  code = '';
  group: Group | null = null;
  isHost = false;
  saving = false;
  blockedWindows: Array<{ id?: string; start_min: number; end_min: number; dow: number | null }> = [];
  settingsForm: FormGroup;
  windowForm: FormGroup;
  minToHhmm = minToHhmm;
  DOW_LABELS = DOW_LABELS;
  dowOptions = Object.entries(DOW_LABELS).map(([value, label]) => ({ value: +value, label }));

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private groupService: GroupService,
    private authService: AuthService,
    private notification: NotificationService,
    private dialog: MatDialog
  ) {
    this.settingsForm = this.fb.group({
      planning_start_date: ['', Validators.required],
      planning_end_date: ['', Validators.required],
      buffer_before_work_min: [20, [Validators.required, Validators.min(0), Validators.max(120)]],
      yellow_threshold: [0.75, [Validators.required, Validators.min(0), Validators.max(1)]],
      min_meeting_duration_min: [60, [Validators.required, Validators.min(15), Validators.max(480)]]
    }, { validators: this.planningRangeValidator });

    this.windowForm = this.fb.group({
      start_time: ['00:00', [Validators.required, Validators.pattern(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/)]],
      end_time: ['07:59', [Validators.required, Validators.pattern(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/)]],
      dow: [null as number | null]
    });
  }

  planningRangeValidator(g: FormGroup) {
    const start = g.get('planning_start_date')?.value;
    const end = g.get('planning_end_date')?.value;
    if (!start || !end) return null;
    if (new Date(start) > new Date(end)) {
      return { planningRange: true };
    }
    return null;
  }

  ngOnInit() {
    const code = this.route.snapshot.paramMap.get('code');
    if (!code) {
      this.router.navigate(['/login']);
      return;
    }
    this.code = code;

    this.groupService.getGroup(code).subscribe({
      next: (group) => {
        this.group = group;
        this.authService.getCurrentUser().subscribe(user => {
          this.isHost = user?.id === group.host_user_id;
        });
        this.settingsForm.patchValue({
          planning_start_date: group.planning_start_date,
          planning_end_date: group.planning_end_date,
          buffer_before_work_min: group.buffer_before_work_min,
          yellow_threshold: group.yellow_threshold,
          min_meeting_duration_min: group.min_meeting_duration_min
        });
        this.loadBlockedWindows();
      },
      error: () => this.router.navigate(['/dashboard'])
    });
  }

  loadBlockedWindows() {
    if (!this.group) return;
    this.groupService.getBlockedWindows(this.group.id).subscribe({
      next: (windows) => {
        this.blockedWindows = windows;
      }
    });
  }

  onSaveSettings() {
    if (!this.group || this.settingsForm.invalid) return;
    this.saving = true;
    const v = this.settingsForm.value;
    const payload = {
      ...v,
      planning_start_date: typeof v.planning_start_date === 'string'
        ? v.planning_start_date
        : new Date(v.planning_start_date).toISOString().split('T')[0],
      planning_end_date: typeof v.planning_end_date === 'string'
        ? v.planning_end_date
        : new Date(v.planning_end_date).toISOString().split('T')[0]
    };
    this.groupService.updateSettings(this.group.id, payload).subscribe({
      next: (updated) => {
        this.group = updated;
        this.saving = false;
        this.notification.success('Configuración guardada', 2000);
      },
      error: (err) => {
        this.saving = false;
        this.notification.error(err?.message || 'Error al guardar');
      }
    });
  }

  onAddWindow() {
    if (!this.group || this.windowForm.invalid) return;
    const v = this.windowForm.value;
    const start_min = hhmmToMin(v.start_time);
    const end_min = hhmmToMin(v.end_time);
    if (start_min >= end_min && !(start_min >= 1320 && end_min <= 480)) {
      this.notification.error('Inicio debe ser anterior a fin (o cruzar medianoche)');
      return;
    }
    const newDow = v.dow ?? null;
    const overlapsExisting = this.blockedWindows.some(w => {
      const sameDay = w.dow === newDow || w.dow === null || newDow === null;
      return sameDay && timeRangesOverlap(w.start_min, w.end_min, start_min, end_min);
    });
    if (overlapsExisting) {
      this.notification.error('Ya existe una franja con el mismo día y horario solapado');
      return;
    }
    this.groupService.addBlockedWindow(this.group.id, {
      dow: v.dow,
      start_min,
      end_min
    }).subscribe({
      next: () => {
        this.windowForm.reset({ start_time: '00:00', end_time: '07:59', dow: null });
        this.loadBlockedWindows();
        this.notification.success('Franja añadida', 2000);
      },
      error: (err) => {
        this.notification.error(err?.message || 'Error al añadir franja');
      }
    });
  }

  deleteWindow(id: string) {
    const data: ConfirmDialogData = {
      title: 'Eliminar franja',
      message: '¿Eliminar esta franja?',
      confirmText: 'Eliminar',
      confirmWarn: true
    };
    this.dialog.open(ConfirmDialogComponent, { data, width: '400px' }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.groupService.deleteBlockedWindow(id).subscribe({
        next: () => {
          this.loadBlockedWindows();
          this.notification.success('Franja eliminada', 2000);
        }
      });
    });
  }
}
