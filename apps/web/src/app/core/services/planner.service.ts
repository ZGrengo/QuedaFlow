import { Injectable } from '@angular/core';
import { Observable, combineLatest, defer, from, of, throwError } from 'rxjs';
import { finalize, map, shareReplay, switchMap, take } from 'rxjs/operators';
import { GroupService, Group } from './group.service';
import { GroupMember as DomainGroupMember } from '@domain/index';
import { BlocksService } from './blocks.service';
import { computeSlots, rankSlots, ComputedSlot, AvailabilityBlock, BlockedWindow } from '@domain/index';
import { getSupabaseClient } from '../config/supabase.config';
import { environment } from '../../../environments/environment';
import { dateToLocalISOString } from '../utils/date-format';

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

  /**
   * Envía por correo los 3 mejores huecos a todos los miembros con email (solo invocable desde UI host).
   * No comprueba umbral de disponibilidad: el host decide cuándo avisar.
   */
  sendTopSlotsEmailToMembers(groupCode: string): Observable<void> {
    return this.groupService.getGroup(groupCode).pipe(
      take(1),
      switchMap((group) => {
        if (group.target_people == null) {
          return throwError(
            () => new Error('Configura el mínimo de personas en la configuración del grupo antes de enviar el correo.')
          );
        }
        const targetPeople = group.target_people;
        return this.computeGroupSlots(groupCode).pipe(
          take(1),
          switchMap((slots) => {
            const ranked = rankSlots(slots, 20);
            const top3 = ranked.slice(0, 3);
            if (top3.length === 0) {
              return throwError(() => new Error('No hay huecos calculados para incluir en el correo.'));
            }
            return this.invokeNotifyTopSlots({
              groupId: group.id,
              targetPeople,
              slots: top3
            });
          })
        );
      })
    );
  }

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

          // Ventana efectiva: igual que bloques/UI — no mostrar ni calcular días ya pasados
          // aunque planning_start_date en BD siga siendo antiguo hasta que el host guarde de nuevo.
          const today = dateToLocalISOString(new Date());
          const effectiveStart =
            group.planning_start_date >= today ? group.planning_start_date : today;
          const effectiveEnd = group.planning_end_date;

          if (effectiveStart > effectiveEnd) {
            return [];
          }

          // Compute slots (solo dentro del rango planning efectivo)
          // slotSize = duración mínima de reunión del grupo (ej. 60 min) para que cada slot sea bookable
          const slotSize = group.min_meeting_duration_min ?? 30;
          const slots = computeSlots({
            members: domainMembers,
            availability_blocks: domainBlocks,
            blocked_windows: blockedWindows,
            planning_start_date: effectiveStart,
            planning_end_date: effectiveEnd,
            buffer_before_work_min: group.buffer_before_work_min,
            slotSize,
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
          switchMap(([slots]) => {
            const ranked = rankSlots(slots, topN);
            // El envío de correo cuando hay suficiente disponibilidad está desactivado: solo el host puede enviarlo desde el planner.
            return of(ranked);
          })
        )
      )
    );
  }

}

