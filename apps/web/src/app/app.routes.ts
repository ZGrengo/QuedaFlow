import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./features/dashboard/dashboard/dashboard.component').then(m => m.DashboardComponent),
    canActivate: [authGuard]
  },
  {
    path: 'create-group',
    loadComponent: () => import('./features/group/create-group/create-group.component').then(m => m.CreateGroupComponent),
    canActivate: [authGuard]
  },
  {
    path: 'join-group',
    loadComponent: () => import('./features/group/join-group/join-group.component').then(m => m.JoinGroupComponent),
    canActivate: [authGuard]
  },
  {
    path: 'g/:code',
    loadComponent: () => import('./features/group/group-detail/group-detail.component').then(m => m.GroupDetailComponent),
    canActivate: [authGuard]
  },
  {
    path: 'g/:code/settings',
    loadComponent: () => import('./features/group/group-settings/group-settings.component').then(m => m.GroupSettingsComponent),
    canActivate: [authGuard]
  },
  {
    path: 'g/:code/blocks',
    loadComponent: () => import('./features/blocks/blocks-manager/blocks-manager.component').then(m => m.BlocksManagerComponent),
    canActivate: [authGuard]
  },
  {
    path: 'g/:code/planner',
    loadComponent: () => import('./features/planner/planner-view/planner-view.component').then(m => m.PlannerViewComponent),
    canActivate: [authGuard]
  },
  {
    path: 'g/:code/import',
    loadComponent: () => import('./features/ocr/import-ocr.page').then(m => m.ImportOcrPageComponent),
    canActivate: [authGuard]
  },
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./features/home/home.page').then(m => m.HomePageComponent)
  },
  {
    path: 'app',
    pathMatch: 'full',
    loadComponent: () => import('./core/guards/redirect-guard.component').then(m => m.RedirectGuardComponent)
  },
  {
    path: '**',
    redirectTo: '/login'
  }
];

