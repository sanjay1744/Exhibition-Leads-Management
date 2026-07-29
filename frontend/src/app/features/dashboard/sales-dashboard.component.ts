import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ApplicationDatabase } from '../../core/services/db.service';
import { LocalLead } from '../../core/models/lead.model';
import { NetworkService } from '../../core/services/network.service';
import { StallService, Stall } from '../../core/services/stall.service';
import { AuthService } from '../../core/services/auth.service';
import { getApiUrl } from '../../core/config/api.config';


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
            <div class="text-[10px] uppercase font-bold text-slate-400 tracking-wider">ACTIVE STALL</div>
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
              Create New Stall
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
            New Lead
          </a>
        </div>
      </div>

      <!-- KPI Metrics Cards Grid -->
      <div class="kpi-grid mb-6">
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

      <!-- Exact Rich Create Stall (Project) Modal -->
      @if (isCreateStallModalOpen()) {
        <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div class="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg p-6 my-8">
            <div class="flex items-center justify-between border-b pb-3 mb-5">
              <div class="flex items-center gap-2">
                <span class="material-icons text-blue-600 text-xl">storefront</span>
                <h2 class="text-base font-bold text-slate-900 uppercase tracking-wide">CREATE NEW STALL</h2>
              </div>
              <button (click)="isCreateStallModalOpen.set(false)" class="text-slate-400 hover:text-slate-600">
                <span class="material-icons text-lg">close</span>
              </button>
            </div>

            <form (ngSubmit)="saveNewStall()">
              <div class="space-y-4 mb-6">

                <!-- Row 1: Auto-Generated Stall Code (Read-Only) -->
                <div>
                  <div class="flex justify-between items-center mb-1">
                    <label class="form-label font-bold text-xs text-slate-700 mb-0">Stall Code (Auto-Generated) *</label>
                  </div>
                  <div class="relative flex items-center">
                    <span class="material-icons absolute left-3 text-blue-600 text-base">qr_code_2</span>
                    <input 
                      [value]="newStallData.code" 
                      readonly 
                      class="form-control pl-10 text-xs font-mono font-bold bg-slate-100 text-blue-800 cursor-not-allowed border-blue-200" 
                    />
                  </div>
                </div>

                <!-- Row 2: Stall Name -->
                <div>
                  <label class="form-label font-bold text-xs text-slate-700 mb-1">Stall Name *</label>
                  <input 
                    [(ngModel)]="newStallData.name" 
                    name="name" 
                    required 
                    class="form-control text-xs font-semibold" 
                    placeholder="e.g. Stall 02 - SIMA TexFair" 
                  />
                </div>

                <!-- Row 3: Exhibition Event Name & Conducting Organizer -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label class="form-label font-bold text-xs text-slate-700 mb-1">Exhibition Event Name *</label>
                    <input 
                      [(ngModel)]="newStallData.eventName" 
                      name="eventName" 
                      required 
                      class="form-control text-xs font-semibold" 
                      placeholder="e.g. TexFair 2026" 
                    />
                  </div>

                  <div>
                    <label class="form-label font-bold text-xs text-slate-700 mb-1">Conducting Organizer *</label>
                    <input 
                      [(ngModel)]="newStallData.organizer" 
                      name="organizer" 
                      required 
                      class="form-control text-xs font-semibold" 
                      placeholder="e.g. SIMA Association" 
                    />
                  </div>
                </div>

                <!-- Row 4: Duration (Days) & Dates -->
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label class="form-label font-bold text-xs text-slate-700 mb-1">Duration (Days) *</label>
                    <input 
                      type="number" 
                      [(ngModel)]="newStallData.durationDays" 
                      name="durationDays" 
                      required 
                      class="form-control text-xs font-semibold" 
                      placeholder="4" 
                    />
                  </div>

                  <div>
                    <label class="form-label font-bold text-xs text-slate-700 mb-1">Start Date</label>
                    <input 
                      type="date" 
                      [(ngModel)]="newStallData.startDate" 
                      name="startDate" 
                      class="form-control text-xs font-semibold" 
                    />
                  </div>

                  <div>
                    <label class="form-label font-bold text-xs text-slate-700 mb-1">End Date</label>
                    <input 
                      type="date" 
                      [(ngModel)]="newStallData.endDate" 
                      name="endDate" 
                      class="form-control text-xs font-semibold" 
                    />
                  </div>
                </div>

                <!-- Row 5: Venue Location -->
                <div>
                  <label class="form-label font-bold text-xs text-slate-700 mb-1">Venue Location *</label>
                  <input 
                    [(ngModel)]="newStallData.location" 
                    name="location" 
                    required 
                    class="form-control text-xs font-semibold" 
                    placeholder="e.g. Codissia Trade Fair Complex, Coimbatore" 
                  />
                </div>

                <!-- Row 6: Hall Number & Booth Number -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label class="form-label font-bold text-xs text-slate-700 mb-1">Specific Hall Number *</label>
                    <input 
                      [(ngModel)]="newStallData.hallNumber" 
                      name="hallNumber" 
                      required 
                      class="form-control text-xs font-semibold" 
                      placeholder="e.g. Hall A" 
                    />
                  </div>

                  <div>
                    <label class="form-label font-bold text-xs text-slate-700 mb-1">Specific Booth Number *</label>
                    <input 
                      [(ngModel)]="newStallData.boothNumber" 
                      name="boothNumber" 
                      required 
                      class="form-control text-xs font-semibold" 
                      placeholder="e.g. Booth 12" 
                    />
                  </div>
                </div>

                <!-- Row 7: Stall Owner Assignment -->
                <div>
                  <label class="form-label font-bold text-xs text-slate-700 mb-1">Assigned Stall Owner *</label>
                  <select [(ngModel)]="newStallData.ownerName" name="ownerName" class="form-control text-xs font-semibold">
                    <option value="Thalaimalai">Thalaimalai (Stall Owner)</option>
                    <option value="Sanjay">Sanjay (Admin)</option>
                  </select>
                </div>

              </div>

              <!-- Action Bar -->
              <div class="flex justify-end gap-2 pt-3 border-t">
                <button type="button" (click)="isCreateStallModalOpen.set(false)" class="btn btn-outline-pill text-xs">Cancel</button>
                <button type="submit" class="btn btn-primary text-xs px-6 py-2 rounded-lg font-bold shadow-md">
                  Save Stall Project
                </button>
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
  private http = inject(HttpClient);
  stallService = inject(StallService);
  network = inject(NetworkService);

  allLeads = signal<LocalLead[]>([]);
  isCreateStallModalOpen = signal(false);

  newStallData = {
    name: '',
    code: '',
    eventName: '',
    organizer: '',
    durationDays: 4,
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 4 * 86400000).toISOString().split('T')[0],
    location: 'Codissia Trade Fair Complex, Coimbatore',
    hallNumber: 'Hall A',
    boothNumber: 'Booth 12',
    ownerId: '11111111-1111-1111-1111-111111111111',
    ownerName: 'Thalaimalai'
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

  openCreateStallModal(): void {
    this.http.get<{ code: string }>(`${getApiUrl()}/stalls/next-code`).subscribe({
      next: (res) => {
        const nextCode = res.code || `STL-${new Date().getFullYear()}-002`;
        this.newStallData = {
          name: '',
          code: nextCode,
          eventName: '',
          organizer: '',
          durationDays: 4,
          startDate: new Date().toISOString().split('T')[0],
          endDate: new Date(Date.now() + 4 * 86400000).toISOString().split('T')[0],
          location: 'Codissia Trade Fair Complex, Coimbatore',
          hallNumber: 'Hall A',
          boothNumber: 'Booth 12',
          ownerId: '11111111-1111-1111-1111-111111111111',
          ownerName: 'Thalaimalai'
        };
        this.isCreateStallModalOpen.set(true);
      },
      error: () => {
        this.newStallData.code = `STL-${new Date().getFullYear()}-002`;
        this.isCreateStallModalOpen.set(true);
      }
    });
  }

  saveNewStall(): void {
    if (!this.newStallData.name) {
      alert('Stall Name is required.');
      return;
    }

    this.http.post<Stall>(`${getApiUrl()}/stalls`, this.newStallData).subscribe({
      next: (created) => {
        alert(`New Stall (Project) "${created.name}" created with Auto Code: ${created.code}!`);
        this.stallService.loadStalls();
        this.isCreateStallModalOpen.set(false);
      },
      error: (err) => {
        alert(err?.error?.message || `Failed to create Stall.`);
      }
    });
  }
}
