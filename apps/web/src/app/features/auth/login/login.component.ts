import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule
  ],
  template: `
    <div class="login-container">
      <mat-card class="login-card">
        <mat-card-header>
          <mat-card-title>QuedaFlow</mat-card-title>
          <mat-card-subtitle>Encuentra huecos de horarios entre compañeros</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <form [formGroup]="loginForm" (ngSubmit)="onSubmit()">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Email</mat-label>
              <input matInput type="email" formControlName="email" required>
              <mat-error *ngIf="loginForm.get('email')?.hasError('required')">
                Email es requerido
              </mat-error>
              <mat-error *ngIf="loginForm.get('email')?.hasError('email')">
                Email inválido
              </mat-error>
            </mat-form-field>

            <div *ngIf="message" class="message" [class.error]="isError">
              {{ message }}
            </div>

            <button mat-raised-button color="primary" type="submit" [disabled]="loginForm.invalid || loading" class="full-width">
              {{ loading ? 'Enviando...' : 'Enviar Magic Link' }}
            </button>
          </form>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .login-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 16px;
    }

    .login-card {
      width: 100%;
      max-width: 400px;
    }

    .full-width {
      width: 100%;
    }

    .message {
      margin: 16px 0;
      padding: 12px;
      border-radius: 4px;
      background-color: #e3f2fd;
      color: #1976d2;
    }

    .message.error {
      background-color: #ffebee;
      color: #c62828;
    }

    mat-card-content {
      padding-top: 16px;
    }
  `]
})
export class LoginComponent {
  loginForm: FormGroup;
  loading = false;
  message = '';
  isError = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });

    // Si ya hay sesión (p. ej. llegó desde el magic link), ir al dashboard
    this.authService.getCurrentUser().subscribe(user => {
      if (user) {
        this.router.navigate(['/dashboard'], { replaceUrl: true });
      }
    });
  }

  async onSubmit() {
    if (this.loginForm.invalid) return;

    this.loading = true;
    this.message = '';
    this.isError = false;

    try {
      await this.authService.signInWithMagicLink(this.loginForm.value.email);
      this.message = '¡Revisa tu email! Te hemos enviado un magic link para iniciar sesión.';
      this.isError = false;
    } catch (error: any) {
      this.message = error.message || 'Error al enviar el magic link';
      this.isError = true;
    } finally {
      this.loading = false;
    }
  }
}
