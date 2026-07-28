import { Routes } from '@angular/router';
import { LeadListComponent } from './features/lead-capture/lead-list.component';
import { LeadFormComponent } from './features/lead-capture/lead-form.component';
import { VcardQrComponent } from './features/digital-exchange/vcard-qr.component';
import { SalesDashboardComponent } from './features/dashboard/sales-dashboard.component';
import { UserMasterComponent } from './features/ums/user-master.component';
import { StallMasterComponent } from './features/stalls/stall-master.component';
import { ProfileComponent } from './features/profile/profile.component';
import { NotificationConfigComponent } from './features/admin/notification-config.component';
import { SmtpConfigComponent } from './features/admin/smtp-config.component';
import { NotificationLogsComponent } from './features/admin/notification-logs.component';
import { LoginComponent } from './features/auth/login.component';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'dashboard', component: SalesDashboardComponent, canActivate: [authGuard] },
  { path: 'leads', component: LeadListComponent, canActivate: [authGuard] },
  { path: 'capture', component: LeadFormComponent, canActivate: [authGuard] },
  { path: 'capture/:id', component: LeadFormComponent, canActivate: [authGuard] },
  { path: 'exchange', component: VcardQrComponent, canActivate: [authGuard] },
  { path: 'stalls', component: StallMasterComponent, canActivate: [authGuard] },
  { path: 'ums/user', component: UserMasterComponent, canActivate: [authGuard] },
  { path: 'admin/notification-config', component: NotificationConfigComponent, canActivate: [authGuard] },
  { path: 'admin/smtp-config', component: SmtpConfigComponent, canActivate: [authGuard] },
  { path: 'admin/notification-logs', component: NotificationLogsComponent, canActivate: [authGuard] },
  { path: 'profile', component: ProfileComponent, canActivate: [authGuard] },
  { path: '**', redirectTo: 'dashboard' },
];
