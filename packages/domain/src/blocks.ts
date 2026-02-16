import { TimeBlock, AvailabilityBlock } from './types';
import { overlaps } from './time';

/**
 * Splits a block that crosses midnight into two blocks
 * @param block - Block that may cross midnight
 * @returns Array of blocks (1 or 2)
 */
export function splitMidnightBlock(block: TimeBlock): TimeBlock[] {
  if (block.start_min < block.end_min) {
    // Normal block, no split needed
    return [block];
  }

  // Block crosses midnight: split into [start, 1440) and [0, end)
  return [
    {
      date: block.date,
      start_min: block.start_min,
      end_min: 1440
    },
    {
      date: getNextDay(block.date),
      start_min: 0,
      end_min: block.end_min
    }
  ];
}

/**
 * Gets the next day in YYYY-MM-DD format
 */
function getNextDay(date: string): string {
  const d = new Date(date);
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

/**
 * Applies buffer before WORK blocks
 * @param block - WORK block
 * @param bufferMin - Buffer in minutes
 * @returns Block with buffer applied (start_min adjusted)
 */
export function applyBuffer(block: AvailabilityBlock, bufferMin: number): AvailabilityBlock {
  if (block.type !== 'WORK') {
    return block;
  }

  return {
    ...block,
    start_min: Math.max(0, block.start_min - bufferMin)
  };
}

/**
 * Merges overlapping blocks of the same type and user
 * @param blocks - Array of blocks to merge
 * @returns Merged blocks
 */
export function mergeOverlappingBlocks(blocks: AvailabilityBlock[]): AvailabilityBlock[] {
  if (blocks.length === 0) return [];

  // Group by user_id and type
  const grouped = new Map<string, AvailabilityBlock[]>();
  for (const block of blocks) {
    const key = `${block.user_id}:${block.type}`;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(block);
  }

  const merged: AvailabilityBlock[] = [];

  for (const [_, groupBlocks] of grouped) {
    // Sort by date, then start_min
    const sorted = [...groupBlocks].sort((a, b) => {
      if (a.date !== b.date) {
        return a.date.localeCompare(b.date);
      }
      return a.start_min - b.start_min;
    });

    // Merge overlapping blocks
    let current = { ...sorted[0] };

    for (let i = 1; i < sorted.length; i++) {
      const next = sorted[i];

      // Same date and overlapping or adjacent
      if (
        current.date === next.date &&
        overlaps(current.start_min, current.end_min, next.start_min, next.end_min)
      ) {
        // Merge: extend end_min
        current.end_min = Math.max(current.end_min, next.end_min);
      } else {
        // No overlap, save current and start new
        merged.push(current);
        current = { ...next };
      }
    }

    merged.push(current);
  }

  return merged;
}

