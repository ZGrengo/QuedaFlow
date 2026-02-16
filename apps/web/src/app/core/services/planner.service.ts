import { Injectable } from '@angular/core';
import { Observable, combineLatest } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { GroupService, GroupMember } from './group.service';
import { BlocksService } from './blocks.service';
import { Group } from './group.service';
import { computeSlots, rankSlots, ComputedSlot, AvailabilityBlock, BlockedWindow } from '@domain/index';

@Injectable({
  providedIn: 'root'
})
export class PlannerService {
  constructor(
    private groupService: GroupService,
    private blocksService: BlocksService
  ) {}

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
        const domainMembers: GroupMember[] = members.map(m => ({
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

        // Compute slots
        const slots = computeSlots({
          members: domainMembers,
          availability_blocks: domainBlocks,
          blocked_windows: blockedWindows,
          slotSize: 30,
          yellow_threshold: group.yellow_threshold
        });

        return slots;
      })
    );
  }

  getTopSlots(groupCode: string, topN: number = 10): Observable<ComputedSlot[]> {
    return this.computeGroupSlots(groupCode).pipe(
      map(slots => rankSlots(slots, topN))
    );
  }
}

