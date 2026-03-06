import { Injectable } from '@angular/core';
import { Observable, combineLatest, defer, from, of } from 'rxjs';
import { catchError, finalize, map, shareReplay, switchMap, tap } from 'rxjs/operators';
import { GroupService, Group } from './group.service';
import { GroupMember as DomainGroupMember } from '@domain/index';
import { BlocksService } from './blocks.service';
import { computeSlots, rankSlots, ComputedSlot, AvailabilityBlock, BlockedWindow } from '@domain/index';
import { getSupabaseClient } from '../config/supabase.config';
import { environment } from '../../../environments/environment';

/** Extrae project ref de la URL de Supabase (ej. ehtienppxcycyaxlyjln) */
function getProjectRef(): string {
  const m = environment.supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/);
  return m ? m[1] : '';
}

/** Lee el access_token desde localStorage (evita NavigatorLock) */
function getTokenFromStorage(): string | null {
  if (typeof localStorage === 'undefined') return null;
  const ref = getProjectRef();
  const keysToTry = ref ? [`sb-${ref}-auth-token`, 'sb-auth-token'] : ['sb-auth-token'];
  for (const key of keysToTry) {
    const token = parseTokenFromItem(localStorage.getItem(key));
    if (token) return token;
  }
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.startsWith('sb-') && key.endsWith('-auth-token'))) {
      const token = parseTokenFromItem(localStorage.getItem(key));
      if (token) return token;
    }
  }
  return null;
}

function parseTokenFromItem(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    const token =
      (data['access_token'] as string) ??
      (data['currentSession'] as { access_token?: string } | undefined)?.access_token ??
      (data['session'] as { access_token?: string } | undefined)?.access_token;
    return token && typeof token === 'string' ? token : null;
  } catch {
    return null;
  }
}

/**
 * Obtiene el token solo desde localStorage (evita NavigatorLock).
 * Reintenta un poco por si la auth acaba de escribir.
 */
async function getAccessToken(): Promise<string> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const token = getTokenFromStorage();
    if (token) return token;
    if (attempt < 2) await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error('No hay sesión activa. Inicia sesión e inténtalo de nuevo.');
}

async function invokeNotifyTopSlotsFetch(payload: {
  groupId: string;
  targetPeople: number;
  slots: ComputedSlot[];
}): Promise<void> {
  await new Promise((r) => setTimeout(r, 600));
  const token = await getAccessToken();
  const url = `${environment.supabaseUrl}/functions/v1/notify-top-slots`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: environment.supabaseAnonKey
    },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string; detail?: string };
    const msg = err.detail ? `${err.error ?? res.status}: ${err.detail}` : (err.error ?? `HTTP ${res.status}`);
    throw new Error(msg);
  }
}

@Injectable({
  providedIn: 'root'
})
export class PlannerService {
  private notifyInFlightByGroupId = new Map<string, Observable<void>>();

  constructor(
    private groupService: GroupService,
    private blocksService: BlocksService
  ) { }

  private invokeNotifyTopSlots(payload: { groupId: string; targetPeople: number; slots: ComputedSlot[] }): Observable<void> {
    const existing = this.notifyInFlightByGroupId.get(payload.groupId);
    if (existing) return existing;

    const request$ = defer(() => from(invokeNotifyTopSlotsFetch(payload))).pipe(
      finalize(() => this.notifyInFlightByGroupId.delete(payload.groupId)),
      shareReplay({ bufferSize: 1, refCount: true })
    );

    this.notifyInFlightByGroupId.set(payload.groupId, request$);
    return request$;
  }

  computeGroupSlots(groupCode: string): Observable<ComputedSlot[]> {
    return this.groupService.getGroup(groupCode).pipe(
      switchMap(group => combineLatest([
        this.groupService.getGroupMembers(group.id),
        this.blocksService.getBlocksByGroup(group.id),
        this.groupService.getBlockedWindows(group.id).pipe(
          map(windows => windows.map(w => ({
            ...w,
            date: '', // blocked windows don't have date, use dow
            group_id: w.group_id
          } as BlockedWindow)))
        )
      ]).pipe(
        map(([members, blocks, blockedWindows]) => ({ group, members, blocks, blockedWindows }))
      )
      )).pipe(
        map(({ group, members, blocks, blockedWindows }) => {
          // Map to domain models
          const domainMembers: DomainGroupMember[] = members.map(m => ({
            id: m.id,
            group_id: m.group_id,
            user_id: m.user_id,
            role: m.role
          }));

          const domainBlocks: AvailabilityBlock[] = blocks.map(b => ({
            id: b.id,
            group_id: b.group_id,
            user_id: b.user_id,
            type: b.type,
            date: b.date,
            start_min: b.start_min,
            end_min: b.end_min,
            source: b.source,
            created_at: b.created_at
          }));

          // Compute slots (solo dentro del rango planning)
          const slots = computeSlots({
            members: domainMembers,
            availability_blocks: domainBlocks,
            blocked_windows: blockedWindows,
            planning_start_date: group.planning_start_date,
            planning_end_date: group.planning_end_date,
            buffer_before_work_min: group.buffer_before_work_min,
            slotSize: 30,
            yellow_threshold: group.yellow_threshold
          });

          return slots;
        })
      );
  }

  getTopSlots(groupCode: string, topN: number = 10): Observable<ComputedSlot[]> {
    return this.groupService.getGroup(groupCode).pipe(
      switchMap(group =>
        combineLatest([
          this.computeGroupSlots(groupCode),
          this.groupService.getGroupMembers(group.id)
        ]).pipe(
          switchMap(([slots, members]) => {
            const ranked = rankSlots(slots, topN);
            const shouldNotify =
              group.target_people != null &&
              group.notification_sent_at == null &&
              ranked.some(s => (s.available_count ?? s.available_members.length) >= (group.target_people as number));

            if (!shouldNotify) {
              return from([ranked]);
            }

            const top3 = ranked.slice(0, 3);
            return this.invokeNotifyTopSlots({
              groupId: group.id,
              targetPeople: group.target_people as number,
              slots: top3
            }).pipe(
              map(() => ranked),
              catchError((err) => {
                console.error('Error al notificar top slots', err);
                return of(ranked);
              })
            );
          })
        )
      )
    );
  }

  /**
   * DEBUG: fuerza el cálculo de slots y el intento de envío de email
   * usando la edge function `notify-top-slots`, independientemente de
   * si se mostrarán o no en la UI. Útil para probar el proveedor de email.
   */
  debugNotifyTopSlots(groupCode: string): Observable<void> {
    return this.groupService.getGroup(groupCode).pipe(
      switchMap(group =>
        combineLatest([
          this.computeGroupSlots(groupCode),
          this.groupService.getGroupMembers(group.id)
        ]).pipe(
          map(([slots]) => rankSlots(slots, 3)),
          switchMap((top3) => {
            return this.invokeNotifyTopSlots({
              groupId: group.id,
              targetPeople: group.target_people ?? 1,
              slots: top3
            }).pipe(
              tap(() => console.log('[Planner debug] notify-top-slots invocada correctamente')),
              tap({ error: (err) => console.error('[Planner debug] Error al invocar notify-top-slots', err) })
            );
          })
        )
      )
    );
  }
}

