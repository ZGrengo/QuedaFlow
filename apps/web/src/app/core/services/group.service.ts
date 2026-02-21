import { Injectable } from '@angular/core';
import { getSupabaseClient } from '../config/supabase.config';
import { Observable, from } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

export interface Group {
  id: string;
  code: string;
  name: string;
  host_user_id: string;
  buffer_before_work_min: number;
  yellow_threshold: number;
  target_people: number | null;
  created_at: string;
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  role: 'host' | 'member';
  created_at: string;
}

export interface CreateGroupDto {
  name: string;
}

@Injectable({
  providedIn: 'root'
})
export class GroupService {
  private supabase = getSupabaseClient();

  createGroup(dto: CreateGroupDto): Observable<Group> {
    // Get current user
    return from(this.supabase.auth.getUser()).pipe(
      switchMap(({ data: { user } }) => {
        if (!user) {
          throw new Error('User must be authenticated');
        }

        // Generate code using RPC or fallback
        return from(
          this.supabase.rpc('generate_group_code').then(
            (result) => result,
            () => ({ data: null, error: null })
          )
        ).pipe(
          switchMap(({ data: code }) => {
            const finalCode = code || this.generateRandomCode();
            
            return from(
              this.supabase
                .from('groups')
                .insert({
                  name: dto.name,
                  code: finalCode
                  // host_user_id is set by DB default (auth.uid()) so RLS policy passes
                })
                .select()
                .single()
            );
          })
        );
      }),
      map(({ data, error }) => {
        if (error) throw error;
        return data as Group;
      })
    );
  }

  private generateRandomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  joinGroupByCode(code: string): Observable<Group> {
    return from(
      this.joinGroupByCodeAsync(code)
    );
  }

  async joinGroupByCodeAsync(code: string): Promise<Group> {
    // Get group
    const { data: groupData, error: groupError } = await this.supabase
      .from('groups')
      .select('*')
      .eq('code', code.toUpperCase())
      .single();

    if (groupError) throw groupError;

    // Get current user
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) {
      throw new Error('User must be authenticated');
    }

    // Add user as member (ignore if already exists)
    await this.supabase
      .from('group_members')
      .insert({
        group_id: groupData.id,
        user_id: user.id,
        role: 'member'
      })
      .select()
      .then(({ error }) => {
        // Ignore error if user is already a member
        if (error && !error.message.includes('duplicate')) {
          console.warn('Error joining group:', error);
        }
      });

    return groupData as Group;
  }

  getGroup(code: string): Observable<Group> {
    return from(
      this.supabase
        .from('groups')
        .select('*')
        .eq('code', code.toUpperCase())
        .single()
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return data as Group;
      })
    );
  }

  getGroupMembers(groupId: string): Observable<GroupMember[]> {
    return from(
      this.supabase
        .from('group_members')
        .select('*')
        .eq('group_id', groupId)
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return data as GroupMember[];
      })
    );
  }

  updateSettings(
    groupId: string,
    settings: Partial<Pick<Group, 'buffer_before_work_min' | 'yellow_threshold' | 'target_people' | 'name'>>
  ): Observable<Group> {
    return from(
      this.supabase
        .from('groups')
        .update(settings)
        .eq('id', groupId)
        .select()
        .single()
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return data as Group;
      })
    );
  }

  getBlockedWindows(groupId: string): Observable<any[]> {
    return from(
      this.supabase
        .from('group_blocked_windows')
        .select('*')
        .eq('group_id', groupId)
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return data || [];
      })
    );
  }

  addBlockedWindow(groupId: string, window: { dow: number | null; start_min: number; end_min: number }): Observable<any> {
    return from(
      this.supabase
        .from('group_blocked_windows')
        .insert({
          group_id: groupId,
          ...window
        })
        .select()
        .single()
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return data;
      })
    );
  }

  deleteBlockedWindow(windowId: string): Observable<void> {
    return from(
      this.supabase
        .from('group_blocked_windows')
        .delete()
        .eq('id', windowId)
    ).pipe(
      map(({ error }) => {
        if (error) throw error;
      })
    );
  }
}
