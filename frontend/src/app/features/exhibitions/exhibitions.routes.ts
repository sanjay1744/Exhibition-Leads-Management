import { Routes } from '@angular/router';
import { ExhibitionMasterComponent } from './exhibition-master/exhibition-master.component';
import { authGuard } from '../../core/auth/auth.guard';

export const exhibitionRoutes: Routes = [
  { path: 'exhibitions', component: ExhibitionMasterComponent, canActivate: [authGuard] }
];
