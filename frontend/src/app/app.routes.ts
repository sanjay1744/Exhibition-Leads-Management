import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { authRoutes } from './features/auth/auth.routes';
import { dashboardRoutes } from './features/dashboard/dashboard.routes';
import { leadCaptureRoutes } from './features/lead-capture/lead-capture.routes';
import { digitalExchangeRoutes } from './features/digital-exchange/digital-exchange.routes';
import { exhibitionRoutes } from './features/exhibitions/exhibitions.routes';
import { stallRoutes } from './features/stalls/stalls.routes';
import { umsRoutes } from './features/ums/ums.routes';
import { adminRoutes } from './features/admin/admin.routes';
import { profileRoutes } from './features/profile/profile.routes';

const protect = (routesList: Routes): Routes => {
  return routesList.map((r) => ({ ...r, canActivate: [authGuard] }));
};

export const routes: Routes = [
  ...authRoutes,
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  ...protect(dashboardRoutes),
  ...protect(leadCaptureRoutes),
  ...protect(digitalExchangeRoutes),
  ...protect(exhibitionRoutes),
  ...protect(stallRoutes),
  ...protect(umsRoutes),
  ...protect(adminRoutes),
  ...protect(profileRoutes),
  { path: '**', redirectTo: 'dashboard' }
];
