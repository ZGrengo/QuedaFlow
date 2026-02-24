import {
  ComputedSlot,
  ComputeSlotsParams,
  AvailabilityBlock,
  BlockedWindow,
  GroupMember
} from './types';
import { overlaps } from './time';
import { splitMidnightBlock, applyBuffer } from './blocks';

/**
 * Genera fechas entre start y end (inclusive)
 */
function dateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const d = new Date(start);
  const endDate = new Date(end);
  while (d <= endDate) {
    dates.push(d.toISOString().split('T')[0]);
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

/**
 * Computes available time slots for a group
 * - Filtra bloques por planning range
 * - Aplica buffer en WORK solo para cálculo (busy interval extendido)
 * - Excluye slots en blocked windows
 */
export function computeSlots(params: ComputeSlotsParams): ComputedSlot[] {
  const {
    members,
    availability_blocks,
    blocked_windows,
    planning_start_date,
    planning_end_date,
    buffer_before_work_min = 20,
    slotSize = 30,
    yellow_threshold = 0.75
  } = params;

  if (members.length === 0) {
    return [];
  }

  // Filtrar bloques dentro del rango de planificación
  const blocksInRange = availability_blocks.filter(
    b => b.date >= planning_start_date && b.date <= planning_end_date
  );

  // Fechas a procesar: rango planning
  const dates = dateRange(planning_start_date, planning_end_date);

  if (dates.length === 0) {
    return [];
  }

  const slots: ComputedSlot[] = [];

  // Process each date
  for (const date of dates) {
    // Get day of week (0 = Sunday, 6 = Saturday)
    const dayOfWeek = new Date(date).getDay();

    // Get blocks for this date
    const dayBlocks = blocksInRange.filter(b => b.date === date);
    const dayBlockedWindows = blocked_windows.filter(bw => {
      if (bw.dow === null) return true; // Applies to all days
      return bw.dow === dayOfWeek;
    });

    // Generate slots for this day (00:00 to 23:59)
    for (let start = 0; start < 1440; start += slotSize) {
      const end = Math.min(start + slotSize, 1440);
      const slotDate = date;

      // Check if slot is blocked
      const isBlocked = dayBlockedWindows.some(bw => {
        // Handle blocked windows that cross midnight
        if (bw.start_min >= bw.end_min) {
          return start >= bw.start_min || end <= bw.end_min;
        }
        return overlaps(start, end, bw.start_min, bw.end_min);
      });

      if (isBlocked) {
        continue; // Skip blocked slots
      }

      // Count available members
      // Semantics: WORK = busy (not available), UNAVAILABLE = busy, PREFERRED = available + preferred
      // Default: no blocks = available. Member is unavailable only when in WORK or UNAVAILABLE.
      const availableMembers: string[] = [];
      let preferredCount = 0;

      for (const member of members) {
        const memberBlocks = dayBlocks.filter(b => b.user_id === member.user_id);

        let isAvailable = true; // Default: available (no blocks = free)
        let isPreferred = false;

        for (const block of memberBlocks) {
          // Para WORK: usar intervalo "busy" extendido con buffer (solo en cálculo)
          const effectiveBlock =
            block.type === 'WORK'
              ? applyBuffer(block, buffer_before_work_min)
              : block;

          const blockOverlaps = (() => {
            if (effectiveBlock.start_min >= effectiveBlock.end_min) {
              const splitBlocks = splitMidnightBlock(effectiveBlock);
              return splitBlocks.some(
                sb => sb.date === slotDate && overlaps(start, end, sb.start_min, sb.end_min)
              );
            }
            return overlaps(start, end, effectiveBlock.start_min, effectiveBlock.end_min);
          })();

          if (blockOverlaps) {
            if (block.type === 'WORK' || block.type === 'UNAVAILABLE') {
              isAvailable = false;
              isPreferred = false;
              break;
            } else if (block.type === 'PREFERRED') {
              isPreferred = true; // Available and preferred
            }
          }
        }

        if (isAvailable) {
          availableMembers.push(member.user_id);
          if (isPreferred) {
            preferredCount++;
          }
        }
      }

      const pctAvailable = availableMembers.length / members.length;
      const color = getSlotColor(pctAvailable, yellow_threshold);

      slots.push({
        date: slotDate,
        start_min: start,
        end_min: end,
        pct_available: pctAvailable,
        preferred_count: preferredCount,
        color,
        available_members: availableMembers
      });
    }
  }

  return slots;
}

/**
 * Determines slot color based on availability percentage
 */
function getSlotColor(pctAvailable: number, yellowThreshold: number): 'green' | 'yellow' | 'red' {
  if (pctAvailable === 1.0) {
    return 'green';
  }
  if (pctAvailable >= yellowThreshold) {
    return 'yellow';
  }
  return 'red';
}

/**
 * Ranks slots and returns top N
 * Priority: green > yellow > red, then by preferred_count, then by pct_available
 */
export function rankSlots(slots: ComputedSlot[], topN: number = 10): ComputedSlot[] {
  const sorted = [...slots].sort((a, b) => {
    // Color priority: green (3) > yellow (2) > red (1)
    const colorPriority = { green: 3, yellow: 2, red: 1 };
    const colorDiff = colorPriority[b.color] - colorPriority[a.color];
    if (colorDiff !== 0) return colorDiff;

    // Then by preferred_count
    if (b.preferred_count !== a.preferred_count) {
      return b.preferred_count - a.preferred_count;
    }

    // Then by pct_available
    return b.pct_available - a.pct_available;
  });

  return sorted.slice(0, topN);
}

