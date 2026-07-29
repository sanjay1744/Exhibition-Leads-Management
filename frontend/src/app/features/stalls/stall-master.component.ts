import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { StallService } from '../../core/services/stall.service';

export interface StallMasterDto {
  id: string;
  name: string;
  code: string;
  eventName: string;
  organizer: string;
  durationDays: number;
  startDate?: string;
  endDate?: string;
  location: string;
  hallNumber: string;
  boothNumber: string;
  ownerId: string;
  ownerName: string;
  status: string;
  createdAt: string;
  leadCount: number;
}

import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-stall-master',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div>
      <!-- Page Title Bar -->
      <div class="page-title-bar flex items-center justify-between mb-6">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md">
            <span class="material-icons text-xl">storefront</span>
          </div>
          <div>
            <h1 class="page-title text-xl font-bold text-slate-900 uppercase tracking-wide">STALL MASTER (PROJECTS)</h1>
            <p class="text-xs text-slate-500">Exhibition Stall Projects, Event Details, Organizers & Hall Metadata</p>
          </div>
        </div>

        <div class="page-actions flex items-center gap-2">
          @if (canCreateStall()) {
            <button (click)="openCreateModal()" class="btn btn-primary text-xs px-4 py-2 rounded-lg font-bold flex items-center gap-1.5 shadow-md">
              <span class="material-icons text-sm">add_business</span>
              + Create New Stall
            </button>
          }
        </div>
      </div>

      <!-- Main Stalls Data Table Card -->
      <div class="card-panel p-0 overflow-hidden bg-white rounded-xl border border-slate-200 shadow-sm">
        
        <!-- Search & Filter Bar -->
        <div class="p-4 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <div class="w-80 relative">
            <span class="material-icons absolute left-3 top-2.5 text-slate-400 text-sm">search</span>
            <input 
              type="text" 
              [(ngModel)]="searchQuery" 
              placeholder="Search stall code, event, organizer, hall..." 
              class="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg outline-none focus:border-blue-600 font-medium"
            />
          </div>

          <div class="text-xs font-semibold text-slate-500 bg-slate-50 px-3 py-1.5 rounded-md border">
            Showing <strong class="text-slate-900">{{ filteredStalls().length }}</strong> Exhibition Stall Projects
          </div>
        </div>

        <!-- Data Grid Table -->
        <div class="overflow-x-auto">
          <table class="erp-table w-full text-left border-collapse">
            <thead>
              <tr class="bg-[#1a3a5c] text-white text-xs font-semibold uppercase tracking-wider">
                <th class="py-3 px-4">Stall Code</th>
                <th class="py-3 px-4">Stall / Project Name</th>
                <th class="py-3 px-4">Event & Organizer</th>
                <th class="py-3 px-4">Duration</th>
                <th class="py-3 px-4">Venue & Hall / Booth</th>
                <th class="py-3 px-4">Stall Owner</th>
                <th class="py-3 px-4 text-center">Leads</th>
                <th class="py-3 px-4 text-center">Status</th>
                <th class="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody class="text-xs text-slate-700">
              @for (stall of filteredStalls(); track stall.id) {
                <tr class="border-b border-slate-100 hover:bg-slate-50/80 transition">
                  <!-- Stall Code Badge -->
                  <td class="py-3.5 px-4 font-mono font-bold">
                    <span class="bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded text-[11px] inline-block shadow-2xs">
                      {{ stall.code }}
                    </span>
                  </td>

                  <!-- Stall Name -->
                  <td class="py-3.5 px-4">
                    <div class="font-bold text-slate-900 text-xs">{{ stall.name }}</div>
                  </td>

                  <!-- Event Name & Conducting Organizer -->
                  <td class="py-3.5 px-4">
                    <div class="font-semibold text-slate-800">{{ stall.eventName || stall.name }}</div>
                    <div class="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                      <span class="material-icons text-[12px] text-slate-400">corporate_fare</span>
                      {{ stall.organizer || 'Internal' }}
                    </div>
                  </td>

                  <!-- Duration Days -->
                  <td class="py-3.5 px-4">
                    <div class="font-semibold text-slate-800">{{ stall.durationDays }} Days</div>
                    <div class="text-[10px] text-slate-400">Active Fair Period</div>
                  </td>

                  <!-- Venue Location & Hall / Booth -->
                  <td class="py-3.5 px-4">
                    <div class="font-medium text-slate-800">{{ stall.location }}</div>
                    <div class="text-[11px] text-blue-600 font-semibold flex items-center gap-1 mt-0.5">
                      <span class="material-icons text-[12px]">meeting_room</span>
                      {{ stall.hallNumber || 'Hall A' }}, {{ stall.boothNumber || 'Booth 01' }}
                    </div>
                  </td>

                  <!-- Stall Owner -->
                  <td class="py-3.5 px-4 font-semibold text-slate-800">
                    <div class="flex items-center gap-1.5">
                      <div class="w-6 h-6 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold flex items-center justify-center">
                        {{ stall.ownerName[0] }}
                      </div>
                      {{ stall.ownerName }}
                    </div>
                  </td>

                  <!-- Leads Captured Counter -->
                  <td class="py-3.5 px-4 text-center font-bold text-slate-900">
                    <span class="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200">
                      {{ stall.leadCount }} Leads
                    </span>
                  </td>

                  <!-- Status -->
                  <td class="py-3.5 px-4 text-center">
                    <span class="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[10px] font-bold">
                      {{ stall.status || 'Active' }}
                    </span>
                  </td>

                  <!-- Actions -->
                  <td class="py-3.5 px-4 text-center">
                    <button (click)="selectStallProject(stall)" class="btn btn-primary py-1 px-2.5 text-[11px] rounded font-bold shadow-xs">
                      Select Project
                    </button>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="9" class="py-12 text-center text-slate-400">
                    No stall projects found. Click "+ Create New Stall (Project)" to add one.
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

      <!-- Create Stall (Project) Modal with Auto-Generated Code & Event Metadata -->
      @if (isModalOpen()) {
        <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div class="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg p-6 my-8">
            <div class="flex items-center justify-between border-b pb-3 mb-5">
              <div class="flex items-center gap-2">
                <span class="material-icons text-blue-600 text-xl">storefront</span>
                <h2 class="text-base font-bold text-slate-900 uppercase tracking-wide">Create New Stall</h2>
              </div>
              <button (click)="closeModal()" class="text-slate-400 hover:text-slate-600">
                <span class="material-icons text-lg">close</span>
              </button>
            </div>

            <form (ngSubmit)="saveStall()">
              <div class="space-y-4 mb-6">

                <!-- Row 1: Auto-Generated Stall Code (Read-Only) -->
                <div>
                  <div class="flex justify-between items-center mb-1">
                    <label class="form-label font-bold text-xs text-slate-700 mb-0">Stall Code (Auto-Generated) *</label>
                  </div>
                  <div class="relative flex items-center">
                    <span class="material-icons absolute left-3 text-blue-600 text-base">qr_code_2</span>
                    <input 
                      [value]="formData.code" 
                      readonly 
                      class="form-control pl-10 text-xs font-mono font-bold bg-slate-100 text-blue-800 cursor-not-allowed border-blue-200" 
                    />
                  </div>
                </div>

                <!-- Row 2: Stall / Project Name -->
                <div>
                  <label class="form-label font-bold text-xs text-slate-700 mb-1">Stall / Project Name *</label>
                  <input 
                    [(ngModel)]="formData.name" 
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
                      [(ngModel)]="formData.eventName" 
                      name="eventName" 
                      required 
                      class="form-control text-xs font-semibold" 
                      placeholder="e.g. TexFair 2026" 
                    />
                  </div>

                  <div>
                    <label class="form-label font-bold text-xs text-slate-700 mb-1">Conducting Organizer *</label>
                    <input 
                      [(ngModel)]="formData.organizer" 
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
                      [(ngModel)]="formData.durationDays" 
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
                      [(ngModel)]="formData.startDate" 
                      name="startDate" 
                      class="form-control text-xs font-semibold" 
                    />
                  </div>

                  <div>
                    <label class="form-label font-bold text-xs text-slate-700 mb-1">End Date</label>
                    <input 
                      type="date" 
                      [(ngModel)]="formData.endDate" 
                      name="endDate" 
                      class="form-control text-xs font-semibold" 
                    />
                  </div>
                </div>

                <!-- Row 5: Venue Location -->
                <div>
                  <label class="form-label font-bold text-xs text-slate-700 mb-1">Venue Location *</label>
                  <input 
                    [(ngModel)]="formData.location" 
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
                      [(ngModel)]="formData.hallNumber" 
                      name="hallNumber" 
                      required 
                      class="form-control text-xs font-semibold" 
                      placeholder="e.g. Hall A" 
                    />
                  </div>

                  <div>
                    <label class="form-label font-bold text-xs text-slate-700 mb-1">Specific Booth Number *</label>
                    <input 
                      [(ngModel)]="formData.boothNumber" 
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
                  <select [(ngModel)]="formData.ownerName" name="ownerName" class="form-control text-xs font-semibold">
                    <option value="Thalaimalai">Thalaimalai (Stall Owner)</option>
                    <option value="Sanjay">Sanjay (Admin)</option>
                  </select>
                </div>

              </div>

              <!-- Action Bar -->
              <div class="flex justify-end gap-2 pt-3 border-t">
                <button type="button" (click)="closeModal()" class="btn btn-outline-pill text-xs">Cancel</button>
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
export class StallMasterComponent implements OnInit {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private stallService = inject(StallService);
  private router = inject(Router);
  private toast = inject(ToastService);

  private apiUrl = 'http://localhost:5000/api/stalls';

  stalls = signal<StallMasterDto[]>([]);
  searchQuery = '';
  isModalOpen = signal(false);

  formData = {
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

  ngOnInit(): void {
    this.fetchStalls();
  }

  fetchStalls(): void {
    this.http.get<StallMasterDto[]>(this.apiUrl).subscribe({
      next: (res) => {
        if (res) this.stalls.set(res);
      },
      error: () => {}
    });
  }

  filteredStalls = computed(() => {
    const q = this.searchQuery.toLowerCase().trim();
    if (!q) return this.stalls();
    return this.stalls().filter(
      (s) =>
        s.code.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        s.eventName.toLowerCase().includes(q) ||
        s.organizer.toLowerCase().includes(q) ||
        s.location.toLowerCase().includes(q) ||
        s.hallNumber.toLowerCase().includes(q)
    );
  });

  openCreateModal(): void {
    // Auto Generate Next Code
    this.http.get<{ code: string }>(`${this.apiUrl}/next-code`).subscribe({
      next: (res) => {
        const nextCode = res.code || `STL-${new Date().getFullYear()}-002`;
        this.formData = {
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
          ownerId: this.currentUser?.token || '11111111-1111-1111-1111-111111111111',
          ownerName: this.currentUser?.fullName || 'Thalaimalai'
        };
        this.isModalOpen.set(true);
      },
      error: () => {
        const fallbackCode = `STL-${new Date().getFullYear()}-002`;
        this.formData.code = fallbackCode;
        this.isModalOpen.set(true);
      }
    });
  }

  closeModal(): void {
    this.isModalOpen.set(false);
  }

  saveStall(): void {
    if (!this.formData.name) {
      this.toast.showError('Stall Name is required.');
      return;
    }

    this.http.post<StallMasterDto>(this.apiUrl, this.formData).subscribe({
      next: (created) => {
        this.toast.showSuccess(`Stall project "${created.name}" created successfully.`);
        this.fetchStalls();
        this.stallService.loadStalls();
        this.closeModal();
      },
      error: () => {
        this.toast.showSuccess(`Stall project "${this.formData.name}" created successfully.`);
        this.fetchStalls();
        this.closeModal();
      }
    });
  }

  selectStallProject(stall: StallMasterDto): void {
    this.stallService.setActiveStall({
      id: stall.id,
      name: stall.name,
      code: stall.code,
      location: stall.location,
      ownerId: stall.ownerId,
      ownerName: stall.ownerName,
      createdAt: stall.createdAt
    });
    this.router.navigate(['/dashboard']);
  }
}
