import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

export interface ConfirmDialogData {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmWarn?: boolean;
}

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content>
      <p>{{ data.message }}</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>{{ data.cancelText ?? 'Cancelar' }}</button>
      <button
        [mat-dialog-close]="true"
        [color]="data.confirmWarn ? 'warn' : 'primary'"
        mat-raised-button>
        {{ data.confirmText ?? 'Confirmar' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    h2[mat-dialog-title] {
      margin: 0 0 8px 0;
    }

    mat-dialog-content {
      padding: 0 0 8px 0;
    }

    mat-dialog-content p {
      margin: 0;
      white-space: pre-line;
      line-height: 1.5;
    }

    mat-dialog-actions {
      padding: 20px 24px 24px 24px;
      margin: 0;
      min-height: auto;
    }
  `]
})
export class ConfirmDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<ConfirmDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ConfirmDialogData
  ) { }
}
