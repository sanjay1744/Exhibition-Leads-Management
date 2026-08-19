import { Routes } from '@angular/router';
import { StallMasterComponent } from './stall-master/stall-master.component';
import { authGuard } from '../../core/auth/auth.guard';

export const stallRoutes: Routes = [
  { path: 'stalls', component: StallMasterComponent, canActivate: [authGuard] }
];
