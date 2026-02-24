import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-hero-section',
  standalone: true,
  imports: [CommonModule, RouterModule, MatButtonModule, MatIconModule],
  template: `
    <section class="hero">
      <div class="hero-content">
        <h1 class="hero-title">Organiza reuniones sin caos.</h1>
        <p class="hero-subtitle">
          Sube tu horario, encuentra los mejores huecos automáticamente y deja que el sistema calcule por ti.
        </p>
        <div class="hero-actions">
          <button mat-raised-button color="primary" routerLink="/login">
            Crear grupo
          </button>
          <button mat-stroked-button color="primary" type="button" (click)="viewHowItWorks.emit()">
            <mat-icon>play_circle</mat-icon>
            Ver cómo funciona
          </button>
        </div>
        <p class="hero-caption">
          Ideal para equipos con turnos rotativos, guardias y horarios cambiantes.
        </p>
      </div>

      <div class="hero-visual">
        <div class="hero-card">
          <div class="hero-card-header">
            <span class="badge">Vista planner</span>
            <span class="dot"></span>
          </div>
          <div class="hero-card-body">
            <div class="slot" *ngFor="let slot of sampleSlots">
              <div class="slot-time">{{ slot.time }}</div>
              <div class="slot-bar" [ngClass]="slot.color">
                <span class="slot-label">{{ slot.label }}</span>
              </div>
            </div>
          </div>
          <div class="hero-card-footer">
            <span class="hint">Mockup ilustrativo · No es un dato real</span>
          </div>
        </div>
      </div>
    </section>
  `,
  styles: [`
    .hero {
      display: grid;
      grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr);
      gap: 40px;
      align-items: center;
      padding: 40px 16px 32px;
      max-width: 1120px;
      margin: 0 auto;
    }

    .hero-content {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .hero-title {
      margin: 0;
      font-size: clamp(2.2rem, 3vw, 2.8rem);
      font-weight: 700;
      letter-spacing: -0.03em;
    }

    .hero-subtitle {
      margin: 0;
      font-size: 1.05rem;
      color: #555;
      line-height: 1.6;
    }

    .hero-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: center;
    }

    .hero-actions button mat-icon {
      margin-right: 6px;
    }

    .hero-caption {
      margin: 0;
      font-size: 0.9rem;
      color: #777;
    }

    .hero-visual {
      display: flex;
      justify-content: center;
    }

    .hero-card {
      width: 100%;
      max-width: 360px;
      border-radius: 16px;
      padding: 16px 16px 12px;
      background: linear-gradient(135deg, #f3f6ff, #ffffff);
      box-shadow: 0 18px 45px rgba(15, 23, 42, 0.16);
      border: 1px solid rgba(120, 144, 255, 0.25);
    }

    .hero-card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }

    .badge {
      padding: 4px 10px;
      border-radius: 999px;
      background: rgba(63, 81, 181, 0.08);
      color: #3f51b5;
      font-size: 0.75rem;
      font-weight: 500;
    }

    .dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #4caf50;
      box-shadow: 0 0 0 4px rgba(76, 175, 80, 0.25);
    }

    .hero-card-body {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 10px;
    }

    .slot {
      display: grid;
      grid-template-columns: 72px minmax(0, 1fr);
      gap: 8px;
      align-items: center;
      font-size: 0.85rem;
    }

    .slot-time {
      color: #666;
    }

    .slot-bar {
      position: relative;
      border-radius: 999px;
      padding: 4px 10px;
      color: #fff;
      font-size: 0.8rem;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }

    .slot-bar.green {
      background: linear-gradient(90deg, #43a047, #66bb6a);
    }

    .slot-bar.yellow {
      background: linear-gradient(90deg, #f9a825, #ffca28);
    }

    .slot-bar.red {
      background: linear-gradient(90deg, #e53935, #ef5350);
    }

    .slot-label {
      position: relative;
      z-index: 1;
    }

    .hero-card-footer {
      font-size: 0.75rem;
      color: #888;
      text-align: right;
    }

    .hint {
      font-style: italic;
    }

    @media (max-width: 900px) {
      .hero {
        grid-template-columns: minmax(0, 1fr);
        padding-top: 24px;
      }

      .hero-visual {
        order: -1;
      }
    }

    @media (max-width: 600px) {
      .hero-card {
        max-width: 100%;
      }
    }
  `]
})
export class HeroSectionComponent {
  @Output() viewHowItWorks = new EventEmitter<void>();

  sampleSlots = [
    { time: 'Mar 19:00', label: 'Alta disponibilidad', color: 'green' },
    { time: 'Jue 17:30', label: 'Buen equilibrio', color: 'yellow' },
    { time: 'Sáb 10:00', label: 'Difícil cuadrar', color: 'red' }
  ];
}

