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

    it('computes slots with WORK blocks (WORK = busy, available outside work)', () => {
      const blocks: AvailabilityBlock[] = [
        {
          date: '2024-01-01',
          start_min: 540, // 09:00 - u1 busy 9-17
          end_min: 1020, // 17:00
          type: 'WORK',
          group_id: 'g1',
          user_id: 'u1'
        },
        {
          date: '2024-01-01',
          start_min: 600, // 10:00 - u2 busy 10-16
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

      // Both available outside work: u1 free 0-9 and 17-24, u2 free 0-10 and 16-24
      // Overlap: 0-9 and 17-24
      const morningSlots = result.filter(s => s.start_min < 540 && s.pct_available === 1.0);
      const eveningSlots = result.filter(s => s.start_min >= 1020 && s.pct_available === 1.0);
      expect(morningSlots.length).toBeGreaterThan(0);
      expect(eveningSlots.length).toBeGreaterThan(0);
      // During work (10-16) u1 is busy, so no full overlap
      const workSlots = result.filter(s => s.start_min >= 600 && s.end_min <= 960 && s.pct_available === 1.0);
      expect(workSlots.length).toBe(0);
    });

    it('respects blocked windows', () => {
      const blocks: AvailabilityBlock[] = [
        {
          date: '2024-01-01',
          start_min: 540, // u1 busy 9-17
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
          end_min: 480, // 00:00-08:00 group blocked
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

      // No slots before 08:00 (group blocked)
      const earlySlots = result.filter(s => s.end_min <= 480);
      expect(earlySlots).toHaveLength(0);
    });

    it('handles PREFERRED blocks (available + preferred)', () => {
      const blocks: AvailabilityBlock[] = [
        {
          date: '2024-01-01',
          start_min: 600, // u1 available and prefers 10-12
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
      expect(preferredSlot?.available_members).toContain('u1');
    });

    it('WORK and UNAVAILABLE both make user busy', () => {
      const blocks: AvailabilityBlock[] = [
        {
          date: '2024-01-01',
          start_min: 540, // u1 busy 9-17 (WORK)
          end_min: 1020,
          type: 'WORK',
          group_id: 'g1',
          user_id: 'u1'
        },
        {
          date: '2024-01-01',
          start_min: 1140, // u1 busy 19-20 (UNAVAILABLE - e.g. appointment)
          end_min: 1200,
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

      // At 10:00 u1 is in WORK block - not available
      const workSlot = result.find(s => s.start_min === 600);
      expect(workSlot?.available_members).not.toContain('u1');
      // At 19:00 u1 is in UNAVAILABLE block - not available
      const unavailableSlot = result.find(s => s.start_min === 1140);
      expect(unavailableSlot?.available_members).not.toContain('u1');
    });

    it('member with no blocks is available everywhere', () => {
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

      const result = computeSlots({
        members,
        availability_blocks: blocks,
        blocked_windows: [],
        slotSize: 60
      });

      // u2 has no blocks = available. u1 busy 9-17. So 8-9 both available
      const slot8am = result.find(s => s.start_min === 480);
      expect(slot8am?.available_members).toContain('u2');
      expect(slot8am?.available_members).toContain('u1');
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

