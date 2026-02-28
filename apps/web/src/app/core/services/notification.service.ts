import { Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

const SNACKBAR_OPTIONS = {
  duration: 3000,
  panelClass: ['qf-snackbar-centered'] as string[]
};

@Injectable({ providedIn: 'root' })
export class NotificationService {
  constructor(private snackBar: MatSnackBar) { }

  success(message: string, duration = 3000): void {
    this.snackBar.open(message, '', {
      ...SNACKBAR_OPTIONS,
      duration
    });
  }

  error(message: string, action = 'Cerrar', duration = 4000): void {
    this.snackBar.open(message, action, {
      ...SNACKBAR_OPTIONS,
      duration
    });
  }

  info(message: string, duration = 3000): void {
    this.snackBar.open(message, '', {
      ...SNACKBAR_OPTIONS,
      duration
    });
  }
}
