import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { take } from 'rxjs/operators';

/**
 * Component used for the root path ('').
 * Redirects to /dashboard if authenticated, otherwise to /login.
 */
@Component({
  selector: 'app-redirect-guard',
  standalone: true,
  template: `<div class="redirecting">Redirigiendo...</div>`,
  styles: [`
    .redirecting {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      font-family: Roboto, sans-serif;
      color: #666;
    }
  `]
})
export class RedirectGuardComponent implements OnInit {
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.authService.getCurrentUser().pipe(take(1)).subscribe(user => {
      if (user) {
        this.router.navigate(['/dashboard'], { replaceUrl: true });
      } else {
        this.router.navigate(['/login'], { replaceUrl: true });
      }
    });
  }
}
