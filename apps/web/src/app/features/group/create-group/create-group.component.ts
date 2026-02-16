import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { GroupService } from '../../../core/services/group.service';

@Component({
  selector: 'app-create-group',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule
  ],
  template: `
    <div class="container">
      <mat-card>
        <mat-card-header>
          <mat-card-title>Crear Grupo</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <form [formGroup]="createForm" (ngSubmit)="onSubmit()">
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

            <button mat-raised-button color="primary" type="submit" [disabled]="createForm.invalid || loading" class="full-width">
              {{ loading ? 'Creando...' : 'Crear Grupo' }}
            </button>
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
    }

    .login-card, mat-card {
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
  `]
})
export class CreateGroupComponent {
  createForm: FormGroup;
  loading = false;
  message = '';
  isError = false;

  constructor(
    private fb: FormBuilder,
    private groupService: GroupService,
    private router: Router
  ) {
    this.createForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]]
    });
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

