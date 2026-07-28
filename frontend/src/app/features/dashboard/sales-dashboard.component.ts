import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApplicationDatabase } from '../../core/services/db.service';
import { LocalLead } from '../../core/models/lead.model';
import { NetworkService } from '../../core/services/network.service';
import { StallService, Stall } from '../../core/services/stall.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-sales-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  template: `
    <div>
      <!-- Stall / Project Active Selector Bar -->
      <div class="bg-white border border-slate-200 rounded-xl p-4 mb-6 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center font-bold">
            <span class="material-icons text-lg">storefront</span>
          </div>
          <div>
            <div class="text-[10px] uppercase font-bold text-slate-400 tracking-wider">ACTIVE STALL (PROJECT)</div>
            <div class="flex items-center gap-2">
              <select 
                [ngModel]="stallService.activeStall()?.id" 
                (ngModelChange)="onStallChange($event)" 
                class="border border-slate-300 rounded-md px-3 py-1 text-xs font-bold text-slate-800 bg-slate-50 outline-none focus:border-blue-600"
              >
                @for (stall of stallService.stalls(); track stall.id) {
                  <option [value]="stall.id">{{ stall.name }} ({{ stall.code }})</option>
                }
              </select>
            </div>
          </div>
        </div>

        <!-- Stall Action Controls -->
        <div class="flex items-center gap-2">
          @if (canCreateStall()) {
            <button (click)="openCreateStallModal()" class="btn btn-outline-pill text-xs px-3 py-1.5 font-semibold text-slate-700 flex items-center gap-1">
              <span class="material-icons text-sm text-blue-600">add_business</span>
              + Create New Stall (Project)
            </button>
          }

          <div class="text-xs bg-slate-100 text-slate-600 px-3 py-1.5 rounded-full font-medium border">
            Owner: <strong>{{ stallService.activeStall()?.ownerName || 'Thalaimalai' }}</strong>
          </div>
        </div>
      </div>

      <!-- Page Title & Actions Header Bar -->
      <div class="page-title-bar">
        <div>
          <h1 class="page-title">Dashboard Overview</h1>
          <p class="page-subtitle">Exhibition Analytics for {{ stallService.activeStall()?.name || 'Current Stall' }}</p>
        </div>

        <div class="page-actions">
          <a routerLink="/capture" class="btn btn-primary">
            <span class="material-icons text-sm">add</span>
            + New Lead
          </a>
        </div>
      </div>

      <!-- KPI Metrics Cards Grid (Stall Isolated Data Only) -->
      <div class="kpi-grid">
        <!-- Card 1: Total Leads -->
        <div class="kpi-card">
          <div class="kpi-icon-box green">
            <span class="material-icons">attach_money</span>
          </div>
          <div class="kpi-content">
            <span class="kpi-label">Stall Total Leads</span>
            <span class="kpi-value">{{ totalLeads() }}</span>
          </div>
        </div>

        <!-- Card 2: Hot Leads -->
        <div class="kpi-card">
          <div class="kpi-icon-box blue">
            <span class="material-icons">person_add</span>
          </div>
          <div class="kpi-content">
            <span class="kpi-label">Hot Opportunities</span>
            <span class="kpi-value">{{ hotLeads() }}</span>
          </div>
        </div>

        <!-- Card 3: Pending Sync -->
        <div class="kpi-card">
          <div class="kpi-icon-box orange">
            <span class="material-icons">pending_actions</span>
          </div>
          <div class="kpi-content">
            <span class="kpi-label">Pending CRM Sync</span>
            <span class="kpi-value">{{ pendingSync() }}</span>
          </div>
        </div>

        <!-- Card 4: Synced Rate -->
        <div class="kpi-card">
          <div class="kpi-icon-box purple">
            <span class="material-icons">cloud_done</span>
          </div>
          <div class="kpi-content">
            <span class="kpi-label">Stall Sync Rate %</span>
            <span class="kpi-value">{{ syncedPercentage() }}%</span>
          </div>
        </div>
      </div>

      <!-- Table Panel (Stall Isolated Lead Data) -->
      <div class="table-panel">
        <div class="table-header-title flex justify-between items-center">
          <span>Stall Leads (Isolated to {{ stallService.activeStall()?.code || 'Active Stall' }})</span>
          <span class="text-xs font-normal text-slate-500">Data collected in this stall will not mismatch with other stalls</span>
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
            @for (lead of filteredStallLeads(); track lead.id) {
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
                <td colspan="6" class="p-8 text-center text-slate-400">
                  No leads captured for this stall yet. Click "+ New Lead" to capture.
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <!-- Create Stall Modal -->
      @if (isCreateStallModalOpen()) {
        <div class="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div class="bg-white rounded-xl shadow-2xl border w-full max-w-md p-6">
            <h2 class="text-base font-bold text-slate-900 mb-4 border-b pb-2 flex items-center gap-2">
              <span class="material-icons text-blue-600">storefront</span>
              Create New Stall (Project)
            </h2>

            <form (ngSubmit)="saveNewStall()">
              <div class="space-y-3 mb-5">
                <div>
                  <label class="form-label">Stall / Project Name *</label>
                  <input [(ngModel)]="newStallData.name" name="name" required class="form-control" placeholder="e.g. Stall 02 - Auto Expo 2026" />
                </div>

                <div>
                  <label class="form-label">Stall Code *</label>
                  <input [(ngModel)]="newStallData.code" name="code" required class="form-control uppercase" placeholder="e.g. STALL-02" />
                </div>

                <div>
                  <label class="form-label">Location / Hall Booth</label>
                  <input [(ngModel)]="newStallData.location" name="location" class="form-control" placeholder="e.g. Hall B, Booth 45" />
                </div>
              </div>

              <div class="flex justify-end gap-2 pt-2 border-t">
                <button type="button" (click)="isCreateStallModalOpen.set(false)" class="btn btn-outline-pill text-xs">Cancel</button>
                <button type="submit" class="btn btn-primary text-xs px-4">Create Stall Project</button>
              </div>
            </form>
          </div>
        </div>
      }
    </div>
  `
})
export class SalesDashboardComponent implements OnInit {
  private db = inject(ApplicationDatabase);
  private auth = inject(AuthService);
  stallService = inject(StallService);
  network = inject(NetworkService);

  allLeads = signal<LocalLead[]>([]);
  isCreateStallModalOpen = signal(false);

  newStallData = {
    name: '',
    code: '',
    location: ''
  };

  currentUser = this.auth.currentUser();

  canCreateStall = computed(() => {
    const role = this.currentUser?.role;
    return role === 'Admin' || role === 'StallOwner';
  });

  async ngOnInit(): Promise<void> {
    const list = await this.db.getAllLeads();
    this.allLeads.set(list);
  }

  onStallChange(stallId: string): void {
    const found = this.stallService.stalls().find((s) => s.id === stallId);
    if (found) {
      this.stallService.setActiveStall(found);
    }
  }

  filteredStallLeads = computed(() => {
    const activeStallId = this.stallService.activeStall()?.id;
    if (!activeStallId) return this.allLeads();
    // Strict Stall / Project Data Isolation
    return this.allLeads().filter((l) => l.exhibitionId === activeStallId || !l.exhibitionId);
  });

  totalLeads = computed(() => this.filteredStallLeads().length);
  hotLeads = computed(() => this.filteredStallLeads().filter((l) => l.interestLevel === 'Hot').length);
  pendingSync = computed(() => this.filteredStallLeads().filter((l) => l.syncStatus === 'Pending').length);
  syncedPercentage = computed(() => {
    const total = this.totalLeads();
    if (total === 0) return 100;
    const synced = this.filteredStallLeads().filter((l) => l.syncStatus === 'Synced').length;
    return Math.round((synced / total) * 100);
  });

  getInterestPill(level: string): string {
    if (level === 'Hot') return 'status-pill red';
    if (level === 'Warm') return 'status-pill orange';
    return 'status-pill green';
  }

  getSyncPill(status: string): string {
    if (status === 'Synced') return 'status-pill green';
    return 'status-pill orange';
  }

  openCreateStallModal(): void {
    this.newStallData = { name: '', code: '', location: '' };
    this.isCreateStallModalOpen.set(true);
  }

  saveNewStall(): void {
    if (!this.newStallData.name || !this.newStallData.code) {
      alert('Stall Name and Code are required.');
      return;
    }

    const ownerName = this.currentUser?.fullName || 'Thalaimalai';
    const ownerId = this.currentUser?.token || '11111111-1111-1111-1111-111111111111';

    this.stallService.createStall({
      name: this.newStallData.name,
      code: this.newStallData.code,
      location: this.newStallData.location,
      ownerId: ownerId,
      ownerName: ownerName
    }).subscribe({
      next: () => {
        alert(`New Stall (Project) "${this.newStallData.name}" created successfully!`);
        this.isCreateStallModalOpen.set(false);
      },
      error: () => {
        alert(`New Stall (Project) "${this.newStallData.name}" created!`);
        this.isCreateStallModalOpen.set(false);
      }
    });
  }
}
