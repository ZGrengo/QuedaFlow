import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatChipsModule } from '@angular/material/chips';
import { MatRadioModule } from '@angular/material/radio';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { BlocksService } from '../../../core/services/blocks.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../core/components/confirm-dialog/confirm-dialog.component';
import { GroupService } from '../../../core/services/group.service';
import { AuthService } from '../../../core/services/auth.service';
import { AvailabilityBlock } from '@domain/index';
import { minToHhmm, hhmmToMin, timeRangesOverlap } from '@domain/index';
import { formatDateDDMMYYYY } from '../../../core/utils/date-format';

@Component({
  selector: 'app-blocks-manager',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatChipsModule,
    MatRadioModule,
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
      <mat-card class="qf-surface">
        <mat-card-header>
          <mat-card-title>Gestionar Bloques de Ocupación</mat-card-title>
          <mat-card-subtitle>Añade las horas en las que trabajas y otros momentos en los que no estás disponible. Los huecos libres se calcularán automáticamente.</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <form [formGroup]="blockForm" (ngSubmit)="onSubmit()">
            <div class="form-mode">
              <mat-radio-group formControlName="mode" class="mode-radio-group">
                <mat-radio-button value="single">Un solo día</mat-radio-button>
                <mat-radio-button value="fixed">Horario fijo (repetir por días)</mat-radio-button>
              </mat-radio-group>
            </div>

            <div class="form-row">
              <mat-form-field appearance="outline">
                <mat-label>Tipo</mat-label>
                <mat-select formControlName="type" required>
                  <mat-option value="WORK">Trabajo (horas ocupadas)</mat-option>
                  <mat-option value="UNAVAILABLE">No disponible (reuniones, citas, etc.)</mat-option>
                  <mat-option value="PREFERRED">Preferido (horas libres que prefieres)</mat-option>
                </mat-select>
              </mat-form-field>

              <mat-form-field *ngIf="blockForm.get('mode')?.value === 'single'" appearance="outline">
                <mat-label>Fecha</mat-label>
                <input matInput [matDatepicker]="picker" formControlName="date"
                  [min]="minDate" [max]="maxDate">
                <mat-datepicker-toggle matSuffix [for]="picker"></mat-datepicker-toggle>
                <mat-datepicker #picker [startAt]="minDate"></mat-datepicker>
                <mat-hint *ngIf="planningRangeHint">{{ planningRangeHint }}</mat-hint>
              </mat-form-field>

              <ng-container *ngIf="blockForm.get('mode')?.value === 'fixed'">
                <mat-form-field appearance="outline">
                  <mat-label>Día desde</mat-label>
                  <mat-select formControlName="day_from">
                    <mat-option *ngFor="let o of weekdayOptions" [value]="o.value">{{ o.label }}</mat-option>
                  </mat-select>
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>Día hasta</mat-label>
                  <mat-select formControlName="day_to">
                    <mat-option *ngFor="let o of weekdayOptions" [value]="o.value">{{ o.label }}</mat-option>
                  </mat-select>
                </mat-form-field>
              </ng-container>
            </div>

            <div class="form-row">
              <mat-form-field appearance="outline">
                <mat-label>Hora inicio (HH:MM)</mat-label>
                <input matInput formControlName="start_time" placeholder="09:00" required>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Hora fin (HH:MM)</mat-label>
                <input matInput formControlName="end_time" placeholder="17:00" required>
              </mat-form-field>
            </div>

            <p *ngIf="blockForm.get('mode')?.value === 'fixed'" class="fixed-hint">
              Se crearán bloques para todos los días entre «Día desde» y «Día hasta» dentro del rango de planificación del grupo.
            </p>

            <div *ngIf="preferredCount >= 3 && blockForm.get('type')?.value === 'PREFERRED'" class="warning">
              Máximo 3 bloques PREFERRED permitidos
            </div>

            <div class="form-actions">
              <button mat-raised-button class="qf-btn-primary" type="submit" [disabled]="!isFormValid() || loading">
                {{ blockForm.get('mode')?.value === 'fixed' ? 'Añadir horario fijo' : 'Añadir Bloque' }}
              </button>
              <button mat-stroked-button type="button" [routerLink]="['/g', code, 'import']">
                <mat-icon>image</mat-icon>
                Importar desde imagen
              </button>
            </div>
          </form>
        </mat-card-content>
      </mat-card>

      <mat-card class="qf-surface blocks-list">
        <mat-card-header>
          <mat-card-title>Mis Bloques</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <div *ngFor="let block of myBlocks" class="block-item">
            <mat-chip-set>
              <mat-chip>{{ block.type }}</mat-chip>
              <mat-chip>{{ block.date | date:'dd/MM/yyyy' }}</mat-chip>
              <mat-chip>{{ minToHhmm(block.start_min) }} - {{ minToHhmm(block.end_min) }}</mat-chip>
            </mat-chip-set>
            <button mat-icon-button color="warn" (click)="deleteBlock(block.id!)">
              <mat-icon>delete</mat-icon>
            </button>
          </div>
          <div *ngIf="myBlocks.length === 0" class="empty">No hay bloques añadidos</div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .container {
      padding: 16px;
    }

    .nav-back {
      margin-bottom: 16px;
    }

    .form-mode {
      margin-bottom: 16px;
    }

    .mode-radio-group {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
    }

    .mode-radio-group mat-radio-button {
      margin-right: 8px;
    }

    .fixed-hint {
      margin: -8px 0 16px 0;
      font-size: 0.875rem;
      color: var(--qf-text-muted);
    }

    .form-row {
      display: flex;
      gap: 16px;
      margin-bottom: 16px;
    }

    .form-row mat-form-field {
      flex: 1;
    }

    .form-actions {
      display: flex;
      gap: 12px;
      align-items: center;
      flex-wrap: wrap;
      margin-top: 8px;
    }

    .form-actions button mat-icon {
      margin-right: 4px;
      vertical-align: middle;
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .blocks-list {
      margin-top: 24px;
    }

    .block-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 0;
      border-bottom: 1px solid rgba(0, 0, 0, 0.08);
    }

    .empty {
      padding: 16px;
      text-align: center;
      color: var(--qf-text-muted);
    }

    .warning {
      color: var(--qf-warning);
      margin-bottom: 16px;
    }
  `]
})
export class BlocksManagerComponent implements OnInit {
  blockForm: FormGroup;
  myBlocks: AvailabilityBlock[] = [];
  loading = false;
  code = '';
  groupId = '';
  userId = '';
  preferredCount = 0;
  minToHhmm = minToHhmm;
  formatDateDDMMYYYY = formatDateDDMMYYYY;
  minDate: Date = new Date();
  maxDate: Date = new Date();
  planningRangeHint = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private blocksService: BlocksService,
    private groupService: GroupService,
    private authService: AuthService,
    private notification: NotificationService,
    private dialog: MatDialog
  ) {
    this.blockForm = this.fb.group({
      mode: ['single'],
      type: ['WORK', Validators.required],
      date: [new Date()],
      day_from: [1],
      day_to: [5],
      start_time: ['09:00', [Validators.required, Validators.pattern(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/)]],
      end_time: ['17:00', [Validators.required, Validators.pattern(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/)]]
    });
  }

  readonly weekdayOptions: { value: number; label: string }[] = [
    { value: 1, label: 'Lunes' },
    { value: 2, label: 'Martes' },
    { value: 3, label: 'Miércoles' },
    { value: 4, label: 'Jueves' },
    { value: 5, label: 'Viernes' },
    { value: 6, label: 'Sábado' },
    { value: 7, label: 'Domingo' }
  ];

  isFormValid(): boolean {
    const form = this.blockForm;
    if (form.invalid) return false;
    const mode = form.get('mode')?.value;
    if (mode === 'single') {
      return !!form.get('date')?.value;
    }
    if (mode === 'fixed') {
      return form.get('day_from')?.value != null && form.get('day_to')?.value != null;
    }
    return false;
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
        this.groupId = group.id;
        this.minDate = new Date(group.planning_start_date);
        this.maxDate = new Date(group.planning_end_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (this.minDate < today) this.minDate = today;
        this.planningRangeHint = `Rango: ${formatDateDDMMYYYY(group.planning_start_date)} a ${formatDateDDMMYYYY(group.planning_end_date)}`;
        this.loadMyBlocks();
      },
      error: (err) => {
        console.error(err);
      }
    });

    this.authService.getCurrentUser().subscribe(user => {
      if (user) {
        this.userId = user.id;
      }
    });
  }

  loadMyBlocks() {
    if (!this.groupId || !this.userId) return;

    this.blocksService.getUserBlocks(this.groupId, this.userId).subscribe({
      next: (blocks) => {
        this.myBlocks = blocks;
        const rangeStart = this.minDate.toISOString().split('T')[0];
        const rangeEnd = this.maxDate.toISOString().split('T')[0];
        this.preferredCount = blocks.filter(
          b => b.type === 'PREFERRED' && b.date >= rangeStart && b.date <= rangeEnd
        ).length;
      },
      error: (err) => {
        console.error(err);
      }
    });
  }

  async onSubmit() {
    if (!this.isFormValid()) return;

    this.loading = true;
    const formValue = this.blockForm.value;
    const today = new Date().toISOString().split('T')[0];
    const minStr = this.minDate.toISOString().split('T')[0];
    const maxStr = this.maxDate.toISOString().split('T')[0];

    if (formValue.mode === 'single') {
      const date = new Date(formValue.date);
      const dateStr = date.toISOString().split('T')[0];
      if (dateStr < today) {
        this.loading = false;
        this.notification.error('No se pueden crear bloques en fechas pasadas');
        return;
      }
      if (dateStr < minStr || dateStr > maxStr) {
        this.notification.error('La fecha debe estar dentro del rango de planificación del grupo');
        this.loading = false;
        return;
      }
      const startMin = hhmmToMin(formValue.start_time);
      const endMin = hhmmToMin(formValue.end_time);
      const overlapsExisting = this.myBlocks.some(
        b => b.date === dateStr && b.type === formValue.type &&
          timeRangesOverlap(b.start_min, b.end_min, startMin, endMin)
      );
      if (overlapsExisting) {
        this.loading = false;
        this.notification.error('Ya existe un bloque con el mismo tipo y horario solapado en esa fecha');
        return;
      }
      try {
        await this.blocksService.addBlock({
          group_id: this.groupId,
          type: formValue.type,
          date: dateStr,
          start_min: startMin,
          end_min: endMin
        }).toPromise();
        this.resetForm();
        this.loadMyBlocks();
        this.loading = false;
        this.notification.success('Bloque añadido correctamente', 2000);
      } catch (error: any) {
        const msg = error?.message || error?.error_description || 'Error al añadir bloque';
        this.notification.error(msg.includes('planificación') || msg.includes('pasada') ? msg : 'Error al añadir bloque. Verifica el rango de fechas.', 'Cerrar', 5000);
        this.loading = false;
      }
      return;
    }

    if (formValue.mode === 'fixed') {
      const startMin = hhmmToMin(formValue.start_time);
      const endMin = hhmmToMin(formValue.end_time);
      const dayFrom = Number(formValue.day_from);
      const dayTo = Number(formValue.day_to);
      const dayMin = Math.min(dayFrom, dayTo);
      const dayMax = Math.max(dayFrom, dayTo);

      const dtos: Array<{ group_id: string; type: 'WORK' | 'UNAVAILABLE' | 'PREFERRED'; date: string; start_min: number; end_min: number }> = [];
      const start = new Date(this.minDate.getFullYear(), this.minDate.getMonth(), this.minDate.getDate());
      const end = new Date(this.maxDate.getFullYear(), this.maxDate.getMonth(), this.maxDate.getDate());
      let d = new Date(start);
      while (d <= end) {
        const dateStr = d.toISOString().split('T')[0];
        if (dateStr >= today) {
          const jsDow = d.getDay();
          const dow = jsDow === 0 ? 7 : jsDow;
          if (dow >= dayMin && dow <= dayMax) {
            dtos.push({
              group_id: this.groupId,
              type: formValue.type,
              date: dateStr,
              start_min: startMin,
              end_min: endMin
            });
          }
        }
        d.setDate(d.getDate() + 1);
      }

      const filteredDtos = dtos.filter(dto => {
        const overlapsExisting = this.myBlocks.some(
          b => b.date === dto.date && b.type === dto.type &&
            timeRangesOverlap(b.start_min, b.end_min, dto.start_min, dto.end_min)
        );
        if (overlapsExisting) return false;
        return true;
      });

      const dedupedDtos: typeof dtos = [];
      for (const dto of filteredDtos) {
        const overlapsInBatch = dedupedDtos.some(
          a => a.date === dto.date && a.type === dto.type &&
            timeRangesOverlap(a.start_min, a.end_min, dto.start_min, dto.end_min)
        );
        if (!overlapsInBatch) dedupedDtos.push(dto);
      }

      if (dedupedDtos.length === 0) {
        this.loading = false;
        if (dtos.length > 0 && filteredDtos.length === 0) {
          this.notification.error('Todos los bloques solapan con bloques existentes');
        } else {
          this.notification.error('No hay fechas válidas en el rango (solo se consideran fechas futuras)');
        }
        return;
      }

      const skippedCount = dtos.length - dedupedDtos.length;
      if (skippedCount > 0) {
        this.notification.info(`Se omitieron ${skippedCount} bloque(s) que solapaban con existentes`);
      }

      try {
        const result = await this.blocksService.addBlocksBulk(dedupedDtos).toPromise();
        this.resetForm();
        this.loadMyBlocks();
        this.loading = false;
        this.notification.success(`${result?.inserted ?? 0} bloques añadidos (horario fijo)`, 3000);
      } catch (error: any) {
        const msg = error?.message || error?.error_description || 'Error al añadir bloques';
        this.notification.error(msg, 'Cerrar', 5000);
        this.loading = false;
      }
    }
  }

  private resetForm() {
    this.blockForm.patchValue({
      type: 'WORK',
      date: this.minDate,
      day_from: 1,
      day_to: 5,
      start_time: '09:00',
      end_time: '17:00'
    });
  }

  deleteBlock(blockId: string) {
    const data: ConfirmDialogData = {
      title: 'Eliminar bloque',
      message: '¿Eliminar este bloque?',
      confirmText: 'Eliminar',
      confirmWarn: true
    };
    this.dialog.open(ConfirmDialogComponent, { data, width: '400px' }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.blocksService.deleteBlock(blockId).subscribe({
        next: () => {
          this.loadMyBlocks();
          this.notification.success('Bloque eliminado');
        },
        error: (err) => {
          this.notification.error(err?.message ?? 'Error al eliminar bloque');
          console.error(err);
        }
      });
    });
  }
}

