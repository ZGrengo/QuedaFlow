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
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { BlocksService } from '../../../core/services/blocks.service';
import { GroupService } from '../../../core/services/group.service';
import { AuthService } from '../../../core/services/auth.service';
import { AvailabilityBlock } from '@domain/index';
import { minToHhmm, hhmmToMin } from '@domain/index';
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
          <mat-card-subtitle>Añade las horas en las que trabajas (WORK) y otros momentos en los que no estás disponible (UNAVAILABLE). Los huecos libres se calcularán automáticamente.</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <form [formGroup]="blockForm" (ngSubmit)="onSubmit()">
            <div class="form-row">
              <mat-form-field appearance="outline">
                <mat-label>Tipo</mat-label>
                <mat-select formControlName="type" required>
                  <mat-option value="WORK">Trabajo (horas ocupadas)</mat-option>
                  <mat-option value="UNAVAILABLE">No disponible (reuniones, citas, etc.)</mat-option>
                  <mat-option value="PREFERRED">Preferido (horas libres que prefieres)</mat-option>
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Fecha</mat-label>
                <input matInput [matDatepicker]="picker" formControlName="date" required
                  [min]="minDate" [max]="maxDate">
                <mat-datepicker-toggle matSuffix [for]="picker"></mat-datepicker-toggle>
                <mat-datepicker #picker [startAt]="minDate"></mat-datepicker>
                <mat-hint *ngIf="planningRangeHint">{{ planningRangeHint }}</mat-hint>
              </mat-form-field>
            </div>

            <div class="form-row">
              <mat-form-field appearance="outline">
                <mat-label>Inicio (HH:MM)</mat-label>
                <input matInput formControlName="start_time" placeholder="09:00" required>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Fin (HH:MM)</mat-label>
                <input matInput formControlName="end_time" placeholder="17:00" required>
              </mat-form-field>
            </div>

            <div *ngIf="preferredCount >= 3 && blockForm.get('type')?.value === 'PREFERRED'" class="warning">
              Máximo 3 bloques PREFERRED permitidos
            </div>

            <div class="form-actions">
              <button mat-raised-button class="qf-btn-primary" type="submit" [disabled]="blockForm.invalid || loading">
                Añadir Bloque
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
    private snackBar: MatSnackBar
  ) {
    this.blockForm = this.fb.group({
      type: ['WORK', Validators.required],
      date: [new Date(), Validators.required],
      start_time: ['09:00', [Validators.required, Validators.pattern(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/)]],
      end_time: ['17:00', [Validators.required, Validators.pattern(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/)]]
    });
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
    if (this.blockForm.invalid) return;

    this.loading = true;
    const formValue = this.blockForm.value;
    const date = new Date(formValue.date);
    const dateStr = date.toISOString().split('T')[0];
    const today = new Date().toISOString().split('T')[0];

    if (dateStr < today) {
      this.loading = false;
      this.snackBar.open('No se pueden crear bloques en fechas pasadas', 'Cerrar', { duration: 4000 });
      return;
    }
    if (dateStr < this.minDate.toISOString().split('T')[0] || dateStr > this.maxDate.toISOString().split('T')[0]) {
      this.snackBar.open('La fecha debe estar dentro del rango de planificación del grupo', 'Cerrar', { duration: 4000 });
      return;
    }

    try {
      const startMin = hhmmToMin(formValue.start_time);
      const endMin = hhmmToMin(formValue.end_time);

      await this.blocksService.addBlock({
        group_id: this.groupId,
        type: formValue.type,
        date: dateStr,
        start_min: startMin,
        end_min: endMin
      }).toPromise();

      this.blockForm.reset({
        type: 'WORK',
        date: this.minDate,
        start_time: '09:00',
        end_time: '17:00'
      });

      this.loadMyBlocks();
      this.loading = false;
      this.snackBar.open('Bloque añadido correctamente', undefined, { duration: 2000 });
    } catch (error: any) {
      const msg = error?.message || error?.error_description || 'Error al añadir bloque';
      this.snackBar.open(msg.includes('planificación') || msg.includes('pasada') ? msg : 'Error al añadir bloque. Verifica el rango de fechas.', 'Cerrar', { duration: 5000 });
      this.loading = false;
    }
  }

  deleteBlock(blockId: string) {
    if (!confirm('¿Eliminar este bloque?')) return;

    this.blocksService.deleteBlock(blockId).subscribe({
      next: () => {
        this.loadMyBlocks();
      },
      error: (err) => {
        alert('Error al eliminar bloque');
        console.error(err);
      }
    });
  }
}

