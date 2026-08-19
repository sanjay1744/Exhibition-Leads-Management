import { Routes } from '@angular/router';
import { VcardQrComponent } from './vcard-qr/vcard-qr.component';
import { authGuard } from '../../core/auth/auth.guard';

export const digitalExchangeRoutes: Routes = [
  { path: 'exchange', component: VcardQrComponent, canActivate: [authGuard] }
];
