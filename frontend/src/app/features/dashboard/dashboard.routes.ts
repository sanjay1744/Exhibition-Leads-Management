import { Routes } from '@angular/router';
import { SalesDashboardComponent } from './sales-dashboard/sales-dashboard.component';
import { authGuard } from '../../core/auth/auth.guard';

export const dashboardRoutes: Routes = [
  { path: 'dashboard', component: SalesDashboardComponent, canActivate: [authGuard] }
];
