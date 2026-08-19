import { Routes } from '@angular/router';
import { ProfileComponent } from './profile/profile.component';
import { authGuard } from '../../core/auth/auth.guard';

export const profileRoutes: Routes = [
  { path: 'profile', component: ProfileComponent, canActivate: [authGuard] }
];
