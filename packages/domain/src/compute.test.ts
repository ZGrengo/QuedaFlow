import { describe, it, expect } from 'vitest';
import { computeSlots, rankSlots } from './compute';
import { AvailabilityBlock, BlockedWindow, GroupMember } from './types';

describe('compute', () => {
  const members: GroupMember[] = [
    { id: 'm1', group_id: 'g1', user_id: 'u1', role: 'host' },
    { id: 'm2', group_id: 'g1', user_id: 'u2', role: 'member' }
  ];

  describe('computeSlots', () => {
    it('returns empty array for no members', () => {
      const result = computeSlots({
        members: [],
        availability_blocks: [],
        blocked_windows: []
      });
      expect(result).toEqual([]);
    });

    it('computes slots with WORK blocks', () => {
      const blocks: AvailabilityBlock[] = [
        {
          date: '2024-01-01',
          start_min: 540, // 09:00
          end_min: 1020, // 17:00
          type: 'WORK',
          group_id: 'g1',
          user_id: 'u1'
        },
        {
          date: '2024-01-01',
          start_min: 600, // 10:00
          end_min: 960, // 16:00
          type: 'WORK',
          group_id: 'g1',
          user_id: 'u2'
        }
      ];

      const result = computeSlots({
        members,
        availability_blocks: blocks,
        blocked_windows: [],
        slotSize: 60
      });

      // Should have slots where both are available (10:00-16:00)
      const overlappingSlots = result.filter(
        s => s.start_min >= 600 && s.end_min <= 960 && s.pct_available === 1.0
      );
      expect(overlappingSlots.length).toBeGreaterThan(0);
    });

    it('respects blocked windows', () => {
      const blocks: AvailabilityBlock[] = [
        {
          date: '2024-01-01',
          start_min: 540,
          end_min: 1020,
          type: 'WORK',
          group_id: 'g1',
          user_id: 'u1'
        }
      ];

      const blockedWindows: BlockedWindow[] = [
        {
          date: '2024-01-01',
          start_min: 0,
          end_min: 480, // 00:00-08:00 blocked
          group_id: 'g1',
          dow: null
        }
      ];

      const result = computeSlots({
        members,
        availability_blocks: blocks,
        blocked_windows: blockedWindows,
        slotSize: 60
      });

      // No slots before 08:00
      const earlySlots = result.filter(s => s.end_min <= 480);
      expect(earlySlots).toHaveLength(0);
    });

    it('handles PREFERRED blocks', () => {
      const blocks: AvailabilityBlock[] = [
        {
          date: '2024-01-01',
          start_min: 600,
          end_min: 720,
          type: 'PREFERRED',
          group_id: 'g1',
          user_id: 'u1'
        }
      ];

      const result = computeSlots({
        members,
        availability_blocks: blocks,
        blocked_windows: [],
        slotSize: 60
      });

      const preferredSlot = result.find(s => s.start_min === 600);
      expect(preferredSlot).toBeDefined();
      expect(preferredSlot?.preferred_count).toBe(1);
    });

    it('UNAVAILABLE blocks override WORK/PREFERRED', () => {
      const blocks: AvailabilityBlock[] = [
        {
          date: '2024-01-01',
          start_min: 540,
          end_min: 1020,
          type: 'WORK',
          group_id: 'g1',
          user_id: 'u1'
        },
        {
          date: '2024-01-01',
          start_min: 600,
          end_min: 720,
          type: 'UNAVAILABLE',
          group_id: 'g1',
          user_id: 'u1'
        }
      ];

      const result = computeSlots({
        members,
        availability_blocks: blocks,
        blocked_windows: [],
        slotSize: 60
      });

      const unavailableSlot = result.find(s => s.start_min === 600);
      expect(unavailableSlot?.available_members).not.toContain('u1');
    });
  });

  describe('rankSlots', () => {
    it('ranks slots by color, preferred_count, and pct_available', () => {
      const slots = [
        { date: '2024-01-01', start_min: 0, end_min: 30, pct_available: 0.5, preferred_count: 0, color: 'red' as const, available_members: [] },
        { date: '2024-01-01', start_min: 30, end_min: 60, pct_available: 0.8, preferred_count: 1, color: 'yellow' as const, available_members: [] },
        { date: '2024-01-01', start_min: 60, end_min: 90, pct_available: 1.0, preferred_count: 2, color: 'green' as const, available_members: [] },
        { date: '2024-01-01', start_min: 90, end_min: 120, pct_available: 1.0, preferred_count: 1, color: 'green' as const, available_members: [] }
      ];

      const ranked = rankSlots(slots, 3);
      expect(ranked[0].color).toBe('green');
      expect(ranked[0].preferred_count).toBe(2);
      expect(ranked[1].preferred_count).toBe(1);
      expect(ranked[2].color).toBe('yellow');
    });
  });
});

