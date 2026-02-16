import {
  ComputedSlot,
  ComputeSlotsParams,
  AvailabilityBlock,
  BlockedWindow,
  GroupMember
} from './types';
import { overlaps } from './time';
import { splitMidnightBlock } from './blocks';

/**
 * Computes available time slots for a group
 */
export function computeSlots(params: ComputeSlotsParams): ComputedSlot[] {
  const {
    members,
    availability_blocks,
    blocked_windows,
    slotSize = 30,
    yellow_threshold = 0.75
  } = params;

  if (members.length === 0) {
    return [];
  }

  // Get all unique dates from availability blocks
  const dates = new Set<string>();
  for (const block of availability_blocks) {
    dates.add(block.date);
  }

  if (dates.size === 0) {
    return [];
  }

  const slots: ComputedSlot[] = [];

  // Process each date
  for (const date of dates) {
    // Get day of week (0 = Sunday, 6 = Saturday)
    const dayOfWeek = new Date(date).getDay();

    // Get blocks for this date
    const dayBlocks = availability_blocks.filter(b => b.date === date);
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
      const availableMembers: string[] = [];
      let preferredCount = 0;

      for (const member of members) {
        const memberBlocks = dayBlocks.filter(b => b.user_id === member.user_id);

        let isAvailable = false;
        let isPreferred = false;

        for (const block of memberBlocks) {
          // Handle blocks that cross midnight
          if (block.start_min >= block.end_min) {
            const splitBlocks = splitMidnightBlock(block);
            for (const splitBlock of splitBlocks) {
              if (splitBlock.date === slotDate && overlaps(start, end, splitBlock.start_min, splitBlock.end_min)) {
                if (block.type === 'WORK' || block.type === 'PREFERRED') {
                  isAvailable = true;
                  if (block.type === 'PREFERRED') {
                    isPreferred = true;
                  }
                } else if (block.type === 'UNAVAILABLE') {
                  isAvailable = false;
                  isPreferred = false;
                  break; // UNAVAILABLE takes precedence
                }
              }
            }
          } else {
            if (overlaps(start, end, block.start_min, block.end_min)) {
              if (block.type === 'WORK' || block.type === 'PREFERRED') {
                isAvailable = true;
                if (block.type === 'PREFERRED') {
                  isPreferred = true;
                }
              } else if (block.type === 'UNAVAILABLE') {
                isAvailable = false;
                isPreferred = false;
                break; // UNAVAILABLE takes precedence
              }
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

