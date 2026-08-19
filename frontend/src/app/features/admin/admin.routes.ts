import { Routes } from '@angular/router';
import { NotificationConfigComponent } from './notification-config/notification-config.component';
import { SmtpConfigComponent } from './smtp-config/smtp-config.component';
import { NotificationLogsComponent } from './notification-logs/notification-logs.component';
import { OcrDebuggerComponent } from './ocr-debugger/ocr-debugger.component';
import { authGuard } from '../../core/auth/auth.guard';

export const adminRoutes: Routes = [
  { path: 'admin/notification-config', component: NotificationConfigComponent, canActivate: [authGuard] },
  { path: 'admin/smtp-config', component: SmtpConfigComponent, canActivate: [authGuard] },
  { path: 'admin/notification-logs', component: NotificationLogsComponent, canActivate: [authGuard] },
  { path: 'ocr-debugger', component: OcrDebuggerComponent, canActivate: [authGuard] }
];
