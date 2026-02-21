import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable } from 'rxjs';
import { getSupabaseClient } from '../config/supabase.config';
import { User } from '@supabase/supabase-js';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private router = inject(Router);
  private supabase = getSupabaseClient();
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public authState$ = this.currentUserSubject.asObservable();

  constructor() {
    // Listen to auth state changes
    this.supabase.auth.onAuthStateChange((event, session) => {
      this.currentUserSubject.next(session?.user ?? null);
    });

    // Get initial session
    this.supabase.auth.getSession().then(({ data }) => {
      this.currentUserSubject.next(data.session?.user ?? null);
    });
  }

  async signInWithMagicLink(email: string): Promise<void> {
    const { error } = await this.supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`
      }
    });

    if (error) {
      throw error;
    }
  }

  async signOut(): Promise<void> {
    const { error } = await this.supabase.auth.signOut();
    if (error) {
      throw error;
    }
    this.router.navigate(['/login']);
  }

  getCurrentUser(): Observable<User | null> {
    return this.authState$;
  }
}

