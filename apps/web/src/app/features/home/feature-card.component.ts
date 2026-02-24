import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-feature-card',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="feature-card">
      <div class="feature-icon" *ngIf="icon">
        <mat-icon>{{ icon }}</mat-icon>
      </div>
      <h3 class="feature-title">{{ title }}</h3>
      <p class="feature-description">
        {{ description }}
      </p>
    </div>
  `,
  styles: [`
    .feature-card {
      background: var(--qf-surface);
      border-radius: 16px;
      padding: 20px 18px 18px;
      border: 1px solid rgba(0, 0, 0, 0.06);
      box-shadow: 0 2px 12px rgba(18, 12, 36, 0.06);
      display: flex;
      flex-direction: column;
      gap: 10px;
      height: 100%;
    }

    .feature-icon {
      width: 40px;
      height: 40px;
      border-radius: 12px;
      background: rgba(203, 37, 70, 0.1);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--qf-primary);
    }

    .feature-icon mat-icon {
      font-size: 22px;
      width: 22px;
      height: 22px;
    }

    .feature-title {
      margin: 0;
      font-size: 1rem;
      font-weight: 600;
    }

    .feature-description {
      margin: 0;
      font-size: 0.95rem;
      color: var(--qf-text-muted);
      line-height: 1.5;
    }
  `]
})
export class FeatureCardComponent {
  @Input() icon: string | null = null;
  @Input() title = '';
  @Input() description = '';
}

