import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { NetworkService } from './core/services/network.service';
import { SyncService } from './core/services/sync.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="min-h-screen bg-slate-100 flex flex-col font-sans">
      <!-- Header Bar -->
      <header class="bg-slate-900 text-white shadow-md">
        <div class="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="text-xl font-extrabold text-blue-400">⚡ LeadCapture</span>
            <span class="text-xs bg-slate-700 px-2 py-0.5 rounded text-gray-300">Offline-First PWA</span>
          </div>

          <nav class="flex gap-4 text-sm font-medium">
            <a routerLink="/capture" routerLinkActive="text-blue-400 border-b-2 border-blue-400" class="hover:text-blue-300 py-1">Capture Lead</a>
            <a routerLink="/exchange" routerLinkActive="text-blue-400 border-b-2 border-blue-400" class="hover:text-blue-300 py-1">vCard Exchange</a>
            <a routerLink="/dashboard" routerLinkActive="text-blue-400 border-b-2 border-blue-400" class="hover:text-blue-300 py-1">Analytics</a>
          </nav>

          <button (click)="triggerSync()" class="bg-blue-600 hover:bg-blue-500 text-xs px-3 py-1.5 rounded font-semibold transition">
            🔄 Manual Sync
          </button>
        </div>
      </header>

      <!-- Main Body -->
      <main class="flex-grow">
        <router-outlet></router-outlet>
      </main>
    </div>
  `
})
export class AppComponent {
  network = inject(NetworkService);
  private sync = inject(SyncService);

  triggerSync(): void {
    this.sync.syncPendingLeads();
  }
}
