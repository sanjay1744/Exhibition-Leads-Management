import { Routes } from '@angular/router';
import { UserMasterComponent } from './user-master/user-master.component';
import { authGuard } from '../../core/auth/auth.guard';

export const umsRoutes: Routes = [
  { path: 'ums/user', component: UserMasterComponent, canActivate: [authGuard] }
];
