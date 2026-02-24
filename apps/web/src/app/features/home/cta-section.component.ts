import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-cta-section',
  standalone: true,
  imports: [CommonModule, RouterModule, MatButtonModule],
  template: `
    <section class="cta">
      <div class="cta-inner">
        <h2 class="cta-title">{{ title }}</h2>
        <p class="cta-subtitle">{{ subtitle }}</p>
        <div class="cta-actions">
          <button mat-raised-button class="qf-btn-primary" [routerLink]="primaryLink">
            {{ primaryLabel }}
          </button>
          <button *ngIf="secondaryLabel" mat-stroked-button [routerLink]="secondaryLink">
            {{ secondaryLabel }}
          </button>
        </div>
      </div>
    </section>
  `,
  styles: [`
    .cta {
      padding: clamp(32px, 4vw, 48px) 16px clamp(40px, 5vw, 56px);
      background: transparent;
    }

    .cta-inner {
      max-width: 760px;
      margin: 0 auto;
      text-align: center;
    }

    .cta-title {
      margin: 0 0 12px 0;
      font-size: clamp(1.8rem, 2.3vw, 2.1rem);
      font-weight: 700;
      letter-spacing: -0.02em;
      color: inherit;
    }

    .cta-subtitle {
      margin: 0 0 24px 0;
      font-size: 1rem;
      color: var(--qf-text-muted);
    }

    .cta-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      justify-content: center;
    }
  `]
})
export class CtaSectionComponent {
  @Input() title = '';
  @Input() subtitle = '';
  @Input() primaryLabel = 'Empezar';
  @Input() primaryLink = '/login';
  @Input() secondaryLabel?: string;
  @Input() secondaryLink = '/login';
}

