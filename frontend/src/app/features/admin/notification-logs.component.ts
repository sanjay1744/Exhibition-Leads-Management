import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-notification-logs',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="max-w-4xl mx-auto py-12">
      <!-- Access Blocked Panel Card (AriyAI Theme) -->
      <div class="card-panel bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-lg relative overflow-hidden">
        <!-- Top Lock Badge -->
        <div class="w-16 h-16 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4 border-4 border-red-50 shadow-inner">
          <span class="material-icons text-3xl">block</span>
        </div>

        <h1 class="text-xl font-bold text-slate-900 mb-2">Notification Logs Blocked</h1>
        <p class="text-xs text-slate-500 max-w-md mx-auto mb-6 leading-relaxed">
          Audit trail access for outgoing email notifications and system logs is currently blocked under current system security policy.
        </p>

        <div class="inline-flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 text-red-800 rounded-lg text-xs font-semibold mb-8">
          <span class="material-icons text-sm text-red-600">security</span>
          Status: Access Blocked
        </div>

        <div>
          <a routerLink="/dashboard" class="btn btn-primary px-6 py-2.5 rounded-xl text-xs font-bold shadow-md">
            <span class="material-icons text-base">dashboard</span>
            Return to Dashboard Overview
          </a>
        </div>
      </div>
    </div>
  `
})
export class NotificationLogsComponent {}
