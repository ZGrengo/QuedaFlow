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
      background: #ffffff;
      border-radius: 16px;
      padding: 20px 18px 18px;
      border: 1px solid #e0e0e0;
      box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06);
      display: flex;
      flex-direction: column;
      gap: 10px;
      height: 100%;
    }

    .feature-icon {
      width: 40px;
      height: 40px;
      border-radius: 12px;
      background: rgba(63, 81, 181, 0.1);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #3f51b5;
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
      color: #555;
      line-height: 1.5;
    }
  `]
})
export class FeatureCardComponent {
  @Input() icon: string | null = null;
  @Input() title = '';
  @Input() description = '';
}

