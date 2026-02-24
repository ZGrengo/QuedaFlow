import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { PlannerService } from '../../../core/services/planner.service';
import { ComputedSlot } from '@domain/index';
import { minToHhmm } from '@domain/index';

@Component({
  selector: 'app-planner-view',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule
  ],
  template: `
    <div class="qf-page container">
      <div class="nav-back">
        <button mat-stroked-button [routerLink]="['/g', code]">
          <mat-icon>arrow_back</mat-icon>
          Volver al grupo
        </button>
      </div>
      <mat-card class="qf-surface">
        <mat-card-header>
          <mat-card-title>Mejores Huecos Disponibles</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <div *ngIf="loading" class="loading">Calculando huecos...</div>
          <div *ngIf="error" class="error">{{ error }}</div>

          <div *ngIf="!loading && !error" class="slots-grid">
            <mat-card *ngFor="let slot of topSlots" [class]="'slot-card slot-' + slot.color">
              <mat-card-content>
                <div class="slot-header">
                  <strong>{{ slot.date | date:'dd/MM/yyyy' }}</strong>
                  <span>{{ minToHhmm(slot.start_min) }} - {{ minToHhmm(slot.end_min) }}</span>
                </div>
                <div class="slot-info">
                  <mat-chip-set>
                    <mat-chip>{{ (slot.pct_available * 100).toFixed(0) }}% disponible</mat-chip>
                    <mat-chip *ngIf="slot.preferred_count > 0">{{ slot.preferred_count }} preferidos</mat-chip>
                  </mat-chip-set>
                </div>
              </mat-card-content>
            </mat-card>
          </div>

          <div *ngIf="!loading && !error && topSlots.length === 0" class="empty">
            No hay huecos disponibles. Añade bloques de disponibilidad primero.
          </div>
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

    .loading, .error, .empty {
      padding: 16px;
      text-align: center;
    }

    .loading, .empty {
      color: var(--qf-text-muted);
    }

    .error {
      color: var(--qf-primary);
    }

    .slots-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 16px;
      margin-top: 16px;
    }

    .slot-card {
      min-height: 120px;
    }

    .slot-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
    }

    .slot-info {
      margin-top: 8px;
    }
  `]
})
export class PlannerViewComponent implements OnInit {
  code = '';
  topSlots: ComputedSlot[] = [];
  loading = true;
  error = '';
  minToHhmm = minToHhmm;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private plannerService: PlannerService
  ) {}

  ngOnInit() {
    const code = this.route.snapshot.paramMap.get('code');
    if (!code) {
      this.router.navigate(['/login']);
      return;
    }
    this.code = code;

    this.plannerService.getTopSlots(code, 20).subscribe({
      next: (slots) => {
        this.topSlots = slots;
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Error al calcular huecos';
        this.loading = false;
        console.error(err);
      }
    });
  }
}

