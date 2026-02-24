import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AuthService } from '../../../core/services/auth.service';
import { GroupService, Group } from '../../../core/services/group.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatToolbarModule,
    MatTooltipModule,
    MatSnackBarModule
  ],
  template: `
    <div class="dashboard">
      <mat-toolbar color="primary" class="toolbar">
        <span class="title">QuedaFlow</span>
        <span class="spacer"></span>
        <span class="user-email">{{ userEmail }}</span>
        <button mat-icon-button (click)="signOut()" matTooltip="Cerrar sesión">
          <mat-icon>logout</mat-icon>
        </button>
      </mat-toolbar>

      <div class="content">
        <h1 class="welcome">Bienvenido</h1>
        <p class="subtitle">Crea un grupo o únete a uno existente para encontrar huecos entre compañeros.</p>

        <div class="cards">
          <mat-card class="action-card">
            <mat-card-header>
              <mat-card-title>
                <mat-icon>add_circle</mat-icon>
                Crear grupo
              </mat-card-title>
              <mat-card-subtitle>Crea un nuevo grupo y comparte el código con tus compañeros.</mat-card-subtitle>
            </mat-card-header>
            <mat-card-actions>
              <button *ngIf="canCreateGroup" mat-raised-button color="primary" routerLink="/create-group">
                Crear grupo
              </button>
              <div *ngIf="!canCreateGroup" class="limit-wrap">
                <p class="limit-message">
                  <mat-icon>info</mat-icon>
                  Máximo 5 grupos creados. Elimina uno que hayas creado para crear otro.
                </p>
                <button mat-raised-button disabled>Crear grupo</button>
              </div>
            </mat-card-actions>
          </mat-card>

          <mat-card class="action-card">
            <mat-card-header>
              <mat-card-title>
                <mat-icon>group_add</mat-icon>
                Unirse a un grupo
              </mat-card-title>
              <mat-card-subtitle>Introduce el código de 6 caracteres que te ha compartido el host.</mat-card-subtitle>
            </mat-card-header>
            <mat-card-content>
              <form [formGroup]="joinForm" (ngSubmit)="onJoinSubmit()">
                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Código del grupo</mat-label>
                  <input matInput formControlName="code" maxlength="6" placeholder="ABC123" (input)="onCodeInput($event)">
                  <mat-hint>6 caracteres</mat-hint>
                </mat-form-field>
                <div *ngIf="joinMessage" class="message" [class.error]="joinError">
                  {{ joinMessage }}
                </div>
                <button mat-raised-button color="accent" type="submit" [disabled]="joinForm.invalid || joinLoading" class="full-width">
                  {{ joinLoading ? 'Uniéndose...' : 'Unirse' }}
                </button>
              </form>
            </mat-card-content>
          </mat-card>
        </div>

        <section class="active-groups">
          <h2 class="section-title">
            <mat-icon>groups</mat-icon>
            Grupos activos
          </h2>
          <p *ngIf="myGroupsLoading" class="loading-groups">Cargando grupos...</p>
          <div *ngIf="!myGroupsLoading && myGroups.length === 0" class="no-groups">
            No tienes grupos aún. Crea uno o únete con un código arriba.
          </div>
          <div *ngIf="!myGroupsLoading && myGroups.length > 0" class="groups-list">
            <div *ngFor="let group of myGroups" class="group-item">
              <a [routerLink]="['/g', group.code]" class="group-item-link">
                <span class="group-name">{{ group.name }}</span>
                <span class="group-code">Código: {{ group.code }}</span>
                <mat-icon class="group-arrow">arrow_forward</mat-icon>
              </a>
              <ng-container *ngIf="isHost(group)">
                <button mat-icon-button color="warn" type="button" (click)="deleteGroup(group, $event)"
                  matTooltip="Eliminar grupo" class="leave-btn" [disabled]="actionGroupId === group.id">
                  <mat-icon *ngIf="actionGroupId !== group.id">delete</mat-icon>
                  <mat-icon *ngIf="actionGroupId === group.id" class="spinner">hourglass_empty</mat-icon>
                </button>
              </ng-container>
              <ng-container *ngIf="!isHost(group)">
                <button mat-icon-button color="warn" type="button" (click)="leaveGroup(group, $event)"
                  matTooltip="Dejar grupo" class="leave-btn" [disabled]="actionGroupId === group.id">
                  <mat-icon *ngIf="actionGroupId !== group.id">exit_to_app</mat-icon>
                  <mat-icon *ngIf="actionGroupId === group.id" class="spinner">hourglass_empty</mat-icon>
                </button>
              </ng-container>
            </div>
          </div>
        </section>
      </div>
    </div>
  `,
  styles: [`
    .dashboard {
      min-height: 100vh;
      background: #f5f5f5;
    }

    .toolbar {
      position: sticky;
      top: 0;
      z-index: 10;
    }

    .title {
      font-size: 1.25rem;
    }

    .spacer {
      flex: 1 1 auto;
    }

    .user-email {
      font-size: 0.875rem;
      margin-right: 8px;
      opacity: 0.9;
    }

    .content {
      max-width: 900px;
      margin: 0 auto;
      padding: 32px 16px;
    }

    .welcome {
      margin: 0 0 8px 0;
      font-size: 1.75rem;
    }

    .subtitle {
      color: #666;
      margin: 0 0 32px 0;
    }

    .cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 24px;
    }

    .action-card {
      padding: 20px;
    }

    .action-card mat-card-title {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .action-card mat-card-title mat-icon {
      font-size: 28px;
      width: 28px;
      height: 28px;
    }

    .action-card mat-card-actions,
    .action-card mat-card-content {
      padding-left: 0;
      padding-right: 0;
    }

    .limit-wrap {
      width: 100%;
    }

    .limit-message {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0 0 12px 0;
      padding: 12px;
      background: #fff3e0;
      color: #e65100;
      border-radius: 4px;
      font-size: 0.875rem;
    }

    .limit-message mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
      flex-shrink: 0;
    }

    .full-width {
      width: 100%;
    }

    .message {
      margin: 12px 0;
      padding: 10px;
      border-radius: 4px;
      background: #e3f2fd;
      color: #1976d2;
      font-size: 0.875rem;
    }

    .message.error {
      background: #ffebee;
      color: #c62828;
    }

    .active-groups {
      margin-top: 48px;
      padding-top: 24px;
      border-top: 1px solid #e0e0e0;
    }

    .section-title {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0 0 16px 0;
      font-size: 1.25rem;
    }

    .section-title mat-icon {
      font-size: 28px;
      width: 28px;
      height: 28px;
    }

    .loading-groups,
    .no-groups {
      color: #666;
      margin: 0;
    }

    .groups-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .group-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 0;
      background: #fff;
      border-radius: 8px;
      border: 1px solid #e0e0e0;
      transition: background 0.2s, border-color 0.2s;
      overflow: hidden;
    }

    .group-item:hover {
      border-color: #bdbdbd;
    }

    .group-item-link {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px;
      flex: 1;
      text-decoration: none;
      color: inherit;
      min-width: 0;
    }

    .group-item-link:hover {
      background: #f5f5f5;
    }

    .group-name {
      font-weight: 500;
      flex: 1;
    }

    .group-code {
      font-size: 0.875rem;
      color: #666;
    }

    .group-arrow {
      color: #666;
    }

    .leave-btn {
      flex-shrink: 0;
    }

    .leave-btn .spinner {
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `]
})
export class DashboardComponent {
  userEmail = '';
  joinForm: FormGroup;
  joinLoading = false;
  joinMessage = '';
  joinError = false;
  myGroups: Group[] = [];
  myGroupsLoading = true;
  currentUserId: string | null = null;
  actionGroupId: string | null = null;

  constructor(
    private authService: AuthService,
    private groupService: GroupService,
    private router: Router,
    private fb: FormBuilder,
    private snackBar: MatSnackBar
  ) {
    this.joinForm = this.fb.group({
      code: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(6)]]
    });

    this.authService.getCurrentUser().subscribe(user => {
      this.userEmail = user?.email ?? '';
      this.currentUserId = user?.id ?? null;
    });

    this.groupService.getMyGroups().subscribe({
      next: (groups) => {
        this.myGroups = groups;
        this.myGroupsLoading = false;
      },
      error: () => {
        this.myGroupsLoading = false;
      }
    });
  }

  onCodeInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    this.joinForm.patchValue({ code: value }, { emitEvent: false });
  }

  onJoinSubmit(): void {
    if (this.joinForm.invalid) return;

    this.joinLoading = true;
    this.joinMessage = '';
    this.joinError = false;

    this.groupService.joinGroupByCode(this.joinForm.value.code).subscribe({
      next: (group) => {
        this.router.navigate(['/g', group.code]);
      },
      error: (err: { message?: string }) => {
        this.joinMessage = err?.message ?? 'Error al unirse. Verifica el código.';
        this.joinError = true;
        this.joinLoading = false;
      }
    });
  }

  signOut(): void {
    this.authService.signOut().catch(() => {
      // Aun si falla Supabase, redirigir a login para no dejar sesión colgada
      this.router.navigate(['/login'], { replaceUrl: true });
    });
  }

  isHost(group: Group): boolean {
    return this.currentUserId !== null && group.host_user_id === this.currentUserId;
  }

  get hostedGroupsCount(): number {
    if (!this.currentUserId) return 0;
    return this.myGroups.filter(g => g.host_user_id === this.currentUserId).length;
  }

  get canCreateGroup(): boolean {
    return this.hostedGroupsCount < 5;
  }

  leaveGroup(group: Group, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (!confirm(`¿Dejar el grupo "${group.name}"? Ya no verás este grupo en tu lista.`)) return;
    this.actionGroupId = group.id;
    this.groupService.leaveGroup(group.id).subscribe({
      next: () => {
        this.myGroups = this.myGroups.filter(g => g.id !== group.id);
        this.actionGroupId = null;
        this.snackBar.open(`Has dejado el grupo ${group.name}`, undefined, { duration: 3000 });
      },
      error: (err: { message?: string }) => {
        this.actionGroupId = null;
        this.snackBar.open(err?.message ?? 'Error al dejar el grupo', 'Cerrar', { duration: 4000 });
      }
    });
  }

  deleteGroup(group: Group, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (!confirm(`¿Eliminar el grupo "${group.name}"? Se borrarán todos los datos del grupo (miembros, bloques, configuración). Esta acción no se puede deshacer.`)) return;
    this.actionGroupId = group.id;
    this.groupService.deleteGroup(group.id).subscribe({
      next: () => {
        this.myGroups = this.myGroups.filter(g => g.id !== group.id);
        this.actionGroupId = null;
        this.snackBar.open(`Grupo ${group.name} eliminado`, undefined, { duration: 3000 });
      },
      error: (err: { message?: string }) => {
        this.actionGroupId = null;
        this.snackBar.open(err?.message ?? 'Error al eliminar el grupo', 'Cerrar', { duration: 4000 });
      }
    });
  }
}
