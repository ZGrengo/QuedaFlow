import { Injectable } from '@angular/core';
import { Observable, combineLatest, from } from 'rxjs';
import { map, switchMap, tap } from 'rxjs/operators';
import { GroupService, Group } from './group.service';
import { GroupMember as DomainGroupMember } from '@domain/index';
import { BlocksService } from './blocks.service';
import { computeSlots, rankSlots, ComputedSlot, AvailabilityBlock, BlockedWindow } from '@domain/index';
import { getSupabaseClient } from '../config/supabase.config';

@Injectable({
  providedIn: 'root'
})
export class PlannerService {
  constructor(
    private groupService: GroupService,
    private blocksService: BlocksService
  ) { }

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
            const supabase = getSupabaseClient();

            return from(
              supabase.functions.invoke('notify-top-slots', {
                body: {
                  groupId: group.id,
                  targetPeople: group.target_people,
                  slots: top3
                }
              })
            ).pipe(
              tap(({ error }) => {
                if (error) {
                  // No romper la UI si la notificación falla
                  console.error('Error al notificar top slots', error);
                }
              }),
              map(() => ranked)
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
            const supabase = getSupabaseClient();
            return from(
              supabase.functions.invoke('notify-top-slots', {
                body: {
                  groupId: group.id,
                  targetPeople: group.target_people ?? 0,
                  slots: top3
                }
              })
            ).pipe(
              tap(({ error }) => {
                if (error) {
                  console.error('[Planner debug] Error al invocar notify-top-slots', error);
                } else {
                  console.log('[Planner debug] notify-top-slots invocada correctamente');
                }
              }),
              map(() => void 0)
            );
          })
        )
      )
    );
  }
}

