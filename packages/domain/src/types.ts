export type BlockType = 'WORK' | 'UNAVAILABLE' | 'PREFERRED';

export interface TimeBlock {
  date: string; // YYYY-MM-DD
  start_min: number; // minutes from midnight (0-1439)
  end_min: number; // minutes from midnight (0-1439)
}

export interface AvailabilityBlock extends TimeBlock {
  id?: string;
  group_id: string;
  user_id: string;
  type: BlockType;
  source?: string;
  created_at?: string;
}

export interface BlockedWindow extends TimeBlock {
  id?: string;
  group_id: string;
  dow?: number; // 0-6 (0 = Sunday), null = all days
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  role: 'host' | 'member';
}

export interface ComputedSlot extends TimeBlock {
  pct_available: number; // 0-1
  preferred_count: number;
  color: 'green' | 'yellow' | 'red';
  available_members: string[]; // user_ids
}

export interface ComputeSlotsParams {
  members: GroupMember[];
  availability_blocks: AvailabilityBlock[];
  blocked_windows: BlockedWindow[];
  planning_start_date: string; // YYYY-MM-DD
  planning_end_date: string; // YYYY-MM-DD
  buffer_before_work_min?: number; // default 20
  slotSize?: number; // minutes, default 30
  yellow_threshold?: number; // default 0.75
  min_meeting_duration_min?: number; // TODO: agrupar slots contiguos
}

