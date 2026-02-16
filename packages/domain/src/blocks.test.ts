import { describe, it, expect } from 'vitest';
import { splitMidnightBlock, applyBuffer, mergeOverlappingBlocks } from './blocks';
import { AvailabilityBlock } from './types';

describe('blocks utilities', () => {
  describe('splitMidnightBlock', () => {
    it('does not split normal blocks', () => {
      const block = { date: '2024-01-01', start_min: 540, end_min: 1020 };
      const result = splitMidnightBlock(block);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(block);
    });

    it('splits blocks crossing midnight', () => {
      const block = { date: '2024-01-01', start_min: 1380, end_min: 60 };
      const result = splitMidnightBlock(block);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ date: '2024-01-01', start_min: 1380, end_min: 1440 });
      expect(result[1].date).toBe('2024-01-02');
      expect(result[1].start_min).toBe(0);
      expect(result[1].end_min).toBe(60);
    });
  });

  describe('applyBuffer', () => {
    it('applies buffer to WORK blocks', () => {
      const block: AvailabilityBlock = {
        date: '2024-01-01',
        start_min: 540,
        end_min: 1020,
        type: 'WORK',
        group_id: 'g1',
        user_id: 'u1'
      };
      const result = applyBuffer(block, 20);
      expect(result.start_min).toBe(520);
      expect(result.end_min).toBe(1020);
    });

    it('does not apply buffer to non-WORK blocks', () => {
      const block: AvailabilityBlock = {
        date: '2024-01-01',
        start_min: 540,
        end_min: 1020,
        type: 'PREFERRED',
        group_id: 'g1',
        user_id: 'u1'
      };
      const result = applyBuffer(block, 20);
      expect(result.start_min).toBe(540);
    });

    it('does not go below 0', () => {
      const block: AvailabilityBlock = {
        date: '2024-01-01',
        start_min: 10,
        end_min: 100,
        type: 'WORK',
        group_id: 'g1',
        user_id: 'u1'
      };
      const result = applyBuffer(block, 30);
      expect(result.start_min).toBe(0);
    });
  });

  describe('mergeOverlappingBlocks', () => {
    it('merges overlapping blocks of same type and user', () => {
      const blocks: AvailabilityBlock[] = [
        {
          date: '2024-01-01',
          start_min: 540,
          end_min: 720,
          type: 'WORK',
          group_id: 'g1',
          user_id: 'u1'
        },
        {
          date: '2024-01-01',
          start_min: 700,
          end_min: 900,
          type: 'WORK',
          group_id: 'g1',
          user_id: 'u1'
        }
      ];
      const result = mergeOverlappingBlocks(blocks);
      expect(result).toHaveLength(1);
      expect(result[0].start_min).toBe(540);
      expect(result[0].end_min).toBe(900);
    });

    it('does not merge blocks of different types', () => {
      const blocks: AvailabilityBlock[] = [
        {
          date: '2024-01-01',
          start_min: 540,
          end_min: 720,
          type: 'WORK',
          group_id: 'g1',
          user_id: 'u1'
        },
        {
          date: '2024-01-01',
          start_min: 700,
          end_min: 900,
          type: 'PREFERRED',
          group_id: 'g1',
          user_id: 'u1'
        }
      ];
      const result = mergeOverlappingBlocks(blocks);
      expect(result).toHaveLength(2);
    });

    it('handles empty array', () => {
      expect(mergeOverlappingBlocks([])).toEqual([]);
    });
  });
});

