import { Injectable } from '@angular/core';
import { getSupabaseClient } from '../config/supabase.config';
import { Observable, from } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { AvailabilityBlock, splitMidnightBlock } from '@domain/index';

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

  addBlock(dto: CreateBlockDto): Observable<AvailabilityBlock> {
    return from(this.supabase.auth.getUser()).pipe(
      switchMap(({ data: { user }, error: userError }) => {
        if (userError || !user) throw new Error('Debes iniciar sesión para añadir bloques');
        const block: AvailabilityBlock = {
          ...dto,
          user_id: user.id,
          source: 'MANUAL'
        };
        // Buffer se aplica solo en computeSlots, no al guardar
        const blocksToInsert = splitMidnightBlock(block);
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
        );
      }),
      map((results: Array<{ data: AvailabilityBlock | null; error: unknown }>) => {
        const err = results.find(r => r.error);
        if (err?.error) throw err.error;
        const data = results[0]?.data;
        if (!data) throw new Error('Error al crear el bloque');
        return data;
      })
    );
  }

  /**
   * Inserta varios bloques de una vez (ej. horario fijo de lunes a viernes).
   * Aplica split de medianoche a cada bloque.
   */
  addBlocksBulk(dtos: CreateBlockDto[]): Observable<{ inserted: number }> {
    return from(this.supabase.auth.getUser()).pipe(
      switchMap(({ data: { user }, error: userError }) => {
        if (userError || !user) throw new Error('Debes iniciar sesión para añadir bloques');
        const allBlocks: AvailabilityBlock[] = [];
        dtos.forEach(dto => {
          const block: AvailabilityBlock = {
            ...dto,
            user_id: user.id,
            source: 'MANUAL'
          };
          const split = splitMidnightBlock(block);
          split.forEach(s => allBlocks.push({
            ...block,
            date: s.date,
            start_min: s.start_min,
            end_min: s.end_min
          }));
        });
        if (allBlocks.length === 0) {
          return from(Promise.resolve({ data: [], error: null }));
        }
        return from(
          this.supabase
            .from('availability_blocks')
            .insert(allBlocks)
            .select('id')
        );
      }),
      map(({ data, error }) => {
        if (error) throw error;
        return { inserted: (data?.length ?? 0) };
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

  updateBlock(blockId: string, updates: Partial<CreateBlockDto>): Observable<AvailabilityBlock> {
    const updatedBlock: Partial<AvailabilityBlock> = { ...updates };
    // Buffer se aplica solo en computeSlots, no al guardar

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

  /**
   * Bulk insert work blocks from OCR
   * Validates each shift and handles midnight splits
   * @param groupId - Group ID
   * @param shifts - Array of detected shifts
   * @param planningStartISO - Planning start date for validation
   * @param planningEndISO - Planning end date for validation
   * @returns Array of results per shift (ok: true with ids, or ok: false with error)
   */
  bulkInsertWorkBlocks(
    groupId: string,
    shifts: Array<{ dateISO: string; startMin: number; endMin: number; crossesMidnight: boolean }>,
    planningStartISO: string,
    planningEndISO: string
  ): Observable<Array<{ ok: true; ids: string[] } | { ok: false; error: string }>> {
    return from(this.supabase.auth.getUser()).pipe(
      switchMap(({ data: { user }, error: userError }) => {
        if (userError || !user) {
          throw new Error('Debes iniciar sesión para añadir bloques');
        }

        const today = new Date().toISOString().split('T')[0];
        const planningStart = new Date(planningStartISO);
        const planningEnd = new Date(planningEndISO);

        // Validate and prepare blocks
        const blocksToInsert: AvailabilityBlock[] = [];
        const shiftToBlocksMap: Map<number, number[]> = new Map(); // shift index -> block indices

        shifts.forEach((shift, shiftIndex) => {
          // Validation: date in planning range
          const shiftDate = new Date(shift.dateISO);
          if (shiftDate < planningStart || shiftDate > planningEnd) {
            return; // Skip invalid dates (will be reported in result)
          }

          // Validation: date not in past
          if (shift.dateISO < today) {
            return; // Skip past dates
          }

          // Validation: valid time range
          if (shift.startMin < 0 || shift.startMin >= 1440 || shift.endMin < 0 || shift.endMin > 1440) {
            return; // Skip invalid times
          }

          const block: AvailabilityBlock = {
            group_id: groupId,
            user_id: user.id,
            type: 'WORK',
            date: shift.dateISO,
            start_min: shift.startMin,
            end_min: shift.endMin,
            source: 'OCR'
          };

          // Split midnight blocks (returns TimeBlock[]; re-attach group_id, user_id, type, source)
          const splitBlocks = splitMidnightBlock(block);
          const blockIndices: number[] = [];
          splitBlocks.forEach(splitBlock => {
            const index = blocksToInsert.length;
            blocksToInsert.push({
              ...block,
              date: splitBlock.date,
              start_min: splitBlock.start_min,
              end_min: splitBlock.end_min
            });
            blockIndices.push(index);
          });
          shiftToBlocksMap.set(shiftIndex, blockIndices);
        });

        // Insert all blocks
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
          map((results: Array<{ data: AvailabilityBlock | null; error: unknown }>) => {
            // Map results back to shifts
            const shiftResults: Array<{ ok: true; ids: string[] } | { ok: false; error: string }> = [];

            shifts.forEach((shift, shiftIndex) => {
              const blockIndices = shiftToBlocksMap.get(shiftIndex);

              if (!blockIndices) {
                // Shift was skipped during validation
                const shiftDate = new Date(shift.dateISO);
                let error = 'Fecha inválida';
                if (shiftDate < planningStart || shiftDate > planningEnd) {
                  error = 'Fecha fuera del rango de planificación';
                } else if (shift.dateISO < today) {
                  error = 'Fecha en el pasado';
                } else if (shift.startMin < 0 || shift.startMin >= 1440 || shift.endMin < 0 || shift.endMin > 1440) {
                  error = 'Rango de horas inválido';
                }
                shiftResults.push({ ok: false, error });
                return;
              }

              // Check if all blocks for this shift were inserted successfully
              const errors: string[] = [];
              const ids: string[] = [];

              blockIndices.forEach(blockIndex => {
                const result = results[blockIndex];
                if (result.error) {
                  const errorMsg = (result.error as any)?.message || 'Error al insertar bloque';
                  errors.push(errorMsg);
                } else if (result.data?.id) {
                  ids.push(result.data.id);
                }
              });

              if (errors.length > 0) {
                shiftResults.push({ ok: false, error: errors.join('; ') });
              } else if (ids.length > 0) {
                shiftResults.push({ ok: true, ids });
              } else {
                shiftResults.push({ ok: false, error: 'Error desconocido al insertar bloques' });
              }
            });

            return shiftResults;
          })
        );
      })
    );
  }
}

