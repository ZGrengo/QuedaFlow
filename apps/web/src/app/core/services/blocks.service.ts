import { Injectable } from '@angular/core';
import { getSupabaseClient } from '../config/supabase.config';
import { Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';
import { AvailabilityBlock, applyBuffer, mergeOverlappingBlocks, splitMidnightBlock } from '@domain/index';

export interface CreateBlockDto {
  group_id: string;
  type: 'WORK' | 'UNAVAILABLE' | 'PREFERRED';
  date: string;
  start_min: number;
  end_min: number;
}

@Injectable({
  providedIn: 'root'
})
export class BlocksService {
  private supabase = getSupabaseClient();

  addBlock(dto: CreateBlockDto, bufferMin: number = 20): Observable<AvailabilityBlock> {
    let block: AvailabilityBlock = {
      ...dto,
      user_id: '', // Will be set by RLS
      source: 'MANUAL'
    };

    // Apply buffer to WORK blocks
    if (block.type === 'WORK') {
      block = applyBuffer(block, bufferMin);
    }

    // Handle midnight crossing
    const blocksToInsert = splitMidnightBlock(block);

    // Insert blocks
    return from(
      Promise.all(
        blocksToInsert.map(b =>
          this.supabase
            .from('availability_blocks')
            .insert(b)
            .select()
            .single()
        )
      )
    ).pipe(
      map(results => {
        const errors = results.filter(r => r.error);
        if (errors.length > 0) {
          throw errors[0].error;
        }
        // Return first block (or merged if needed)
        return results[0].data as AvailabilityBlock;
      })
    );
  }

  getBlocksByGroup(groupId: string): Observable<AvailabilityBlock[]> {
    return from(
      this.supabase
        .from('availability_blocks')
        .select('*')
        .eq('group_id', groupId)
        .order('date', { ascending: true })
        .order('start_min', { ascending: true })
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return (data || []) as AvailabilityBlock[];
      })
    );
  }

  updateBlock(blockId: string, updates: Partial<CreateBlockDto>, bufferMin: number = 20): Observable<AvailabilityBlock> {
    let updatedBlock: Partial<AvailabilityBlock> = { ...updates };

    // Apply buffer if type is WORK
    if (updates.type === 'WORK' && updates.start_min !== undefined) {
      updatedBlock.start_min = Math.max(0, updates.start_min - bufferMin);
    }

    return from(
      this.supabase
        .from('availability_blocks')
        .update(updatedBlock)
        .eq('id', blockId)
        .select()
        .single()
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return data as AvailabilityBlock;
      })
    );
  }

  deleteBlock(blockId: string): Observable<void> {
    return from(
      this.supabase
        .from('availability_blocks')
        .delete()
        .eq('id', blockId)
    ).pipe(
      map(({ error }) => {
        if (error) throw error;
      })
    );
  }

  getUserBlocks(groupId: string, userId: string): Observable<AvailabilityBlock[]> {
    return from(
      this.supabase
        .from('availability_blocks')
        .select('*')
        .eq('group_id', groupId)
        .eq('user_id', userId)
        .order('date', { ascending: true })
        .order('start_min', { ascending: true })
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return (data || []) as AvailabilityBlock[];
      })
    );
  }
}

