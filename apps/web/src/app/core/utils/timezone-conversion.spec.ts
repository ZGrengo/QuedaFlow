import {
  buildGroupRangeInstants,
  buildLocalRangeDayInfoFromInstants,
  formatRangeInTimezoneFromInstants
} from './timezone-conversion';

describe('timezone-conversion helpers', () => {
  it('converts Madrid group slot to Buenos Aires local time', () => {
    const instants = buildGroupRangeInstants('2026-01-20', 14 * 60, 15 * 60, 'Europe/Madrid');
    expect(instants).not.toBeNull();
    const local = formatRangeInTimezoneFromInstants(instants!, 'America/Argentina/Buenos_Aires');
    expect(local).toBe('10:00 - 11:00');
  });

  it('converts Madrid group slot to UTC', () => {
    const instants = buildGroupRangeInstants('2026-01-20', 14 * 60, 15 * 60, 'Europe/Madrid');
    expect(instants).not.toBeNull();
    const utc = formatRangeInTimezoneFromInstants(instants!, 'UTC');
    expect(utc).toBe('13:00 - 14:00');
  });

  it('handles midnight crossing in target timezone', () => {
    const instants = buildGroupRangeInstants('2026-01-20', 23 * 60 + 30, 60, 'Europe/Madrid');
    expect(instants).not.toBeNull();
    const local = formatRangeInTimezoneFromInstants(instants!, 'America/Argentina/Buenos_Aires');
    expect(local).toBe('19:30 - 21:00');
  });

  it('captures DST offset change between winter and summer in Madrid', () => {
    const winter = buildGroupRangeInstants('2026-01-20', 14 * 60, 15 * 60, 'Europe/Madrid');
    const summer = buildGroupRangeInstants('2026-07-20', 14 * 60, 15 * 60, 'Europe/Madrid');
    expect(winter).not.toBeNull();
    expect(summer).not.toBeNull();

    const winterUtc = formatRangeInTimezoneFromInstants(winter!, 'UTC');
    const summerUtc = formatRangeInTimezoneFromInstants(summer!, 'UTC');
    expect(winterUtc).toBe('13:00 - 14:00');
    expect(summerUtc).toBe('12:00 - 13:00');
  });

  it('returns day-info with same-day offset 0', () => {
    const instants = buildGroupRangeInstants('2026-01-20', 14 * 60, 15 * 60, 'Europe/Madrid');
    expect(instants).not.toBeNull();
    const info = buildLocalRangeDayInfoFromInstants('2026-01-20', instants!, 'UTC');
    expect(info.relativeDayOffsetStart).toBe(0);
    expect(info.relativeDayOffsetEnd).toBe(0);
    expect(info.dayOffsetBadge).toBeNull();
  });

  it('returns +1 day offset for local start next day', () => {
    const instants = buildGroupRangeInstants('2026-01-20', 23 * 60 + 30, 23 * 60 + 59, 'Europe/Madrid');
    expect(instants).not.toBeNull();
    const info = buildLocalRangeDayInfoFromInstants('2026-01-20', instants!, 'Asia/Tokyo');
    expect(info.relativeDayOffsetStart).toBe(1);
    expect(info.dayOffsetBadge).toBe('+1 día');
  });

  it('returns -1 day offset for local start previous day', () => {
    const instants = buildGroupRangeInstants('2026-01-20', 0, 30, 'Europe/Madrid');
    expect(instants).not.toBeNull();
    const info = buildLocalRangeDayInfoFromInstants('2026-01-20', instants!, 'America/Los_Angeles');
    expect(info.relativeDayOffsetStart).toBe(-1);
    expect(info.dayOffsetBadge).toBe('-1 día');
  });

  it('keeps day info coherent in midnight crossing with different timezone', () => {
    const instants = buildGroupRangeInstants('2026-01-20', 23 * 60 + 30, 60, 'Europe/Madrid');
    expect(instants).not.toBeNull();
    const info = buildLocalRangeDayInfoFromInstants('2026-01-20', instants!, 'America/Argentina/Buenos_Aires');
    expect(info.formattedRange).toBe('19:30 - 21:00');
    expect(info.relativeDayOffsetStart).toBe(0);
    expect(info.relativeDayOffsetEnd).toBe(0);
  });
});

