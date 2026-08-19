import { Routes } from '@angular/router';
import { LeadFormComponent } from './lead-form/lead-form.component';
import { LeadListComponent } from './lead-list/lead-list.component';

export const leadCaptureRoutes: Routes = [
  { path: 'capture', component: LeadFormComponent },
  { path: 'capture/:id', component: LeadFormComponent },
  { path: 'leads', component: LeadListComponent },
  { path: 'leads/new', component: LeadFormComponent },
  { path: 'leads/edit/:id', component: LeadFormComponent }
];
