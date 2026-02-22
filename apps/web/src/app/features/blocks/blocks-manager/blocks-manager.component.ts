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
import { BlocksService } from '../../../core/services/blocks.service';
import { GroupService } from '../../../core/services/group.service';
import { AuthService } from '../../../core/services/auth.service';
import { AvailabilityBlock } from '@domain/index';
import { minToHhmm, hhmmToMin } from '@domain/index';

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
    MatChipsModule
  ],
  template: `
    <div class="container">
      <div class="nav-back">
        <button mat-stroked-button [routerLink]="['/g', code]">
          <mat-icon>arrow_back</mat-icon>
          Volver al grupo
        </button>
      </div>
      <mat-card>
        <mat-card-header>
          <mat-card-title>Gestionar Bloques de Disponibilidad</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <form [formGroup]="blockForm" (ngSubmit)="onSubmit()">
            <div class="form-row">
              <mat-form-field appearance="outline">
                <mat-label>Tipo</mat-label>
                <mat-select formControlName="type" required>
                  <mat-option value="WORK">WORK</mat-option>
                  <mat-option value="UNAVAILABLE">UNAVAILABLE</mat-option>
                  <mat-option value="PREFERRED">PREFERRED</mat-option>
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Fecha</mat-label>
                <input matInput [matDatepicker]="picker" formControlName="date" required>
                <mat-datepicker-toggle matSuffix [for]="picker"></mat-datepicker-toggle>
                <mat-datepicker #picker></mat-datepicker>
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

            <button mat-raised-button color="primary" type="submit" [disabled]="blockForm.invalid || loading">
              Añadir Bloque
            </button>
          </form>
        </mat-card-content>
      </mat-card>

      <mat-card class="blocks-list">
        <mat-card-header>
          <mat-card-title>Mis Bloques</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <div *ngFor="let block of myBlocks" class="block-item">
            <mat-chip-set>
              <mat-chip>{{ block.type }}</mat-chip>
              <mat-chip>{{ block.date }}</mat-chip>
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

    .blocks-list {
      margin-top: 24px;
    }

    .block-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 0;
      border-bottom: 1px solid #e0e0e0;
    }

    .empty {
      padding: 16px;
      text-align: center;
      color: #666;
    }

    .warning {
      color: #f57c00;
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

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private blocksService: BlocksService,
    private groupService: GroupService,
    private authService: AuthService
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
        this.preferredCount = blocks.filter(b => b.type === 'PREFERRED').length;
      },
      error: (err) => {
        console.error(err);
      }
    });
  }

  async onSubmit() {
    if (this.blockForm.invalid) return;

    const formValue = this.blockForm.value;
    const date = new Date(formValue.date);
    const dateStr = date.toISOString().split('T')[0];

    try {
      const startMin = hhmmToMin(formValue.start_time);
      const endMin = hhmmToMin(formValue.end_time);

      await this.blocksService.addBlock({
        group_id: this.groupId,
        type: formValue.type,
        date: dateStr,
        start_min: startMin,
        end_min: endMin
      }, 20).toPromise();

      this.blockForm.reset({
        type: 'WORK',
        date: new Date(),
        start_time: '09:00',
        end_time: '17:00'
      });

      this.loadMyBlocks();
    } catch (error: any) {
      alert(error.message || 'Error al añadir bloque');
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

