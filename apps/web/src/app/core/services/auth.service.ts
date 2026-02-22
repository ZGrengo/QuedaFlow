import { Injectable, inject, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable } from 'rxjs';
import { getSupabaseClient } from '../config/supabase.config';
import { User } from '@supabase/supabase-js';

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
        this.currentUserSubject.next(session?.user ?? null);
      });
    });

    this.supabase.auth.getSession().then(({ data }) => {
      this.ngZone.run(() => {
        this.currentUserSubject.next(data.session?.user ?? null);
      });
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
    this.ngZone.run(() => {
      this.currentUserSubject.next(null);
      this.router.navigate(['/login'], { replaceUrl: true });
    });
  }

  getCurrentUser(): Observable<User | null> {
    return this.authState$;
  }
}

