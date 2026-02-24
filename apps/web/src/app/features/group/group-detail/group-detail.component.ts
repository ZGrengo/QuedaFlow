import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { GroupService, Group } from '../../../core/services/group.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-group-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatSnackBarModule
  ],
  template: `
    <div class="qf-page container">
      <mat-card *ngIf="group" class="qf-surface">
        <mat-card-header>
          <mat-card-title>{{ group.name }}</mat-card-title>
          <mat-card-subtitle>Código: {{ group.code }}</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <div class="actions">
            <button mat-raised-button class="qf-btn-primary" routerLink="/g/{{ group.code }}/blocks">
              <mat-icon>event</mat-icon>
              Gestionar Bloques
            </button>
            <button mat-raised-button class="qf-btn-accent" routerLink="/g/{{ group.code }}/planner">
              <mat-icon>schedule</mat-icon>
              Ver Planner
            </button>
            <button *ngIf="isHost" mat-stroked-button routerLink="/g/{{ group.code }}/settings">
              <mat-icon>settings</mat-icon>
              Configuración
            </button>
            <button *ngIf="isHost" mat-stroked-button (click)="copyInviteLink()">
              <mat-icon>link</mat-icon>
              Copiar enlace de invitación
            </button>
          </div>
          <div class="quick-actions" style="margin-top: 16px;">
            <button mat-stroked-button routerLink="/dashboard">
              <mat-icon>home</mat-icon>
              Volver al inicio
            </button>
          </div>
        </mat-card-content>
      </mat-card>

      <div *ngIf="loading" class="loading qf-muted">Cargando...</div>
      <div *ngIf="error" class="error">{{ error }}</div>
    </div>
  `,
  styles: [`
    .container {
      padding: 16px;
    }

    .actions {
      display: flex;
      gap: 16px;
      margin-top: 16px;
    }

    .quick-actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .loading, .error {
      padding: 16px;
      text-align: center;
    }

    .error {
      color: var(--qf-primary);
    }
  `]
})
export class GroupDetailComponent implements OnInit {
  group: Group | null = null;
  loading = true;
  error = '';
  isHost = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private groupService: GroupService,
    private authService: AuthService,
    private snackBar: MatSnackBar
  ) { }

  copyInviteLink() {
    if (!this.group) return;
    const url = `${window.location.origin}/join-group?code=${encodeURIComponent(this.group.code)}`;
    navigator.clipboard.writeText(url).then(() => {
      this.snackBar.open('Enlace de invitación copiado al portapapeles', '', { duration: 3000 });
    }).catch(() => {
      this.snackBar.open('No se pudo copiar el enlace', '', { duration: 3000 });
    });
  }

  ngOnInit() {
    const code = this.route.snapshot.paramMap.get('code');
    if (!code) {
      this.router.navigate(['/login']);
      return;
    }

    this.groupService.getGroup(code).subscribe({
      next: (group) => {
        this.group = group;
        this.authService.getCurrentUser().subscribe(user => {
          this.isHost = user?.id === group.host_user_id;
        });
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Error al cargar el grupo';
        this.loading = false;
        console.error(err);
      }
    });
  }
}

