import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { forkJoin } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { PlannerService } from '../../../core/services/planner.service';
import { Group, GroupService, GroupMember } from '../../../core/services/group.service';
import { AuthService } from '../../../core/services/auth.service';
import { ComputedSlot } from '@domain/index';
import { formatCalendarDateEs } from '../../../core/utils/timezone';
import { TimezoneService } from '../../../core/services/timezone.service';
import { LocalRangeDayInfo } from '../../../core/utils/timezone-conversion';

@Component({
  selector: 'app-planner-view',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatTooltipModule
  ],
  template: `
    <div class="qf-page container">
      <div class="nav-back">
        <button mat-stroked-button class="qf-btn-secondary" [routerLink]="['/g', code]">
          <mat-icon>arrow_back</mat-icon>
          Volver al grupo
        </button>
      </div>
      <mat-card class="qf-surface planner-main-card">
        <mat-card-header>
          <mat-card-title>Mejores Huecos Disponibles</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <div *ngIf="groupTimezoneLabel" class="timezone-banner">
            <p><strong>Horario del grupo:</strong> {{ groupTimezoneLabel }}</p>
            <p *ngIf="showDifferentUserTimezone">
              <strong>Tu zona horaria detectada:</strong> {{ userTimezoneLabel }}.
              Por ahora los horarios se muestran en la zona del grupo.
            </p>
          </div>

          <div *ngIf="loading" class="loading">Calculando huecos...</div>
          <div *ngIf="error" class="error">{{ error }}</div>

          <div *ngIf="!loading && !error && topSlots.length > 0" class="planner-legend">
            <span class="legend-item legend-item--green">Alta disponibilidad</span>
            <span class="legend-item legend-item--yellow">Posible</span>
            <span class="legend-item legend-item--red">Difícil</span>
          </div>

          <div *ngIf="!loading && !error && topSlots.length > 0" class="slots-grid">
            <div
              *ngFor="let slot of topSlots; let i = index"
              class="slot-card"
              tabindex="0"
              [ngClass]="[
                'slot-' + slot.color,
                slot.is_top ? 'slot-card--top' : ''
              ]"
            >
              <div class="slot-accent"></div>
              <div class="slot-body">
                <div class="slot-header">
                  <div class="slot-header-main">
                    <div class="slot-title">{{ formatSlotDate(slot.date) }}</div>
                    <div class="slot-time">
                      <span class="slot-time-label">Hora del grupo</span>
                      <span>{{ formatGroupSlotTime(slot) }}</span>
                    </div>
                    <div *ngIf="showDifferentUserTimezone" class="slot-time slot-time--user">
                      <span class="slot-time-label">Tu hora</span>
                      <span>{{ localTimePrefix(slot) }}{{ formatUserSlotTime(slot) }}</span>
                      <span *ngIf="userDayOffsetBadge(slot)" class="tz-day-badge">({{ userDayOffsetBadge(slot) }})</span>
                    </div>
                  </div>
                  <div class="slot-top-badge" *ngIf="slot.is_top">
                    <mat-icon>emoji_events</mat-icon>
                    <span>Mejor opción</span>
                  </div>
                </div>

                <div class="slot-metrics">
                  <span
                    class="metric metric--availability"
                    *ngIf="(slot.total_members || memberCount) && (slot.available_count != null || slot.available_members)"
                    matTooltip="Miembros disponibles en este hueco (de {{ slot.total_members || memberCount }} en el grupo)"
                  >
                    {{ slot.available_count ?? slot.available_members.length }}/{{ slot.total_members || memberCount }} disponibles
                  </span>

                  <span
                    class="metric metric--pct"
                    *ngIf="slot.pct_available != null"
                  >
                    {{ (slot.pct_available * 100) | number:'1.0-0' }}%
                  </span>

                  <span
                    class="metric metric--preferred"
                    *ngIf="slot.preferred_count > 0"
                    matTooltip="Personas que marcaron este horario como preferido"
                  >
                    ⭐ {{ slot.preferred_count }} preferidos
                  </span>
                </div>

                <p class="slot-hover-hint" *ngIf="groupMembers.length > 0">
                  <mat-icon inline>groups</mat-icon>
                  Pasa el ratón o enfoca la tarjeta para ver quién está disponible
                </p>

                <div class="slot-member-panel" *ngIf="groupMembers.length > 0" (click)="$event.stopPropagation()">
                  <div class="slot-member-columns">
                    <div class="slot-member-col slot-member-col--ok">
                      <div class="slot-member-col-title">Disponibles</div>
                      <ul>
                        <li *ngFor="let uid of getAvailableUserIds(slot)">{{ memberLabel(uid) }}</li>
                        <li *ngIf="getAvailableUserIds(slot).length === 0" class="slot-member-empty">Nadie</li>
                      </ul>
                    </div>
                    <div class="slot-member-col slot-member-col--no">
                      <div class="slot-member-col-title">No disponibles</div>
                      <ul>
                        <li *ngFor="let uid of getUnavailableUserIds(slot)">{{ memberLabel(uid) }}</li>
                        <li *ngIf="getUnavailableUserIds(slot).length === 0" class="slot-member-empty">Nadie</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div *ngIf="!loading && !error && topSlots.length === 0" class="empty">
            No hay huecos disponibles. Añade bloques de disponibilidad primero.
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    /* La página hace scroll; la tarjeta principal no debe ser otro contenedor con scroll */
    mat-card.qf-surface.planner-main-card,
    mat-card.qf-surface.planner-main-card .mat-mdc-card-content {
      overflow: visible;
      max-height: none;
    }

    .container {
      padding: 16px;
    }

    .nav-back {
      margin-bottom: 16px;
    }

    .loading, .error, .empty {
      padding: 16px;
      text-align: center;
    }

    .loading, .empty {
      color: var(--qf-text-muted);
    }

    .error {
      color: var(--qf-primary);
    }

    .timezone-banner {
      margin: 8px 0 16px;
      padding: 10px 12px;
      border-radius: 10px;
      background: var(--qf-surface-2);
      border: 1px solid rgba(0, 0, 0, 0.1);
      font-size: 0.9rem;
    }
    .timezone-banner p {
      margin: 0;
    }
    .timezone-banner p + p {
      margin-top: 6px;
    }

    .planner-legend {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 16px;
      margin-bottom: 4px;
    }

    .legend-item {
      display: inline-flex;
      align-items: center;
      padding: 6px 12px;
      border-radius: 999px;
      font-size: 0.8rem;
      font-weight: 500;
    }

    .legend-item--green {
      background: rgba(162, 211, 194, 0.22);
      color: #1a4c3f;
    }

    .legend-item--yellow {
      background: rgba(255, 210, 54, 0.2);
      color: #6b5200;
    }

    .legend-item--red {
      background: rgba(203, 37, 70, 0.12);
      color: #8b1a2e;
    }

    .slots-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 360px), 1fr));
      gap: 16px;
      margin-top: 16px;
    }

    .slot-card {
      display: flex;
      align-items: stretch;
      gap: 14px;
      width: 100%;
      box-sizing: border-box;
      position: relative;
      overflow: visible;
      padding: 18px 20px;
      border-radius: 18px;
      background: var(--qf-surface);
      border: 1px solid rgba(18, 12, 36, 0.08);
      box-shadow: var(--qf-shadow-soft);
      transition: transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease;
    }

    .slot-card:hover,
    .slot-card:focus-within {
      transform: translateY(-2px);
      box-shadow: var(--qf-shadow);
      z-index: 2;
    }

    .slot-card:active {
      transform: scale(0.99);
    }

    .slot-accent {
      width: 8px;
      border-radius: 999px;
      flex-shrink: 0;
    }

    .slot-green .slot-accent {
      background: var(--qf-success);
    }

    .slot-yellow .slot-accent {
      background: var(--qf-warning);
    }

    .slot-red .slot-accent {
      background: var(--qf-primary);
    }

    .slot-card--top {
      border: 2px solid var(--qf-success);
      box-shadow: var(--qf-shadow), 0 0 24px rgba(162, 211, 194, 0.18);
    }

    .slot-card--top:hover,
    .slot-card--top:focus-within {
      transform: translateY(-2px);
      box-shadow: var(--qf-shadow), 0 0 24px rgba(162, 211, 194, 0.18);
    }

    .slot-card--top:active {
      transform: scale(0.99);
    }

    .slot-body {
      flex: 1;
      min-width: 0;
    }

    .slot-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
    }

    .slot-header-main {
      min-width: 0;
    }

    .slot-title {
      color: #1a1a1e;
      font-weight: 700;
      font-size: 1.15rem;
      letter-spacing: 0.01em;
    }

    .slot-time {
      color: #1a1a1e;
      font-size: 1rem;
      font-weight: 600;
      margin-top: 4px;
      letter-spacing: 0.02em;
      display: flex;
      align-items: baseline;
      gap: 8px;
      flex-wrap: wrap;
    }

    .slot-time-label {
      font-size: 0.75rem;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--qf-text-muted, #6b7280);
      font-weight: 700;
    }

    .slot-time--user {
      font-size: 0.95rem;
    }

    .tz-day-badge {
      font-size: 0.75rem;
      line-height: 1.2;
      padding: 2px 8px;
      border-radius: 999px;
      background: rgba(255, 210, 54, 0.22);
      color: #6b5200;
      font-weight: 600;
      letter-spacing: 0.01em;
      white-space: nowrap;
    }

    .slot-top-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 12px;
      border-radius: 999px;
      background: rgba(255, 210, 54, 0.18);
      color: #6b5200;
      font-weight: 600;
      font-size: 0.85rem;
      white-space: nowrap;
    }

    .slot-top-badge mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .slot-metrics {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 16px;
    }

    .metric {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 12px;
      border-radius: 999px;
      font-size: 0.95rem;
      font-weight: 500;
    }

    .metric--availability {
      background: rgba(162, 211, 194, 0.22);
      color: #1a4c3f;
    }

    .metric--pct {
      background: rgba(18, 12, 36, 0.06);
      color: #1a1a1e;
    }

    .metric--preferred {
      background: rgba(250, 116, 59, 0.14);
      color: #7a3d16;
    }

    .slot-hover-hint {
      display: flex;
      align-items: center;
      gap: 6px;
      margin: 12px 0 0 0;
      font-size: 0.78rem;
      color: var(--qf-text-muted, #6b7280);
    }

    .slot-hover-hint mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    .slot-member-panel {
      position: absolute;
      left: 0;
      right: 0;
      top: calc(100% - 4px);
      margin-top: 4px;
      padding: 12px 14px;
      background: var(--qf-surface);
      border: 1px solid rgba(18, 12, 36, 0.12);
      border-radius: 12px;
      box-shadow: var(--qf-shadow);
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
      transform: translateY(4px);
      transition: opacity 160ms ease, transform 160ms ease, visibility 160ms;
      z-index: 5;
    }

    .slot-card:hover .slot-member-panel,
    .slot-card:focus-within .slot-member-panel {
      opacity: 1;
      visibility: visible;
      pointer-events: auto;
      transform: translateY(0);
    }

    .slot-member-columns {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    .slot-member-col-title {
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin-bottom: 8px;
      color: #1a1a1e;
    }

    .slot-member-col--ok .slot-member-col-title {
      color: #1a4c3f;
    }

    .slot-member-col--no .slot-member-col-title {
      color: #8b1a2e;
    }

    .slot-member-col ul {
      margin: 0;
      padding: 0 0 0 16px;
      font-size: 0.85rem;
      line-height: 1.45;
      color: #1a1a1e;
    }

    .slot-member-empty {
      list-style: none;
      margin-left: -16px;
      color: var(--qf-text-muted, #6b7280);
      font-style: italic;
    }

    @media (max-width: 600px) {
      .planner-legend {
        gap: 8px;
        margin-bottom: 8px;
      }

      .legend-item {
        font-size: 0.75rem;
        padding: 5px 10px;
      }

      .slots-grid {
        grid-template-columns: 1fr;
        gap: 12px;
      }

      .slot-card {
        padding: 16px 18px;
        border-radius: 16px;
      }

      .slot-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 10px;
      }

      .slot-top-badge {
        margin-top: 2px;
      }

      .slot-metrics {
        gap: 8px;
        margin-top: 12px;
      }

      .slot-member-columns {
        grid-template-columns: 1fr;
      }

      .slot-member-panel {
        position: static;
        opacity: 1;
        visibility: visible;
        pointer-events: auto;
        transform: none;
        margin-top: 12px;
        box-shadow: none;
        border-style: dashed;
      }

      .slot-hover-hint {
        display: none;
      }
    }
  `]
})
export class PlannerViewComponent implements OnInit {
  code = '';
  group: Group | null = null;
  topSlots: ComputedSlot[] = [];
  loading = true;
  error = '';
  memberCount = 0;
  groupMembers: GroupMember[] = [];
  private currentUserId: string | null = null;
  groupTimezoneLabel = '';
  userTimezoneLabel = '';
  showDifferentUserTimezone = false;
  private memberRoleByUserId = new Map<string, 'host' | 'member'>();
  private displayNameByUserId = new Map<string, string | null>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private plannerService: PlannerService,
    private groupService: GroupService,
    private authService: AuthService,
    private timezoneService: TimezoneService
  ) { }

  formatSlotDate(dateISO: string): string {
    if (!dateISO) return '';
    // Calendar date (group date), not a runtime-local timestamp conversion.
    return formatCalendarDateEs(dateISO).toUpperCase();
  }

  ngOnInit() {
    const code = this.route.snapshot.paramMap.get('code');
    if (!code) {
      this.router.navigate(['/login']);
      return;
    }
    this.code = code;

    this.authService.getCurrentUser().subscribe(user => {
      this.currentUserId = user?.id ?? null;
    });
    this.userTimezoneLabel = this.timezoneService.userTimezone();

    this.groupService
      .getGroup(code)
      .pipe(
        switchMap(group => {
          this.group = group;
          this.groupTimezoneLabel = this.timezoneService.groupTimezone(group);
          this.showDifferentUserTimezone = this.timezoneService.isDifferent(group.timezone, this.userTimezoneLabel);
          return (
          forkJoin({
            slots: this.plannerService.getTopSlots(code, 20),
            members: this.groupService.getGroupMembers(group.id)
          }).pipe(
            switchMap(({ slots, members }) =>
              this.groupService.getMemberDisplayNames(members.map(m => m.user_id)).pipe(
                map(names => ({ slots, members, names }))
              )
            )
          )
          );
        })
      )
      .subscribe({
        next: (result: { slots: ComputedSlot[]; members: GroupMember[]; names: Map<string, string | null> }) => {
          const { slots, members, names } = result;
          this.topSlots = slots;
          this.memberCount = slots.length > 0 ? (slots[0].total_members ?? 0) : 0;
          this.groupMembers = members;
          this.memberRoleByUserId = new Map(members.map(m => [m.user_id, m.role]));
          this.displayNameByUserId = names;
          this.loading = false;
        },
        error: (err) => {
          this.error = 'Error al calcular huecos';
          this.loading = false;
          console.error(err);
        }
      });
  }

  getAllMemberUserIds(): string[] {
    return this.groupMembers.map(m => m.user_id);
  }

  getAvailableUserIds(slot: ComputedSlot): string[] {
    const avail = slot.available_members ?? [];
    return [...avail].sort((a, b) => this.memberLabel(a).localeCompare(this.memberLabel(b), 'es'));
  }

  getUnavailableUserIds(slot: ComputedSlot): string[] {
    const availSet = new Set(slot.available_members ?? []);
    return this.getAllMemberUserIds()
      .filter(id => !availSet.has(id))
      .sort((a, b) => this.memberLabel(a).localeCompare(this.memberLabel(b), 'es'));
  }

  memberLabel(userId: string): string {
    const role = this.memberRoleByUserId.get(userId);
    const roleText = role === 'host' ? 'Host' : 'Miembro';
    const hostSuffix = role === 'host' ? ' (Host)' : '';
    const dn = this.displayNameByUserId.get(userId)?.trim();

    if (this.currentUserId && userId === this.currentUserId) {
      if (dn) return `Tú · ${dn}${hostSuffix}`;
      return `Tú (${roleText})`;
    }
    if (dn) return `${dn}${hostSuffix}`;

    const short = userId.replace(/-/g, '').slice(-4).toUpperCase();
    return `${roleText} · …${short}`;
  }

  formatGroupSlotTime(slot: ComputedSlot): string {
    const tz = this.group?.timezone ?? this.groupTimezoneLabel;
    return this.timezoneService.formatGroupTimeRange(slot.date, slot.start_min, slot.end_min, tz);
  }

  formatUserSlotTime(slot: ComputedSlot): string {
    return this.userLocalInfo(slot).formattedRange;
  }

  localTimePrefix(slot: ComputedSlot): string {
    const label = this.userLocalInfo(slot).localDayLabel;
    return label ? `${label} ` : '';
  }

  userDayOffsetBadge(slot: ComputedSlot): string | null {
    return this.userLocalInfo(slot).dayOffsetBadge;
  }

  private userLocalInfo(slot: ComputedSlot): LocalRangeDayInfo {
    const tz = this.group?.timezone ?? this.groupTimezoneLabel;
    return this.timezoneService.formatUserLocalTimeRangeWithDayInfo(
      slot.date,
      slot.start_min,
      slot.end_min,
      tz,
      this.userTimezoneLabel
    );
  }

}

