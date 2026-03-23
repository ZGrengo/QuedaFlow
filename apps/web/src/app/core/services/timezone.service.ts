import { Injectable } from '@angular/core';
import { Group } from './group.service';
import { minToHhmm } from '@domain/index';
import {
  formatGroupTimezoneLabel,
  getStoredUserTimezone,
  isDifferentTimezone,
  normalizeGroupTimezone
} from '../utils/timezone';
import {
  buildGroupRangeInstants,
  buildLocalRangeDayInfoFromInstants,
  LocalRangeDayInfo,
  formatRangeInTimezoneFromInstants
} from '../utils/timezone-conversion';

@Injectable({
  providedIn: 'root'
})
export class TimezoneService {
  userTimezone(): string {
    return getStoredUserTimezone();
  }

  groupTimezone(group: Pick<Group, 'timezone'> | null | undefined): string {
    return formatGroupTimezoneLabel(group?.timezone);
  }

  isDifferent(groupTz: string | null | undefined, userTz: string | null | undefined): boolean {
    return isDifferentTimezone(groupTz, userTz);
  }

  formatGroupTimeRange(date: string, startMin: number, endMin: number, groupTimezone: string): string {
    const tz = normalizeGroupTimezone(groupTimezone);
    const instants = buildGroupRangeInstants(date, startMin, endMin, tz);
    if (!instants) {
      return `${minToHhmm(startMin)} - ${minToHhmm(endMin)}`;
    }
    return formatRangeInTimezoneFromInstants(instants, tz);
  }

  formatUserLocalTimeRange(
    date: string,
    startMin: number,
    endMin: number,
    groupTimezone: string,
    userTimezone: string
  ): string {
    const groupTz = normalizeGroupTimezone(groupTimezone);
    const userTz = normalizeGroupTimezone(userTimezone);
    const instants = buildGroupRangeInstants(date, startMin, endMin, groupTz);
    if (!instants) {
      return `${minToHhmm(startMin)} - ${minToHhmm(endMin)}`;
    }
    return formatRangeInTimezoneFromInstants(instants, userTz);
  }

  formatUserLocalTimeRangeWithDayInfo(
    date: string,
    startMin: number,
    endMin: number,
    groupTimezone: string,
    userTimezone: string
  ): LocalRangeDayInfo {
    const groupTz = normalizeGroupTimezone(groupTimezone);
    const userTz = normalizeGroupTimezone(userTimezone);
    const instants = buildGroupRangeInstants(date, startMin, endMin, groupTz);
    if (!instants) {
      return {
        formattedRange: `${minToHhmm(startMin)} - ${minToHhmm(endMin)}`,
        localDateISOStart: date,
        localDateISOEnd: date,
        relativeDayOffsetStart: 0,
        relativeDayOffsetEnd: 0,
        dayOffsetBadge: null,
        localDayLabel: ''
      };
    }
    return buildLocalRangeDayInfoFromInstants(date, instants, userTz);
  }
}

