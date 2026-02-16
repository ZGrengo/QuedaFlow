import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
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
    MatChipsModule
  ],
  template: `
    <div class="container">
      <mat-card *ngIf="group">
        <mat-card-header>
          <mat-card-title>{{ group.name }}</mat-card-title>
          <mat-card-subtitle>Código: {{ group.code }}</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <div class="actions">
            <button mat-raised-button color="primary" routerLink="/g/{{ group.code }}/blocks">
              <mat-icon>event</mat-icon>
              Gestionar Bloques
            </button>
            <button mat-raised-button color="accent" routerLink="/g/{{ group.code }}/planner">
              <mat-icon>schedule</mat-icon>
              Ver Planner
            </button>
          </div>
          <div class="quick-actions" style="margin-top: 16px;">
            <button mat-stroked-button routerLink="/create-group">
              Crear Nuevo Grupo
            </button>
            <button mat-stroked-button routerLink="/join-group">
              Unirse a Grupo
            </button>
          </div>
        </mat-card-content>
      </mat-card>

      <div *ngIf="loading" class="loading">Cargando...</div>
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
      color: #c62828;
    }
  `]
})
export class GroupDetailComponent implements OnInit {
  group: Group | null = null;
  loading = true;
  error = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private groupService: GroupService,
    private authService: AuthService
  ) {}

  ngOnInit() {
    const code = this.route.snapshot.paramMap.get('code');
    if (!code) {
      this.router.navigate(['/login']);
      return;
    }

    this.groupService.getGroup(code).subscribe({
      next: (group) => {
        this.group = group;
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

