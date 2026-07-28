import { Routes } from '@angular/router';
import { LeadFormComponent } from './features/lead-capture/lead-form.component';
import { VcardQrComponent } from './features/digital-exchange/vcard-qr.component';
import { SalesDashboardComponent } from './features/dashboard/sales-dashboard.component';

export const routes: Routes = [
  { path: '', redirectTo: 'capture', pathMatch: 'full' },
  { path: 'capture', component: LeadFormComponent },
  { path: 'exchange', component: VcardQrComponent },
  { path: 'dashboard', component: SalesDashboardComponent },
  { path: '**', redirectTo: 'capture' },
];
