import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
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
    MatChipsModule,
    MatTooltipModule
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
          <mat-card-title>Mejores Huecos Disponibles</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <div *ngIf="loading" class="loading">Calculando huecos...</div>
          <div *ngIf="error" class="error">{{ error }}</div>

          <div *ngIf="!loading && !error && topSlots.length > 0" class="planner-legend">
            <span class="legend-item legend-item--green">Alta disponibilidad</span>
            <span class="legend-item legend-item--yellow">Posible</span>
            <span class="legend-item legend-item--red">Difícil</span>
          </div>

          <div *ngIf="!loading && !error && topSlots.length > 0" class="slots-grid">
            <div
              *ngFor="let slot of topSlots; let i = index"
              class="slot-card"
              [ngClass]="[
                'slot-' + slot.color,
                slot.is_top ? 'slot-card--top' : ''
              ]"
            >
              <div class="slot-accent"></div>
              <div class="slot-body">
                <div class="slot-header">
                  <div class="slot-header-main">
                    <div class="slot-title">{{ formatSlotDate(slot.date) }}</div>
                    <div class="slot-time">{{ minToHhmm(slot.start_min) }} – {{ minToHhmm(slot.end_min) }}</div>
                  </div>
                  <div class="slot-top-badge" *ngIf="slot.is_top">
                    <mat-icon>emoji_events</mat-icon>
                    <span>Mejor opción</span>
                  </div>
                </div>

                <div class="slot-metrics">
                  <span
                    class="metric metric--availability"
                    *ngIf="(slot.total_members || memberCount) && (slot.available_count != null || slot.available_members)"
                    matTooltip="Miembros disponibles en este hueco (de {{ slot.total_members || memberCount }} en el grupo)"
                  >
                    {{ slot.available_count ?? slot.available_members.length }}/{{ slot.total_members || memberCount }} disponibles
                  </span>

                  <span
                    class="metric metric--pct"
                    *ngIf="slot.pct_available != null"
                  >
                    {{ (slot.pct_available * 100) | number:'1.0-0' }}%
                  </span>

                  <span
                    class="metric metric--preferred"
                    *ngIf="slot.preferred_count > 0"
                    matTooltip="Personas que marcaron este horario como preferido"
                  >
                    ⭐ {{ slot.preferred_count }} preferidos
                  </span>
                </div>
              </div>
            </div>
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

    .planner-legend {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 16px;
      margin-bottom: 4px;
    }

    .legend-item {
      display: inline-flex;
      align-items: center;
      padding: 6px 12px;
      border-radius: 999px;
      font-size: 0.8rem;
      font-weight: 500;
    }

    .legend-item--green {
      background: rgba(162, 211, 194, 0.22);
      color: #1a4c3f;
    }

    .legend-item--yellow {
      background: rgba(255, 210, 54, 0.2);
      color: #6b5200;
    }

    .legend-item--red {
      background: rgba(203, 37, 70, 0.12);
      color: #8b1a2e;
    }

    .slots-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 360px), 1fr));
      gap: 16px;
      margin-top: 16px;
    }

    .slot-card {
      display: flex;
      align-items: stretch;
      gap: 14px;
      width: 100%;
      box-sizing: border-box;
      overflow: hidden;
      padding: 18px 20px;
      border-radius: 18px;
      background: var(--qf-surface);
      border: 1px solid rgba(18, 12, 36, 0.08);
      box-shadow: var(--qf-shadow-soft);
      transition: transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease;
    }

    .slot-card:hover {
      transform: translateY(-2px);
      box-shadow: var(--qf-shadow);
    }

    .slot-card:active {
      transform: scale(0.99);
    }

    .slot-accent {
      width: 8px;
      border-radius: 999px;
      flex-shrink: 0;
    }

    .slot-green .slot-accent {
      background: var(--qf-success);
    }

    .slot-yellow .slot-accent {
      background: var(--qf-warning);
    }

    .slot-red .slot-accent {
      background: var(--qf-primary);
    }

    .slot-card--top {
      border: 2px solid var(--qf-success);
      box-shadow: var(--qf-shadow), 0 0 24px rgba(162, 211, 194, 0.18);
    }

    .slot-card--top:hover {
      transform: translateY(-2px);
      box-shadow: var(--qf-shadow), 0 0 24px rgba(162, 211, 194, 0.18);
    }

    .slot-card--top:active {
      transform: scale(0.99);
    }

    .slot-body {
      flex: 1;
      min-width: 0;
    }

    .slot-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
    }

    .slot-header-main {
      min-width: 0;
    }

    .slot-title {
      color: #1a1a1e;
      font-weight: 700;
      font-size: 1.15rem;
      letter-spacing: 0.01em;
    }

    .slot-time {
      color: #1a1a1e;
      font-size: 1rem;
      font-weight: 600;
      margin-top: 4px;
      letter-spacing: 0.02em;
    }

    .slot-top-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 12px;
      border-radius: 999px;
      background: rgba(255, 210, 54, 0.18);
      color: #6b5200;
      font-weight: 600;
      font-size: 0.85rem;
      white-space: nowrap;
    }

    .slot-top-badge mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .slot-metrics {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 16px;
    }

    .metric {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 12px;
      border-radius: 999px;
      font-size: 0.95rem;
      font-weight: 500;
    }

    .metric--availability {
      background: rgba(162, 211, 194, 0.22);
      color: #1a4c3f;
    }

    .metric--pct {
      background: rgba(18, 12, 36, 0.06);
      color: #1a1a1e;
    }

    .metric--preferred {
      background: rgba(250, 116, 59, 0.14);
      color: #7a3d16;
    }

    @media (max-width: 600px) {
      .planner-legend {
        gap: 8px;
        margin-bottom: 8px;
      }

      .legend-item {
        font-size: 0.75rem;
        padding: 5px 10px;
      }

      .slots-grid {
        grid-template-columns: 1fr;
        gap: 12px;
      }

      .slot-card {
        padding: 16px 18px;
        border-radius: 16px;
      }

      .slot-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 10px;
      }

      .slot-top-badge {
        margin-top: 2px;
      }

      .slot-metrics {
        gap: 8px;
        margin-top: 12px;
      }
    }
  `]
})
export class PlannerViewComponent implements OnInit {
  code = '';
  topSlots: ComputedSlot[] = [];
  loading = true;
  error = '';
  minToHhmm = minToHhmm;
  memberCount = 0;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private plannerService: PlannerService
  ) { }

  formatSlotDate(dateISO: string): string {
    if (!dateISO) return '';
    const d = new Date(dateISO + 'T00:00:00');
    const formatted = new Intl.DateTimeFormat('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'short'
    }).format(d);
    return formatted.toUpperCase();
  }

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
        this.memberCount = slots.length > 0 ? (slots[0].total_members ?? 0) : 0;
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

