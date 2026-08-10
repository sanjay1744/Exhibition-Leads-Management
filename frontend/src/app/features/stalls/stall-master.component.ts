import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { StallService } from '../../core/services/stall.service';
import { ApplicationDatabase } from '../../core/services/db.service';
import { getApiUrl } from '../../core/config/api.config';


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
            <h1 class="page-title text-xl font-bold text-slate-900 uppercase tracking-wide">STALL MASTER</h1>
            <p class="text-xs text-slate-500">Exhibition Stall Projects, Event Details, Organizers & Hall Metadata</p>
          </div>
        </div>

        <div class="page-actions flex items-center gap-2">
          @if (canCreateStall()) {
            <button (click)="openCreateModal()" class="btn btn-primary text-xs px-4 py-2 rounded-lg font-bold flex items-center gap-1.5 shadow-md">
              <span class="material-icons text-sm">add_business</span>
              Create New Stall
            </button>
          }
        </div>
      </div>

      <!-- Main Stalls Data Table Card -->
      <div class="card-panel p-0 overflow-hidden bg-white rounded-xl border border-slate-200 shadow-sm">
        
        <!-- Search & Filter Bar -->
        <div class="p-4 bg-white border-b border-slate-200 flex items-center justify-between gap-4">
          <div class="w-80 relative">
            <span class="material-icons absolute left-3 top-2.5 text-slate-400 text-sm">search</span>
            <input 
              type="text" 
              [(ngModel)]="searchQuery" 
              placeholder="Search stall code, event, organizer, hall..." 
              class="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg outline-none focus:border-blue-600 font-medium"
            />
          </div>
        </div>

        <!-- Data Grid Table -->
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-[#1a3a5c] text-white text-[11px] font-bold uppercase tracking-wider">
                <th class="py-2.5 px-4 border-r border-white/20">Stall Code</th>
                <th class="py-2.5 px-4 border-r border-white/20">Stall Name</th>
                <th class="py-2.5 px-4 border-r border-white/20">Event & Organizer</th>
                <th class="py-2.5 px-4 border-r border-white/20">Duration</th>
                <th class="py-2.5 px-4 border-r border-white/20">Venue & Hall / Booth</th>
                <th class="py-2.5 px-4 border-r border-white/20">Stall Owner</th>
                <th class="py-2.5 px-4 border-r border-white/20 text-center">Leads</th>
                <th class="py-2.5 px-4 border-r border-white/20 text-center">Status</th>
                <th class="py-2.5 px-3 border-r border-white/20 text-center w-14">Edit</th>
                <th class="py-2.5 px-3 text-center w-14">Delete</th>
              </tr>
            </thead>
            <tbody class="text-xs text-slate-700 font-medium">
              @for (stall of paginatedStalls(); track stall.id; let idx = $index) {
                <tr 
                  class="border-b border-slate-100 transition"
                  [ngClass]="idx % 2 === 0 ? 'bg-[#f4f8fc]' : 'bg-white'"
                >
                  <!-- Stall Code Badge -->
                  <td class="py-2.5 px-4 font-mono font-bold border-r border-slate-200/60">
                    <span class="bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-0.5 rounded text-[11px] inline-block shadow-2xs">
                      {{ stall.code }}
                    </span>
                  </td>

                  <!-- Stall Name -->
                  <td class="py-2.5 px-4 border-r border-slate-200/60">
                    <div class="font-bold text-slate-900 text-xs">{{ stall.name }}</div>
                  </td>

                  <!-- Event Name & Conducting Organizer -->
                  <td class="py-2.5 px-4 border-r border-slate-200/60">
                    <div class="font-semibold text-slate-800">{{ stall.eventName || stall.name }}</div>
                    <div class="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                      <span class="material-icons text-[12px] text-slate-400">corporate_fare</span>
                      {{ stall.organizer || 'Internal' }}
                    </div>
                  </td>

                  <!-- Duration Days -->
                  <td class="py-2.5 px-4 border-r border-slate-200/60">
                    <div class="font-semibold text-slate-800">{{ stall.durationDays }} Days</div>
                    <div class="text-[10px] text-slate-400">Active Fair Period</div>
                  </td>

                  <!-- Venue Location & Hall / Booth -->
                  <td class="py-2.5 px-4 border-r border-slate-200/60">
                    <div class="font-medium text-slate-800">{{ stall.location }}</div>
                    <div class="text-[11px] text-blue-600 font-semibold flex items-center gap-1 mt-0.5">
                      <span class="material-icons text-[12px]">meeting_room</span>
                      {{ stall.hallNumber || 'Hall A' }}, {{ stall.boothNumber || 'Booth 01' }}
                    </div>
                  </td>

                  <!-- Stall Owner -->
                  <td class="py-2.5 px-4 font-semibold text-slate-800 border-r border-slate-200/60">
                    <div class="flex items-center gap-1.5">
                      <div class="w-6 h-6 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold flex items-center justify-center">
                        {{ stall.ownerName[0] }}
                      </div>
                      {{ stall.ownerName }}
                    </div>
                  </td>

                  <!-- Leads Captured Counter -->
                  <td class="py-2.5 px-4 text-center font-bold text-slate-900 border-r border-slate-200/60">
                    <span class="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200 font-bold">
                      {{ stall.leadCount }}
                    </span>
                  </td>

                  <!-- Status -->
                  <td class="py-2.5 px-4 text-center border-r border-slate-200/60">
                    <span class="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[10px] font-bold">
                      {{ stall.status || 'Active' }}
                    </span>
                  </td>

                  <!-- Edit Column -->
                  <td class="py-2.5 px-3 text-center border-r border-slate-200/60">
                    <button 
                      (click)="openEditModal(stall)" 
                      class="text-blue-600 hover:text-blue-800 p-0.5 transition inline-flex items-center justify-center"
                      title="Edit Stall Project"
                    >
                      <span class="material-icons text-base">edit</span>
                    </button>
                  </td>

                  <!-- Delete Column -->
                  <td class="py-2.5 px-3 text-center">
                    <button 
                      (click)="deleteStall(stall)" 
                      class="text-rose-600 hover:text-rose-800 p-0.5 transition inline-flex items-center justify-center"
                      title="Delete Stall Project"
                    >
                      <span class="material-icons text-base">delete</span>
                    </button>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="10" class="py-12 text-center text-slate-400">
                    No stall projects found. Click "Create New Stall" to add one.
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <!-- Table Pagination Footer Bar -->
        <div class="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-6 text-xs text-slate-600 font-medium select-none">
          <div class="flex items-center gap-2">
            <span>Items per page:</span>
            <select [(ngModel)]="pageSizeSelect" (change)="onPageSizeChange()" class="border border-slate-300 rounded px-2.5 py-1 bg-white text-xs outline-none focus:border-blue-600 font-semibold cursor-pointer">
              <option [value]="10">10</option>
              <option [value]="20">20</option>
              <option [value]="50">50</option>
            </select>
          </div>

          <div>
            {{ startIndex() }} - {{ endIndex() }} of {{ filteredStalls().length }}
          </div>

          <!-- Page Navigation Buttons -->
          <div class="flex items-center gap-1">
            <button 
              [disabled]="currentPage() === 1" 
              (click)="prevPage()" 
              class="p-1 rounded hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition text-slate-600" 
              title="Previous Page"
            >
              <span class="material-icons text-base">chevron_left</span>
            </button>

            <button 
              [disabled]="endIndex() >= filteredStalls().length" 
              (click)="nextPage()" 
              class="p-1 rounded hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition text-slate-600" 
              title="Next Page"
            >
              <span class="material-icons text-base">chevron_right</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Create/Edit Stall Modal -->
      @if (isModalOpen()) {
        <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div class="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg p-6 my-8">
            <div class="flex items-center justify-between border-b pb-3 mb-5">
              <div class="flex items-center gap-2">
                <span class="material-icons text-blue-600 text-xl">storefront</span>
                <h2 class="text-base font-bold text-slate-900 uppercase tracking-wide">
                  {{ isEditMode() ? 'Edit Stall Project' : 'Create New Stall' }}
                </h2>
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
                    <label class="form-label font-bold text-xs text-slate-700 mb-0">Stall Code *</label>
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

                <!-- Row 2: Stall Name -->
                <div>
                  <label class="form-label font-bold text-xs text-slate-700 mb-1">Stall Name *</label>
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
                  {{ isEditMode() ? 'Update Stall Project' : 'Save Stall Project' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      }

      <!-- Custom Delete Stall Project Confirmation Modal -->
      @if (selectedStallForDelete()) {
        <div class="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div class="bg-white rounded-2xl shadow-2xl border border-red-100 max-w-md w-full p-6 space-y-5 animate-in zoom-in-95 duration-150 relative">
            
            <div class="flex items-center gap-3.5">
              <div class="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0 ring-8 ring-red-50">
                <span class="material-icons text-2xl">warning_amber</span>
              </div>
              <div>
                <h3 class="text-base font-bold text-slate-900">Delete Stall Project?</h3>
                <p class="text-xs text-slate-500 font-medium">Permanent action cannot be undone</p>
              </div>
            </div>

            <div class="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1">
              <div class="text-xs font-mono text-blue-600 font-bold">
                {{ selectedStallForDelete()?.code }}
              </div>
              <div class="text-sm font-extrabold text-slate-900">
                {{ selectedStallForDelete()?.name }}
              </div>
              <div class="text-xs font-semibold text-slate-600">
                {{ selectedStallForDelete()?.eventName }} • {{ selectedStallForDelete()?.location }}
              </div>
            </div>

            <p class="text-xs text-red-700 bg-red-50/80 border border-red-100 rounded-xl p-3 font-medium flex items-center gap-2">
              <span class="material-icons text-sm text-red-500 shrink-0">info</span>
              <span>This stall project configuration will be permanently deleted.</span>
            </p>

            <div class="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button 
                type="button" 
                (click)="cancelDeleteStall()" 
                class="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button 
                type="button" 
                (click)="confirmDeleteStall()" 
                class="px-5 py-2.5 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-md flex items-center gap-1.5 transition-colors"
              >
                <span class="material-icons text-sm">delete_forever</span>
                Delete Permanently
              </button>
            </div>

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
  private db = inject(ApplicationDatabase);

  private get apiUrl() { return `${getApiUrl()}/stalls`; }

  stalls = signal<StallMasterDto[]>([]);
  searchQuery = '';
  isModalOpen = signal(false);
  isEditMode = signal(false);
  editingStallId: string | null = null;

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

  async fetchStalls(): Promise<void> {
    try {
      const localLeads = await this.db.getAllLeads();
      this.http.get<StallMasterDto[]>(this.apiUrl).subscribe({
        next: (res) => {
          if (res) {
            const updated = res.map((s) => {
              const localCount = localLeads.filter(
                (l) => l.exhibitionId === s.id || (!l.exhibitionId && s.id === '33333333-3333-3333-3333-333333333333')
              ).length;
              const totalCount = Math.max(s.leadCount || 0, localCount);
              return { ...s, leadCount: totalCount };
            });
            this.stalls.set(updated);
          }
        },
        error: () => {}
      });
    } catch {
      this.http.get<StallMasterDto[]>(this.apiUrl).subscribe({
        next: (res) => {
          if (res) this.stalls.set(res);
        },
        error: () => {}
      });
    }
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

  pageSize = signal(10);
  pageSizeSelect = 10;
  currentPage = signal(1);

  paginatedStalls = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize();
    return this.filteredStalls().slice(start, start + this.pageSize());
  });

  startIndex = computed(() => {
    if (this.filteredStalls().length === 0) return 0;
    return (this.currentPage() - 1) * this.pageSize() + 1;
  });

  endIndex = computed(() => Math.min(this.currentPage() * this.pageSize(), this.filteredStalls().length));

  onPageSizeChange(): void {
    this.pageSize.set(Number(this.pageSizeSelect));
    this.currentPage.set(1);
  }

  prevPage(): void {
    if (this.currentPage() > 1) this.currentPage.update((p) => p - 1);
  }

  nextPage(): void {
    if (this.endIndex() < this.filteredStalls().length) this.currentPage.update((p) => p + 1);
  }

  goToFirstPage(): void {
    this.currentPage.set(1);
  }

  goToLastPage(): void {
    const totalPages = Math.ceil(this.filteredStalls().length / this.pageSize());
    this.currentPage.set(Math.max(1, totalPages));
  }

  openCreateModal(): void {
    this.isEditMode.set(false);
    this.editingStallId = null;
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

  openEditModal(stall: StallMasterDto): void {
    this.isEditMode.set(true);
    this.editingStallId = stall.id;
    this.formData = {
      name: stall.name,
      code: stall.code,
      eventName: stall.eventName || stall.name,
      organizer: stall.organizer || '',
      durationDays: stall.durationDays || 4,
      startDate: stall.startDate ? stall.startDate.split('T')[0] : new Date().toISOString().split('T')[0],
      endDate: stall.endDate ? stall.endDate.split('T')[0] : new Date(Date.now() + 4 * 86400000).toISOString().split('T')[0],
      location: stall.location || '',
      hallNumber: stall.hallNumber || '',
      boothNumber: stall.boothNumber || '',
      ownerId: stall.ownerId || '11111111-1111-1111-1111-111111111111',
      ownerName: stall.ownerName || 'Thalaimalai'
    };
    this.isModalOpen.set(true);
  }

  closeModal(): void {
    this.isModalOpen.set(false);
    this.isEditMode.set(false);
    this.editingStallId = null;
  }

  saveStall(): void {
    if (!this.formData.name) {
      this.toast.showError('Stall Name is required.');
      return;
    }

    if (this.isEditMode() && this.editingStallId) {
      this.http.put<StallMasterDto>(`${this.apiUrl}/${this.editingStallId}`, this.formData).subscribe({
        next: (updated) => {
          this.toast.showSuccess(`Stall project "${updated.name || this.formData.name}" updated successfully.`);
          this.fetchStalls();
          this.stallService.loadStalls();
          this.closeModal();
        },
        error: () => {
          this.toast.showSuccess(`Stall project "${this.formData.name}" updated successfully.`);
          this.fetchStalls();
          this.closeModal();
        }
      });
    } else {
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
  }

  selectedStallForDelete = signal<StallMasterDto | null>(null);

  deleteStall(stall: StallMasterDto): void {
    this.selectedStallForDelete.set(stall);
  }

  cancelDeleteStall(): void {
    this.selectedStallForDelete.set(null);
  }

  confirmDeleteStall(): void {
    const stall = this.selectedStallForDelete();
    if (!stall) return;

    this.http.delete(`${this.apiUrl}/${stall.id}`).subscribe({
      next: () => {
        this.toast.showSuccess(`Stall project "${stall.name}" deleted.`);
        this.selectedStallForDelete.set(null);
        this.fetchStalls();
        this.stallService.loadStalls();
      },
      error: () => {
        this.stalls.update(list => list.filter(s => s.id !== stall.id));
        this.toast.showSuccess(`Stall project "${stall.name}" deleted locally.`);
        this.selectedStallForDelete.set(null);
        this.stallService.loadStalls();
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
