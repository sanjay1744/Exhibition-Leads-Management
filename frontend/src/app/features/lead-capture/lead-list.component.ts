import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { ApplicationDatabase } from '../../core/services/db.service';
import { LocalLead } from '../../core/models/lead.model';
import { StallService } from '../../core/services/stall.service';

@Component({
  selector: 'app-lead-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div>
      <!-- Active Stall (Project) Selector Bar -->
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

        <div class="text-xs bg-slate-100 text-slate-600 px-3 py-1.5 rounded-full font-medium border">
          Owner: <strong>{{ stallService.activeStall()?.ownerName || 'Thalaimalai' }}</strong>
        </div>
      </div>

      <!-- Page Title & Top Action Buttons -->
      <div class="page-title-bar flex items-center justify-between mb-6">
        <div>
          <h1 class="page-title text-xl font-bold text-slate-900 uppercase tracking-wide">LEADS</h1>
          <p class="text-xs text-slate-500">Live Grid of Captured Visitor Enquiries for {{ stallService.activeStall()?.name || 'Active Stall' }}</p>
        </div>

        <div class="page-actions flex items-center gap-2">
          <a routerLink="/capture" class="btn btn-primary text-xs px-4 py-2 rounded-lg font-bold flex items-center gap-1.5 shadow-md">
            <span class="material-icons text-sm">add</span>
            + Add New
          </a>
        </div>
      </div>

      <!-- Main Data Table Container matching Exact Design from Screenshot -->
      <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-6">
        
        <!-- Table Header Title Row -->
        <div class="p-4 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <h2 class="text-sm font-bold text-slate-900">
            Stall Leads (Isolated to {{ stallService.activeStall()?.code || 'STL-2026-001' }})
          </h2>
          <span class="text-xs text-slate-400 font-medium">
            Data collected in this stall will not mismatch with other stalls
          </span>
        </div>

        <!-- Rich ERP Data Grid with Separated Actions Columns -->
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-[#1a3a5c] text-white text-[11px] font-bold uppercase tracking-wider">
                <th class="py-2.5 px-4 border-r border-white/20">VISITOR NAME</th>
                <th class="py-2.5 px-4 border-r border-white/20">COMPANY</th>
                <th class="py-2.5 px-4 border-r border-white/20">MOBILE</th>
                <th class="py-2.5 px-4 border-r border-white/20">DESIGNATION</th>
                <th class="py-2.5 px-4 border-r border-white/20 text-center">INTEREST LEVEL</th>
                <th class="py-2.5 px-4 border-r border-white/20 text-center">SYNC STATUS</th>
                <th class="py-2.5 px-3 border-r border-white/20 text-center w-14">View</th>
                <th class="py-2.5 px-3 border-r border-white/20 text-center w-14">Edit</th>
                <th class="py-2.5 px-3 text-center w-14">Delete</th>
              </tr>
            </thead>
            <tbody class="text-xs text-slate-700 font-medium">
              @for (lead of paginatedLeads(); track lead.id; let idx = $index) {
                <tr 
                  class="border-b border-slate-100 transition"
                  [ngClass]="idx % 2 === 0 ? 'bg-[#f4f8fc]' : 'bg-white'"
                >
                  <!-- Visitor Name -->
                  <td class="py-2.5 px-4 font-bold text-slate-900 border-r border-slate-200/60">
                    {{ lead.name }}
                  </td>

                  <!-- Company -->
                  <td class="py-2.5 px-4 text-slate-700 border-r border-slate-200/60">
                    {{ lead.company }}
                  </td>

                  <!-- Mobile -->
                  <td class="py-2.5 px-4 font-semibold text-slate-800 border-r border-slate-200/60">
                    {{ lead.phone }}
                  </td>

                  <!-- Designation -->
                  <td class="py-2.5 px-4 text-slate-600 border-r border-slate-200/60">
                    {{ lead.designation || '-' }}
                  </td>

                  <!-- Interest Level (Hot / Warm / Cold) -->
                  <td class="py-2.5 px-4 text-center border-r border-slate-200/60">
                    <span 
                      class="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold inline-block"
                      [ngClass]="{
                        'bg-red-100 text-red-700 border border-red-200': lead.interestLevel === 'Hot',
                        'bg-amber-100 text-amber-700 border border-amber-200': lead.interestLevel === 'Warm',
                        'bg-blue-100 text-blue-700 border border-blue-200': lead.interestLevel === 'Cold'
                      }"
                    >
                      {{ lead.interestLevel }}
                    </span>
                  </td>

                  <!-- Sync Status Pill -->
                  <td class="py-2.5 px-4 text-center border-r border-slate-200/60">
                    <span 
                      class="px-2.5 py-0.5 rounded text-[10px] font-bold inline-block"
                      [ngClass]="lead.syncStatus === 'Synced' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-orange-50 text-orange-600 border border-orange-200'"
                    >
                      {{ lead.syncStatus === 'Synced' ? 'Synced' : 'Pending' }}
                    </span>
                  </td>

                  <!-- Action Column 1: View -->
                  <td class="py-2.5 px-3 text-center border-r border-slate-200/60">
                    <button (click)="viewLeadDetails(lead)" class="text-slate-500 hover:text-blue-600 p-0.5 transition" title="View Details">
                      <span class="material-icons text-base">visibility</span>
                    </button>
                  </td>

                  <!-- Action Column 2: Edit -->
                  <td class="py-2.5 px-3 text-center border-r border-slate-200/60">
                    <button (click)="editLead(lead)" class="text-indigo-500 hover:text-indigo-700 p-0.5 transition" title="Edit Lead">
                      <span class="material-icons text-base">edit</span>
                    </button>
                  </td>

                  <!-- Action Column 3: Delete -->
                  <td class="py-2.5 px-3 text-center">
                    <button (click)="deleteLead(lead)" class="text-red-500 hover:text-red-700 p-0.5 transition" title="Delete Lead">
                      <span class="material-icons text-base">delete_outline</span>
                    </button>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="9" class="py-12 text-center text-slate-400 font-medium bg-white">
                    No leads captured for this stall yet. Click "+ Add New" to capture.
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <!-- Pagination Footer Bar -->
        <div class="p-3 bg-white border-t border-slate-200 flex items-center justify-end gap-6 text-xs text-slate-600 font-medium select-none">
          <div class="flex items-center gap-2">
            <span>Items per page:</span>
            <select [(ngModel)]="pageSizeSelect" (change)="onPageSizeChange()" class="border border-slate-300 rounded px-2 py-1 bg-white text-xs outline-none focus:border-blue-600">
              <option [value]="10">10</option>
              <option [value]="20">20</option>
              <option [value]="50">50</option>
            </select>
          </div>

          <div class="font-mono text-slate-700">
            {{ startIndex() }} - {{ endIndex() }} of {{ filteredLeads().length }}
          </div>

          <div class="flex items-center gap-1">
            <button [disabled]="currentPage() === 1" (click)="goToFirstPage()" class="p-1 rounded hover:bg-slate-100 disabled:opacity-30 text-slate-500">
              <span class="material-icons text-sm">first_page</span>
            </button>
            <button [disabled]="currentPage() === 1" (click)="prevPage()" class="p-1 rounded hover:bg-slate-100 disabled:opacity-30 text-slate-500">
              <span class="material-icons text-sm">chevron_left</span>
            </button>
            <button [disabled]="endIndex() >= filteredLeads().length" (click)="nextPage()" class="p-1 rounded hover:bg-slate-100 disabled:opacity-30 text-slate-500">
              <span class="material-icons text-sm">chevron_right</span>
            </button>
            <button [disabled]="endIndex() >= filteredLeads().length" (click)="goToLastPage()" class="p-1 rounded hover:bg-slate-100 disabled:opacity-30 text-slate-500">
              <span class="material-icons text-sm">last_page</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  `
})
export class LeadListComponent implements OnInit {
  private db = inject(ApplicationDatabase);
  private router = inject(Router);
  stallService = inject(StallService);

  allLeads = signal<LocalLead[]>([]);
  pageSize = signal(20);
  pageSizeSelect = 20;
  currentPage = signal(1);

  async ngOnInit(): Promise<void> {
    await this.loadLeads();
  }

  async loadLeads(): Promise<void> {
    const list = await this.db.getAllLeads();
    this.allLeads.set(list);
  }

  onStallChange(stallId: string): void {
    const found = this.stallService.stalls().find((s) => s.id === stallId);
    if (found) {
      this.stallService.setActiveStall(found);
      this.currentPage.set(1);
    }
  }

  filteredLeads = computed(() => {
    const activeStallId = this.stallService.activeStall()?.id;
    if (!activeStallId) return this.allLeads();
    return this.allLeads().filter((l) => l.exhibitionId === activeStallId || !l.exhibitionId);
  });

  paginatedLeads = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize();
    return this.filteredLeads().slice(start, start + this.pageSize());
  });

  startIndex = computed(() => {
    if (this.filteredLeads().length === 0) return 0;
    return (this.currentPage() - 1) * this.pageSize() + 1;
  });

  endIndex = computed(() => Math.min(this.currentPage() * this.pageSize(), this.filteredLeads().length));

  onPageSizeChange(): void {
    this.pageSize.set(Number(this.pageSizeSelect));
    this.currentPage.set(1);
  }

  prevPage(): void {
    if (this.currentPage() > 1) this.currentPage.update((p) => p - 1);
  }

  nextPage(): void {
    if (this.endIndex() < this.filteredLeads().length) this.currentPage.update((p) => p + 1);
  }

  goToFirstPage(): void {
    this.currentPage.set(1);
  }

  goToLastPage(): void {
    const totalPages = Math.ceil(this.filteredLeads().length / this.pageSize());
    this.currentPage.set(Math.max(1, totalPages));
  }

  viewLeadDetails(lead: LocalLead): void {
    alert(`Visitor Lead Details:\nName: ${lead.name}\nCompany: ${lead.company}\nPhone: ${lead.phone}\nDesignation: ${lead.designation || '-'}\nRemarks: ${lead.remarks || 'None'}`);
  }

  editLead(lead: LocalLead): void {
    this.router.navigate(['/capture', lead.id]);
  }

  async deleteLead(lead: LocalLead): Promise<void> {
    if (confirm(`Are you sure you want to delete lead enquiry for ${lead.name}?`)) {
      await this.db.deleteLead(lead.id);
      await this.loadLeads();
    }
  }
}
