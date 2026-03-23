import { Injectable, inject, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable } from 'rxjs';
import { getSupabaseClient } from '../config/supabase.config';
import { User } from '@supabase/supabase-js';
import { getBrowserTimezone, setStoredUserTimezone } from '../utils/timezone';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private router = inject(Router);
  private ngZone = inject(NgZone);
  private supabase = getSupabaseClient();
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public authState$ = this.currentUserSubject.asObservable();

  constructor() {
    // Supabase callbacks can run outside Angular zone (p. ej. al volver de otra pestaña).
    // Ejecutarlos dentro de NgZone evita "Navigation triggered outside Angular zone"
    // y que la vista quede desincronizada o los botones dejen de funcionar.
    this.supabase.auth.onAuthStateChange((event, session) => {
      this.ngZone.run(() => {
        const user = session?.user ?? null;
        this.currentUserSubject.next(user);
        void this.syncProfileDisplayName(user);
      });
    });

    this.supabase.auth.getSession().then(({ data }) => {
      this.ngZone.run(() => {
        const user = data.session?.user ?? null;
        this.currentUserSubject.next(user);
        void this.syncProfileDisplayName(user);
      });
    });
  }

  /**
   * Guarda en public.profiles el nombre visible (Google: full_name / name, o email).
   * Así el planner y otras pantallas pueden mostrar nombres entre compañeros de grupo.
   */
  private async syncProfileDisplayName(user: User | null): Promise<void> {
    const detectedTimezone = setStoredUserTimezone(getBrowserTimezone());
    if (!user?.id) return;
    const meta = user.user_metadata as Record<string, string> | undefined;
    const displayName =
      (meta?.['full_name'] ?? meta?.['name'] ?? user.email ?? '').trim();

    const { error } = await this.supabase
      .from('profiles')
      .upsert(
        { id: user.id, display_name: displayName || null, timezone: detectedTimezone },
        { onConflict: 'id' }
      );

    if (error) {
      console.warn('[AuthService] No se pudo sincronizar display_name en profiles', error);
    }
  }

  async signInWithMagicLink(email: string, redirectPath?: string): Promise<void> {
    const origin = window.location.origin;
    const path = redirectPath && redirectPath.startsWith('/') ? redirectPath : '/dashboard';
    const { error } = await this.supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${origin}${path}`
      }
    });

    if (error) {
      throw error;
    }
  }

  async signInWithGoogle(redirectPath?: string): Promise<void> {
    const origin = window.location.origin;
    const path = redirectPath && redirectPath.startsWith('/') ? redirectPath : '/dashboard';
    const { error } = await this.supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${origin}${path}`
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
    this.ngZone.run(() => {
      this.currentUserSubject.next(null);
      this.router.navigate(['/login'], { replaceUrl: true });
    });
  }

  getCurrentUser(): Observable<User | null> {
    return this.authState$;
  }
}

