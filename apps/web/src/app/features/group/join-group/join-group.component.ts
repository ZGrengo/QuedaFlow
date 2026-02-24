import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { GroupService } from '../../../core/services/group.service';

@Component({
  selector: 'app-join-group',
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
    <div class="qf-page container">
      <mat-card class="qf-surface">
        <mat-card-header>
          <mat-card-title>Unirse a Grupo</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <form [formGroup]="joinForm" (ngSubmit)="onSubmit()">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Código del Grupo</mat-label>
              <input matInput formControlName="code" required maxlength="6" (input)="onCodeInput($event)">
              <mat-error *ngIf="joinForm.get('code')?.hasError('required')">
                Código es requerido
              </mat-error>
            </mat-form-field>

            <div *ngIf="message" class="message" [class.error]="isError">
              {{ message }}
            </div>

            <button mat-raised-button class="qf-btn-primary full-width" type="submit" [disabled]="joinForm.invalid || loading">
              {{ loading ? 'Uniéndose...' : 'Unirse' }}
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

    mat-card {
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
      background-color: rgba(162, 211, 194, 0.25);
      color: #1a5c4a;
    }

    .message.error {
      background-color: rgba(203, 37, 70, 0.12);
      color: var(--qf-primary);
    }
  `]
})
export class JoinGroupComponent implements OnInit {
  joinForm: FormGroup;
  loading = false;
  message = '';
  isError = false;

  constructor(
    private fb: FormBuilder,
    private groupService: GroupService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.joinForm = this.fb.group({
      code: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(6)]]
    });
  }

  ngOnInit() {
    const codeParam = this.route.snapshot.queryParamMap.get('code');
    if (codeParam) {
      const normalized = String(codeParam).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
      this.joinForm.patchValue({ code: normalized }, { emitEvent: false });
      if (normalized.length === 6 && this.joinForm.valid) {
        this.doJoin(normalized);
      }
    }
  }

  onCodeInput(event: any) {
    const value = event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    this.joinForm.patchValue({ code: value }, { emitEvent: false });
  }

  onSubmit() {
    if (this.joinForm.invalid) return;
    this.doJoin(this.joinForm.value.code);
  }

  private doJoin(code: string) {
    this.loading = true;
    this.message = '';
    this.isError = false;

    this.groupService.joinGroupByCode(code).subscribe({
      next: (group) => {
        this.router.navigate(['/g', group.code]);
      },
      error: (error: any) => {
        this.message = error.message || 'Error al unirse al grupo. Verifica el código.';
        this.isError = true;
        this.loading = false;
      }
    });
  }
}

