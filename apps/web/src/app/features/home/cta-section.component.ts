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
          <button mat-raised-button color="primary" [routerLink]="primaryLink">
            {{ primaryLabel }}
          </button>
          <button *ngIf="secondaryLabel" mat-stroked-button color="primary" [routerLink]="secondaryLink">
            {{ secondaryLabel }}
          </button>
        </div>
      </div>
    </section>
  `,
  styles: [`
    .cta {
      padding: 48px 16px 56px;
      background: radial-gradient(circle at top left, rgba(63, 81, 181, 0.08), transparent 55%),
                  radial-gradient(circle at bottom right, rgba(0, 150, 136, 0.08), transparent 55%),
                  #f5f7fb;
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
    }

    .cta-subtitle {
      margin: 0 0 24px 0;
      font-size: 1rem;
      color: #555;
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

