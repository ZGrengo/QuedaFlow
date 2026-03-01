import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatMenuModule } from '@angular/material/menu';
import { NotificationService } from '../../../core/services/notification.service';
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
    MatSnackBarModule,
    MatMenuModule
  ],
  template: `
    <div class="qf-page container">
      <mat-card *ngIf="group" class="qf-surface">
        <mat-card-header>
          <mat-card-title>{{ group.name }}</mat-card-title>
          <mat-card-subtitle>Código: <span class="code-copy" (click)="copyInviteLink()" title="Clic para copiar enlace de invitación">{{ group.code }}</span></mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <div class="actions qf-actions">
            <button mat-raised-button class="qf-btn-primary" routerLink="/g/{{ group.code }}/blocks">
              <mat-icon>event</mat-icon>
              Gestionar Bloques
            </button>
            <button mat-raised-button class="qf-btn-accent" routerLink="/g/{{ group.code }}/planner">
              <mat-icon>schedule</mat-icon>
              Ver Planner
            </button>
            <ng-container *ngIf="isHost">
              <button class="actions-more-desktop" mat-stroked-button routerLink="/g/{{ group.code }}/settings">
                <mat-icon>settings</mat-icon>
                Configuración
              </button>
              <button class="actions-more-desktop" mat-stroked-button (click)="copyInviteLink()">
                <mat-icon>link</mat-icon>
                Copiar enlace de invitación
              </button>
              <button class="actions-more-mobile" mat-stroked-button [matMenuTriggerFor]="moreMenu">
                <mat-icon>more_vert</mat-icon>
                Más
              </button>
              <mat-menu #moreMenu="matMenu">
                <button mat-menu-item routerLink="/g/{{ group.code }}/settings">
                  <mat-icon>settings</mat-icon>
                  <span>Configuración</span>
                </button>
                <button mat-menu-item (click)="copyInviteLink()">
                  <mat-icon>link</mat-icon>
                  <span>Copiar enlace de invitación</span>
                </button>
              </mat-menu>
            </ng-container>
          </div>
          <div class="quick-actions qf-row">
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
      margin-top: 16px;
    }

    .actions button mat-icon {
      margin-right: 4px;
      vertical-align: middle;
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .actions-more-mobile {
      display: none;
    }

    @media (max-width: 600px) {
      .actions-more-desktop {
        display: none !important;
      }

      .actions-more-mobile {
        display: inline-flex !important;
      }

      .actions button {
        min-height: 44px;
      }
    }

    .quick-actions {
      margin-top: 16px;
      gap: 8px;
    }

    @media (max-width: 600px) {
      .quick-actions button {
        min-height: 44px;
        width: 100%;
      }
    }

    .loading, .error {
      padding: 16px;
      text-align: center;
    }

    .error {
      color: var(--qf-primary);
    }

    .code-copy {
      cursor: pointer;
      text-decoration: underline;
      text-underline-offset: 2px;
    }

    .code-copy:hover {
      opacity: 0.85;
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
    private notification: NotificationService
  ) { }

  copyInviteLink() {
    if (!this.group) return;
    const url = `${window.location.origin}/join-group?code=${encodeURIComponent(this.group.code)}`;
    navigator.clipboard.writeText(url).then(() => {
      this.notification.success('Enlace de invitación copiado');
    }).catch(() => {
      this.notification.error('No se pudo copiar el enlace');
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

