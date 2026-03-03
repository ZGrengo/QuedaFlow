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

          <div *ngIf="!loading && !error" class="slots-grid">
            <mat-card
              *ngFor="let slot of topSlots; let i = index"
              class="slot-card"
              [ngClass]="[
                'slot-accent--' + slot.color,
                slot.is_top ? 'slot-card--top' : ''
              ]"
            >
              <div class="slot-accent-bar"></div>
              <mat-card-content>
                <div class="slot-body">
                  <div class="slot-header">
                    <div class="slot-header-main">
                      <div class="slot-date">
                        {{ formatSlotDate(slot.date) }}
                      </div>
                      <div class="slot-time">
                        {{ minToHhmm(slot.start_min) }} – {{ minToHhmm(slot.end_min) }}
                      </div>
                    </div>
                    <div class="slot-badge" *ngIf="slot.is_top">
                      <mat-icon class="slot-badge-icon">emoji_events</mat-icon>
                      <span>Mejor opción</span>
                    </div>
                  </div>

                  <div class="slot-metrics">
                    <span
                      class="metric-pill metric-pill--availability"
                      *ngIf="(slot.total_members || memberCount) && (slot.available_count != null || slot.available_members)"
                      matTooltip="Miembros disponibles en este hueco (de {{ slot.total_members || memberCount }} en el grupo)"
                    >
                      {{ slot.available_count ?? slot.available_members.length }}/{{ slot.total_members || memberCount }} disponibles
                    </span>

                    <span
                      class="metric-pill metric-pill--pct"
                      *ngIf="slot.pct_available != null"
                    >
                      ({{ (slot.pct_available * 100) | number:'1.0-0' }}%)
                    </span>

                    <span
                      class="metric-pill metric-pill--preferred"
                      *ngIf="slot.preferred_count > 0"
                      matTooltip="Personas que marcaron este horario como preferido"
                    >
                      <span class="slot-preferred-star">⭐</span>
                      {{ slot.preferred_count }} preferidos
                    </span>
                  </div>
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
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 360px), 1fr));
      gap: 16px;
      margin-top: 16px;
    }

    .slot-card {
      position: relative;
      display: flex;
      align-items: stretch;
      gap: 14px;
      min-height: 112px;
      width: 100%;
      box-sizing: border-box;
      overflow: hidden;
      padding: 14px 16px;
      border-radius: 16px;
      transition:
        box-shadow 180ms ease,
        transform 180ms ease,
        background-color 180ms ease,
        border-color 180ms ease;
      border: 1px solid rgba(18, 12, 36, 0.08);
      background: var(--qf-surface, #ffffff);
      box-shadow: var(--qf-shadow, 0 10px 30px rgba(0, 0, 0, 0.12));
    }

    .slot-card:hover {
      transform: translateY(-2px);
      box-shadow:
        0 6px 16px rgba(0, 0, 0, 0.35);
    }

    .slot-card:active {
      transform: translateY(0) scale(0.985);
      box-shadow:
        0 4px 10px rgba(0, 0, 0, 0.4);
    }

    .slot-accent-bar {
      width: 8px;
      border-radius: 999px;
      align-self: stretch;
    }

    .slot-accent--green .slot-accent-bar {
      background: #3b82f6;
    }

    .slot-accent--yellow .slot-accent-bar {
      background: #ffd236;
    }

    .slot-accent--red .slot-accent-bar {
      background: #cb2546;
    }

    .slot-card--top {
      border-color: rgba(18, 12, 36, 0.18);
    }

    .slot-card--top.slot-accent--green {
      background: #e3f2ff;
      box-shadow:
        0 10px 30px rgba(0, 0, 0, 0.25),
        0 0 0 2px rgba(162, 211, 194, 0.35),
        0 0 24px rgba(162, 211, 194, 0.18);
    }

    .slot-card--top.slot-accent--yellow {
      box-shadow:
        0 0 0 1px rgba(255, 210, 54, 0.25),
        0 10px 26px rgba(255, 210, 54, 0.18);
    }

    .slot-card--top.slot-accent--red {
      box-shadow:
        0 0 0 1px rgba(203, 37, 70, 0.25),
        0 10px 26px rgba(203, 37, 70, 0.18);
    }

    .slot-card--top:hover {
      transform: translateY(-3px);
    }

    .slot-card--top:active {
      transform: translateY(0) scale(0.982);
    }

    .slot-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 8px;
      margin-bottom: 8px;
    }

    .slot-header-main {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }

    .slot-date {
      font-weight: 600;
      font-size: 0.95rem;
      letter-spacing: 0.01em;
      text-transform: uppercase;
      color: #1b1b1f;
    }

    .slot-time {
      font-size: 0.9rem;
      color: rgba(27, 27, 31, 0.75);
    }

    .slot-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 8px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.08);
      font-size: 0.76rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      white-space: nowrap;
    }

    .slot-badge-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
      color: #ffd236;
    }

    .slot-metrics {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 8px;
    }

    .metric-pill {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 6px 10px;
      border-radius: 999px;
      font-size: 0.85rem;
      color: #1b1b1f;
      background: rgba(27, 27, 31, 0.06);
    }

    .metric-pill--availability {
      background: rgba(162, 211, 194, 0.24);
    }

    .metric-pill--pct {
      background: rgba(27, 27, 31, 0.06);
    }

    .metric-pill--preferred {
      background: rgba(250, 116, 59, 0.14);
    }

    .slot-preferred-star {
      color: #fa743b;
      font-size: 0.95rem;
    }

    @media (max-width: 600px) {
      .slots-grid {
        grid-template-columns: 1fr;
        gap: 12px;
      }

      .slot-card {
        min-height: 0;
      }

      .slot-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 6px;
      }

      .slot-badge {
        margin-top: 2px;
      }

      .slot-metrics {
        gap: 6px 12px;
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
    return new Intl.DateTimeFormat('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'short'
    }).format(d);
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

