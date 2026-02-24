import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { GroupService } from '../../../core/services/group.service';
import { AuthService } from '../../../core/services/auth.service';
import { combineLatest } from 'rxjs';

@Component({
  selector: 'app-create-group',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule
  ],
  template: `
    <div class="qf-page container">
      <mat-card class="qf-surface">
        <mat-card-header>
          <mat-card-title>Crear Grupo</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <div *ngIf="atLimit" class="limit-message">
            <p class="limit-text">
              <mat-icon>info</mat-icon>
              Máximo 5 grupos creados. Elimina uno que hayas creado en el inicio para poder crear otro.
            </p>
            <button mat-stroked-button routerLink="/dashboard">Volver al inicio</button>
          </div>

          <form *ngIf="!atLimit" [formGroup]="createForm" (ngSubmit)="onSubmit()">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Nombre del Grupo</mat-label>
              <input matInput formControlName="name" required>
              <mat-error *ngIf="createForm.get('name')?.hasError('required')">
                Nombre es requerido
              </mat-error>
            </mat-form-field>

            <div *ngIf="message" class="message" [class.error]="isError">
              {{ message }}
            </div>

            <div class="actions">
              <button mat-button type="button" (click)="onCancel()">
                Cancelar
              </button>
              <button mat-raised-button class="qf-btn-primary" type="submit" [disabled]="createForm.invalid || loading">
                {{ loading ? 'Creando...' : 'Crear Grupo' }}
              </button>
            </div>
          </form>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 16px;
      box-sizing: border-box;
    }

    .login-card, mat-card {
      width: 100%;
      max-width: 400px;
    }

    .full-width {
      width: 100%;
    }

    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      margin-top: 16px;
    }

    .message {
      margin: 16px 0;
      padding: 12px;
      border-radius: 4px;
      background-color: rgba(162, 211, 194, 0.25);
      color: #1a5c4a;
    }

    .message.error {
      background-color: rgba(203, 37, 70, 0.12);
      color: var(--qf-primary);
    }

    .limit-message {
      padding: 16px 0;
    }

    .limit-text {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      margin: 0 0 16px 0;
      color: var(--qf-text-muted);
    }

    .limit-text mat-icon {
      color: var(--qf-warning);
      flex-shrink: 0;
      margin-top: 2px;
      font-size: 20px;
      width: 20px;
      height: 20px;
    }
  `]
})
export class CreateGroupComponent implements OnInit {
  createForm: FormGroup;
  loading = false;
  message = '';
  isError = false;
  atLimit = false;

  constructor(
    private fb: FormBuilder,
    private groupService: GroupService,
    private authService: AuthService,
    private router: Router
  ) {
    this.createForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]]
    });
  }

  ngOnInit(): void {
    combineLatest([
      this.authService.getCurrentUser(),
      this.groupService.getMyGroups()
    ]).subscribe(([user, groups]) => {
      const uid = user?.id;
      if (!uid) {
        this.atLimit = false;
        return;
      }
      const hostedCount = groups.filter(g => g.host_user_id === uid).length;
      this.atLimit = hostedCount >= 5;
    });
  }

  onCancel(): void {
    this.router.navigate(['/dashboard']);
  }

  onSubmit() {
    if (this.createForm.invalid) return;

    this.loading = true;
    this.message = '';
    this.isError = false;

    this.groupService.createGroup({ name: this.createForm.value.name }).subscribe({
      next: (group) => {
        this.router.navigate(['/g', group.code]);
      },
      error: (error: any) => {
        this.message = error.message || 'Error al crear el grupo';
        this.isError = true;
        this.loading = false;
      }
    });
  }
}

