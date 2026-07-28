import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApplicationDatabase } from '../../core/services/db.service';
import { LocalLead } from '../../core/models/lead.model';
import { NetworkService } from '../../core/services/network.service';

@Component({
  selector: 'app-sales-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="max-w-5xl mx-auto p-6 bg-slate-50 min-h-screen">
      <div class="flex justify-between items-center mb-6">
        <h1 class="text-2xl font-bold text-gray-800">Exhibition Analytics & Lead Status</h1>
        
        <div class="flex items-center gap-2">
          <span class="text-sm font-medium">Network Status:</span>
          @if (network.isOnline()) {
            <span class="bg-green-100 text-green-800 text-xs px-3 py-1 rounded-full font-semibold">🟢 ONLINE</span>
          } @else {
            <span class="bg-amber-100 text-amber-800 text-xs px-3 py-1 rounded-full font-semibold">🔴 OFFLINE (Local Mode)</span>
          }
        </div>
      </div>

      <!-- KPI Metrics Grid -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div class="bg-white p-4 rounded-lg shadow-sm border">
          <div class="text-sm text-gray-500">Total Leads</div>
          <div class="text-3xl font-bold text-blue-600">{{ totalLeads() }}</div>
        </div>

        <div class="bg-white p-4 rounded-lg shadow-sm border">
          <div class="text-sm text-gray-500">🔥 Hot Leads</div>
          <div class="text-3xl font-bold text-red-600">{{ hotLeads() }}</div>
        </div>

        <div class="bg-white p-4 rounded-lg shadow-sm border">
          <div class="text-sm text-gray-500">⏳ Pending Sync</div>
          <div class="text-3xl font-bold text-amber-600">{{ pendingSync() }}</div>
        </div>

        <div class="bg-white p-4 rounded-lg shadow-sm border">
          <div class="text-sm text-gray-500">✅ Synced to CRM</div>
          <div class="text-3xl font-bold text-emerald-600">{{ syncedLeads() }}</div>
        </div>
      </div>

      <!-- Lead Records Table -->
      <div class="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div class="p-4 border-b bg-gray-50 font-semibold text-gray-700">Captured Leads (IndexedDB)</div>

        <table class="w-full text-left text-sm text-gray-600">
          <thead class="bg-gray-100 uppercase text-xs">
            <tr>
              <th class="p-3">Name</th>
              <th class="p-3">Company</th>
              <th class="p-3">Phone</th>
              <th class="p-3">Interest</th>
              <th class="p-3">Sync Status</th>
            </tr>
          </thead>
          <tbody>
            @for (lead of leads(); track lead.id) {
              <tr class="border-b hover:bg-slate-50">
                <td class="p-3 font-medium text-gray-900">{{ lead.name }}</td>
                <td class="p-3">{{ lead.company }}</td>
                <td class="p-3">{{ lead.phone }}</td>
                <td class="p-3">
                  <span [class]="getInterestBadge(lead.interestLevel)">{{ lead.interestLevel }}</span>
                </td>
                <td class="p-3">
                  <span [class]="getSyncBadge(lead.syncStatus)">{{ lead.syncStatus }}</span>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="5" class="p-4 text-center text-gray-400">No leads captured yet. Click "Capture Lead" to start.</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `
})
export class SalesDashboardComponent implements OnInit {
  private db = inject(ApplicationDatabase);
  network = inject(NetworkService);

  leads = signal<LocalLead[]>([]);
  totalLeads = signal(0);
  hotLeads = signal(0);
  pendingSync = signal(0);
  syncedLeads = signal(0);

  async ngOnInit(): Promise<void> {
    const list = await this.db.getAllLeads();
    this.leads.set(list);
    this.totalLeads.set(list.length);
    this.hotLeads.set(list.filter((l) => l.interestLevel === 'Hot').length);
    this.pendingSync.set(list.filter((l) => l.syncStatus === 'Pending').length);
    this.syncedLeads.set(list.filter((l) => l.syncStatus === 'Synced').length);
  }

  getInterestBadge(level: string): string {
    if (level === 'Hot') return 'bg-red-100 text-red-800 text-xs px-2 py-1 rounded font-semibold';
    if (level === 'Warm') return 'bg-amber-100 text-amber-800 text-xs px-2 py-1 rounded font-semibold';
    return 'bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded font-semibold';
  }

  getSyncBadge(status: string): string {
    if (status === 'Synced') return 'bg-emerald-100 text-emerald-800 text-xs px-2 py-1 rounded font-semibold';
    return 'bg-amber-100 text-amber-800 text-xs px-2 py-1 rounded font-semibold';
  }
}
