import { Component, OnInit, OnDestroy, ChangeDetectorRef, NgZone, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet],
  template: `
    <router-outlet></router-outlet>
  `
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'QuedaFlow';

  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private ngZone = inject(NgZone);
  private visibilityHandler = () => this.onVisibilityChange();
  private pageshowHandler = (e: PageTransitionEvent) => this.onPageShow(e);

  ngOnInit(): void {
    document.addEventListener('visibilitychange', this.visibilityHandler);
    window.addEventListener('pageshow', this.pageshowHandler);
  }

  ngOnDestroy(): void {
    document.removeEventListener('visibilitychange', this.visibilityHandler);
    window.removeEventListener('pageshow', this.pageshowHandler);
  }

  private onVisibilityChange(): void {
    this.ngZone.run(() => {
      if (document.visibilityState === 'hidden') {
        this.saveCurrentUrl();
      } else {
        this.restoreUrlIfNeeded();
        this.cdr.detectChanges();
      }
    });
  }

  private saveCurrentUrl(): void {
    const url = this.router.url;
    if (url && url !== '/' && !url.startsWith('/login')) {
      sessionStorage.setItem('qf_last_url', url);
    }
  }

  private restoreUrlIfNeeded(): void {
    const saved = sessionStorage.getItem('qf_last_url');
    const current = this.router.url;
    if (!saved || saved === '/dashboard') return;
    if (current === '/dashboard' || current === '' || current === '/') {
      this.router.navigateByUrl(saved, { replaceUrl: true });
    }
  }

  private onPageShow(event: PageTransitionEvent): void {
    if (event.persisted) {
      this.ngZone.run(() => {
        this.restoreUrlIfNeeded();
        this.cdr.detectChanges();
      });
    }
  }
}

