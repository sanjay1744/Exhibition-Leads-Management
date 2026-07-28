import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApplicationDatabase } from '../../core/services/db.service';
import { LocalLead } from '../../core/models/lead.model';
import { NetworkService } from '../../core/services/network.service';

@Component({
  selector: 'app-sales-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div>
      <!-- Page Title & Actions Header Bar -->
      <div class="page-title-bar">
        <div>
          <h1 class="page-title">Dashboard Overview</h1>
          <p class="page-subtitle">Welcome back, here's what's happening today.</p>
        </div>

        <div class="page-actions">
          <button class="btn btn-outline-pill">
            <span class="material-icons text-sm">cloud_download</span>
            Export Report
          </button>
          <a routerLink="/capture" class="btn btn-primary">
            <span class="material-icons text-sm">add</span>
            + New Lead
          </a>
        </div>
      </div>

      <!-- KPI Metrics Cards Grid (Matches Screenshot 4-Card Style) -->
      <div class="kpi-grid">
        <!-- Card 1: Green Icon -->
        <div class="kpi-card">
          <div class="kpi-icon-box green">
            <span class="material-icons">attach_money</span>
          </div>
          <div class="kpi-content">
            <span class="kpi-label">Total Leads</span>
            <span class="kpi-value">{{ totalLeads() }}</span>
          </div>
        </div>

        <!-- Card 2: Blue Icon -->
        <div class="kpi-card">
          <div class="kpi-icon-box blue">
            <span class="material-icons">person_add</span>
          </div>
          <div class="kpi-content">
            <span class="kpi-label">Hot Opportunities</span>
            <span class="kpi-value">{{ hotLeads() }}</span>
          </div>
        </div>

        <!-- Card 3: Orange Icon -->
        <div class="kpi-card">
          <div class="kpi-icon-box orange">
            <span class="material-icons">pending_actions</span>
          </div>
          <div class="kpi-content">
            <span class="kpi-label">Pending Sync</span>
            <span class="kpi-value">{{ pendingSync() }}</span>
          </div>
        </div>

        <!-- Card 4: Purple Icon -->
        <div class="kpi-card">
          <div class="kpi-icon-box purple">
            <span class="material-icons">cloud_done</span>
          </div>
          <div class="kpi-content">
            <span class="kpi-label">CRM Synced %</span>
            <span class="kpi-value">{{ syncedPercentage() }}%</span>
          </div>
        </div>
      </div>

      <!-- Table Panel -->
      <div class="table-panel">
        <div class="table-header-title flex justify-between items-center">
          <span>Recent Exhibition Leads</span>
          <span class="text-xs font-normal text-gray-500">IndexedDB Local Storage</span>
        </div>

        <table class="erp-table">
          <thead>
            <tr>
              <th>Visitor Name</th>
              <th>Company</th>
              <th>Mobile</th>
              <th>Designation</th>
              <th>Interest Level</th>
              <th>Sync Status</th>
            </tr>
          </thead>
          <tbody>
            @for (lead of leads(); track lead.id) {
              <tr>
                <td class="font-semibold">{{ lead.name }}</td>
                <td>{{ lead.company }}</td>
                <td>{{ lead.phone }}</td>
                <td>{{ lead.designation || '-' }}</td>
                <td>
                  <span [class]="getInterestPill(lead.interestLevel)">
                    {{ lead.interestLevel }}
                  </span>
                </td>
                <td>
                  <span [class]="getSyncPill(lead.syncStatus)">
                    {{ lead.syncStatus }}
                  </span>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="6" class="p-8 text-center text-gray-400">
                  No exhibition leads captured yet. Click "+ New Lead" to begin.
                </td>
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
  syncedPercentage = signal(100);

  async ngOnInit(): Promise<void> {
    const list = await this.db.getAllLeads();
    this.leads.set(list);
    this.totalLeads.set(list.length);
    this.hotLeads.set(list.filter((l) => l.interestLevel === 'Hot').length);
    this.pendingSync.set(list.filter((l) => l.syncStatus === 'Pending').length);
    const syncedCount = list.filter((l) => l.syncStatus === 'Synced').length;
    this.syncedPercentage.set(list.length > 0 ? Math.round((syncedCount / list.length) * 100) : 100);
  }

  getInterestPill(level: string): string {
    if (level === 'Hot') return 'status-pill red';
    if (level === 'Warm') return 'status-pill orange';
    return 'status-pill green';
  }

  getSyncPill(status: string): string {
    if (status === 'Synced') return 'status-pill green';
    return 'status-pill orange';
  }
}
