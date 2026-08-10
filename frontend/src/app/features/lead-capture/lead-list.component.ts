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
                [ngModel]="selectedStallId()" 
                (ngModelChange)="onStallFilterChange($event)" 
                class="border border-slate-300 rounded-md px-3 py-1 text-xs font-bold text-slate-800 bg-slate-50 outline-none focus:border-blue-600"
              >
                <option value="ALL">All Stalls (All Leads)</option>
                @for (stall of stallService.stalls(); track stall.id) {
                  <option [value]="stall.id">{{ stall.name }} ({{ stall.code }})</option>
                }
              </select>
            </div>
          </div>
        </div>

        <div class="text-xs bg-slate-100 text-slate-600 px-3 py-1.5 rounded-full font-medium border">
          Owner: <strong>{{ selectedStallId() === 'ALL' ? 'All Owners' : (stallService.activeStall()?.ownerName || 'Thalaimalai') }}</strong>
        </div>
      </div>

      <!-- Page Title & Top Action Buttons -->
      <div class="page-title-bar flex items-center justify-between mb-6">
        <div>
          <h1 class="page-title text-xl font-bold text-slate-900 uppercase tracking-wide">LEADS</h1>
          <p class="text-xs text-slate-500">Live Grid of Captured Visitor Enquiries {{ selectedStallId() === 'ALL' ? 'for All Stalls' : ('for ' + (stallService.activeStall()?.name || 'Active Stall')) }}</p>
        </div>

        <div class="page-actions flex items-center gap-2">
          <a routerLink="/capture" class="btn btn-primary text-xs px-4 py-2 rounded-lg font-bold flex items-center gap-1.5 shadow-md">
            <span class="material-icons text-sm">add</span>
            Add New Lead
          </a>
        </div>
      </div>

      <!-- Main Data Table Container -->
      <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-6">
        
        <!-- Table Header Title Row -->
        <div class="p-4 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <h2 class="text-sm font-bold text-slate-900">
            {{ selectedStallId() === 'ALL' ? 'All Captured Leads (All Stalls)' : ('Stall Leads (Isolated to ' + (stallService.activeStall()?.code || 'STL-2026-001') + ')') }}
          </h2>
          <span class="text-xs text-slate-400 font-medium">
            Showing {{ filteredLeads().length }} total visitor leads
          </span>
        </div>

        <!-- Rich ERP Data Grid with Separated Actions Columns -->
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-[#1a3a5c] text-white text-[11px] font-bold uppercase tracking-wider">
                <th class="py-1.5 px-4 border-r border-white/20">LEAD NO.</th>
                <th class="py-1.5 px-4 border-r border-white/20">VISITOR NAME</th>
                <th class="py-1.5 px-4 border-r border-white/20">STALL NAME</th>
                <th class="py-1.5 px-4 border-r border-white/20">COMPANY</th>
                <th class="py-1.5 px-4 border-r border-white/20">MOBILE</th>
                <th class="py-1.5 px-4 border-r border-white/20">DESIGNATION</th>
                <th class="py-1.5 px-4 border-r border-white/20 text-center">INTEREST LEVEL</th>
                <th class="py-1.5 px-4 border-r border-white/20 text-center">SYNC STATUS</th>
                <th class="py-1.5 px-3 border-r border-white/20 text-center w-14">View</th>
                <th class="py-1.5 px-3 border-r border-white/20 text-center w-14">Edit</th>
                <th class="py-1.5 px-3 text-center w-14">Delete</th>
              </tr>
            </thead>
            <tbody class="text-xs text-slate-700 font-normal">
              @for (lead of paginatedLeads(); track lead.id; let idx = $index) {
                <tr 
                  class="border-b border-slate-100 transition"
                  [ngClass]="idx % 2 === 0 ? 'bg-[#f4f8fc]' : 'bg-white'"
                >
                  <!-- Lead Number -->
                  <td class="py-1.5 px-4 text-xs font-normal text-slate-700 border-r border-slate-200/60">
                    {{ lead.leadNumber }}
                  </td>

                  <!-- Visitor Name -->
                  <td class="py-1.5 px-4 text-xs font-normal text-slate-700 border-r border-slate-200/60">
                    <div class="flex items-center justify-between gap-1">
                      <span>{{ lead.name }}</span>
                      @if (lead.voiceBlob || lead.voiceNotesTranscript) {
                        <span class="material-icons text-sm text-red-600 bg-red-50 p-0.5 rounded" title="Voice Note Audio Attached">mic</span>
                      }
                    </div>
                  </td>

                  <!-- Stall Name -->
                  <td class="py-1.5 px-4 text-xs font-normal text-slate-700 border-r border-slate-200/60">
                    {{ getStallName(lead.exhibitionId) }}
                  </td>

                  <!-- Company -->
                  <td class="py-1.5 px-4 text-xs font-normal text-slate-700 border-r border-slate-200/60">
                    {{ lead.company }}
                  </td>

                  <!-- Mobile -->
                  <td class="py-1.5 px-4 text-xs font-normal text-slate-700 border-r border-slate-200/60">
                    {{ lead.phone }}
                  </td>

                  <!-- Designation -->
                  <td class="py-1.5 px-4 text-xs font-normal text-slate-700 border-r border-slate-200/60">
                    {{ lead.designation || '-' }}
                  </td>

                  <!-- Interest Level -->
                  <td class="py-1.5 px-4 text-xs font-normal text-center border-r border-slate-200/60">
                    <span 
                      class="px-2.5 py-0.5 rounded-full text-xs font-normal inline-block"
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
                  <td class="py-1.5 px-4 text-xs font-normal text-center border-r border-slate-200/60">
                    <span 
                      class="px-2.5 py-0.5 rounded text-xs font-normal inline-block"
                      [ngClass]="lead.syncStatus === 'Synced' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-orange-50 text-orange-600 border border-orange-200'"
                    >
                      {{ lead.syncStatus === 'Synced' ? 'Synced' : 'Pending' }}
                    </span>
                  </td>

                  <!-- Action Column 1: View Modal Trigger -->
                  <td class="py-1.5 px-3 text-center border-r border-slate-200/60">
                    <button (click)="openViewModal(lead)" class="text-slate-500 hover:text-blue-600 p-0.5 transition" title="View Details">
                      <span class="material-icons text-base">visibility</span>
                    </button>
                  </td>

                  <!-- Action Column 2: Edit -->
                  <td class="py-1.5 px-3 text-center border-r border-slate-200/60">
                    <button (click)="editLead(lead)" class="text-blue-600 hover:text-blue-800 p-0.5 transition" title="Edit Record">
                      <span class="material-icons text-base">edit</span>
                    </button>
                  </td>

                  <!-- Action Column 3: Delete -->
                  <td class="py-1.5 px-3 text-center">
                    <button (click)="deleteLead(lead)" class="text-rose-600 hover:text-rose-800 p-0.5 transition" title="Delete Record">
                      <span class="material-icons text-base">delete</span>
                    </button>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="10" class="py-12 text-center text-slate-400">
                    No visitor lead records found.
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
              <option [value]="100">100</option>
            </select>
          </div>

          <div>
            {{ startIndex() }} - {{ endIndex() }} of {{ filteredLeads().length }}
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
              [disabled]="endIndex() >= filteredLeads().length" 
              (click)="nextPage()" 
              class="p-1 rounded hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition text-slate-600" 
              title="Next Page"
            >
              <span class="material-icons text-base">chevron_right</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Premium View Visitor Lead Details Modal -->
      @if (selectedLeadForView()) {
        <div class="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-hidden">
          <div class="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg max-h-[85vh] sm:max-h-[88vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            
            <!-- Fixed Modal Header -->
            <div class="bg-[#1a3a5c] text-white px-5 py-3.5 flex items-center justify-between shrink-0 border-b border-slate-700/50">
              <div class="flex items-center gap-2.5">
                <span class="material-icons text-blue-200">contact_page</span>
                <div>
                  <h3 class="text-sm font-bold uppercase tracking-wider">VISITOR LEAD DETAILS</h3>
                  <p class="text-[11px] text-blue-200 font-mono">LEAD NO: {{ selectedLeadForView()?.leadNumber || ('ENQ-' + selectedLeadForView()?.id?.substring(0, 8)?.toUpperCase()) }}</p>
                </div>
              </div>
              <button (click)="closeViewModal()" class="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors" title="Close">
                <span class="material-icons text-base">close</span>
              </button>
            </div>

            <!-- Scrollable Modal Content Body -->
            <div class="p-5 space-y-4 flex-1 overflow-y-auto min-h-0">
              <!-- Primary Visitor Info -->
              <div class="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <div class="text-base font-extrabold text-slate-900 mb-1">
                  {{ selectedLeadForView()?.name }}
                </div>
                <div class="text-xs font-semibold text-slate-600 mb-3 flex items-center gap-1.5">
                  <span class="material-icons text-sm text-slate-400">business</span>
                  {{ selectedLeadForView()?.company }}
                </div>

                <div class="grid grid-cols-2 gap-3 text-xs border-t pt-3">
                  <div>
                    <span class="text-[10px] text-slate-400 font-bold uppercase block">MOBILE PHONE</span>
                    <span class="font-semibold text-slate-800">{{ selectedLeadForView()?.phone }}</span>
                  </div>
                  <div>
                    <span class="text-[10px] text-slate-400 font-bold uppercase block">EMAIL ADDRESS</span>
                    <span class="font-semibold text-slate-800">{{ selectedLeadForView()?.email || 'N/A' }}</span>
                  </div>
                  <div>
                    <span class="text-[10px] text-slate-400 font-bold uppercase block">DESIGNATION</span>
                    <span class="font-semibold text-slate-800">{{ selectedLeadForView()?.designation || 'Visitor' }}</span>
                  </div>
                  <div>
                    <span class="text-[10px] text-slate-400 font-bold uppercase block">WEBSITE URL</span>
                    <span class="font-semibold text-slate-800">{{ selectedLeadForView()?.website || 'N/A' }}</span>
                  </div>
                  <div>
                    <span class="text-[10px] text-slate-400 font-bold uppercase block">ADDRESS / LOCATION</span>
                    <span class="font-semibold text-slate-800">{{ selectedLeadForView()?.address || 'N/A' }}</span>
                  </div>
                </div>
              </div>

              <!-- Metadata & Priority Pills -->
              <div class="flex items-center justify-between bg-blue-50/60 rounded-xl p-4 border border-blue-100">
                <div>
                  <span class="text-[10px] text-slate-500 font-bold uppercase block mb-1">INTEREST PRIORITY</span>
                  <span 
                    class="px-3 py-1 rounded-full text-xs font-extrabold inline-block"
                    [ngClass]="{
                      'bg-red-100 text-red-700 border border-red-200': selectedLeadForView()?.interestLevel === 'Hot',
                      'bg-amber-100 text-amber-700 border border-amber-200': selectedLeadForView()?.interestLevel === 'Warm',
                      'bg-blue-100 text-blue-700 border border-blue-200': selectedLeadForView()?.interestLevel === 'Cold'
                    }"
                  >
                    {{ selectedLeadForView()?.interestLevel }}
                  </span>
                </div>

                <div class="text-right">
                  <span class="text-[10px] text-slate-500 font-bold uppercase block mb-1">CRM SYNC STATUS</span>
                  <span 
                    class="px-3 py-1 rounded text-xs font-bold inline-block"
                    [ngClass]="selectedLeadForView()?.syncStatus === 'Synced' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-orange-100 text-orange-700 border border-orange-200'"
                  >
                    {{ selectedLeadForView()?.syncStatus === 'Synced' ? 'Synced' : 'Pending Sync' }}
                  </span>
                </div>
              </div>

              <!-- Discussion Remarks & Requirements -->
              <div>
                <label class="text-xs font-bold text-slate-700 block mb-1.5 uppercase tracking-wide">
                  DISCUSSION REMARKS & REQUIREMENTS
                </label>
                <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium leading-relaxed max-h-36 overflow-y-auto">
                  {{ selectedLeadForView()?.remarks || 'No discussion remarks recorded.' }}
                </div>
              </div>

              <!-- Business Card Image Section -->
              @if (selectedLeadForView()?.photoBlob) {
                <div class="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
                  <div class="flex items-center justify-between text-xs font-bold text-[#1a3a5c] uppercase tracking-wide">
                    <span class="flex items-center gap-1.5">
                      <span class="material-icons text-sm text-blue-600">credit_card</span>
                      Scanned Business Card Image
                    </span>
                    <button 
                      type="button" 
                      (click)="downloadLeadCardImage(selectedLeadForView())" 
                      class="text-[11px] text-blue-700 hover:text-blue-900 font-bold flex items-center gap-1 bg-blue-100/80 px-2.5 py-1 rounded border border-blue-200 transition shadow-2xs"
                    >
                      <span class="material-icons text-xs">download</span>
                      Download {{ selectedLeadForView()?.leadNumber }}.jpg
                    </button>
                  </div>
                  <div class="flex justify-center bg-slate-900/90 p-2 rounded-lg border border-slate-700">
                    <img [src]="getCardImageUrl(selectedLeadForView())" alt="Business Card" class="max-h-40 max-w-full object-contain rounded" />
                  </div>
                </div>
              }

              <!-- Voice Note Audio & Transcript Section -->
              @if (selectedLeadForView()?.voiceBlob || selectedLeadForView()?.voiceNotesTranscript) {
                <div class="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
                  <div class="flex items-center justify-between text-xs font-bold text-[#1a3a5c] uppercase tracking-wide">
                    <span class="flex items-center gap-1.5">
                      <span class="material-icons text-sm text-red-600">mic</span>
                      Voice Note Audio
                    </span>
                    <span class="text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      Attached
                    </span>
                  </div>
                  @if (getVoiceAudioUrl(selectedLeadForView())) {
                    <audio [src]="getVoiceAudioUrl(selectedLeadForView())" controls class="w-full h-8 rounded focus:outline-none"></audio>
                  }
                  @if (selectedLeadForView()?.voiceNotesTranscript) {
                    <div class="text-[11px] text-slate-600 bg-white p-2 rounded border border-slate-200 italic">
                      <span class="font-semibold text-blue-700 not-italic block mb-0.5">Live Transcript:</span>
                      "{{ selectedLeadForView()?.voiceNotesTranscript }}"
                    </div>
                  }
                </div>
              }
            </div>

            <!-- Fixed Modal Footer Action Bar -->
            <div class="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
              <button (click)="closeViewModal()" class="btn btn-outline-pill text-xs">
                Close
              </button>

              <button (click)="editFromViewModal()" class="btn btn-primary text-xs px-5 py-2 rounded-lg font-bold flex items-center gap-1.5 shadow-md">
                <span class="material-icons text-sm">edit</span>
                Edit Lead Record
              </button>
            </div>
          </div>
        </div>
      }

      <!-- Custom Delete Visitor Lead Confirmation Modal -->
      @if (selectedLeadForDelete()) {
        <div class="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div class="bg-white rounded-2xl shadow-2xl border border-red-100 max-w-md w-full p-6 space-y-5 animate-in zoom-in-95 duration-150 relative">
            
            <!-- Warning Header Icon -->
            <div class="flex items-center gap-3.5">
              <div class="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0 ring-8 ring-red-50">
                <span class="material-icons text-2xl">warning_amber</span>
              </div>
              <div>
                <h3 class="text-base font-bold text-slate-900">Delete Visitor Enquiry?</h3>
                <p class="text-xs text-slate-500 font-medium">Permanent action cannot be undone</p>
              </div>
            </div>

            <!-- Lead Summary Box -->
            <div class="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1">
              <div class="text-xs font-mono text-blue-600 font-bold">
                {{ selectedLeadForDelete()?.leadNumber || ('ENQ-' + selectedLeadForDelete()?.id?.substring(0, 8)?.toUpperCase()) }}
              </div>
              <div class="text-sm font-extrabold text-slate-900">
                {{ selectedLeadForDelete()?.name }}
              </div>
              @if (selectedLeadForDelete()?.company) {
                <div class="text-xs font-semibold text-slate-600 flex items-center gap-1">
                  <span class="material-icons text-xs text-slate-400">business</span>
                  {{ selectedLeadForDelete()?.company }}
                </div>
              }
            </div>

            <!-- Caution Message -->
            <p class="text-xs text-red-700 bg-red-50/80 border border-red-100 rounded-xl p-3 font-medium flex items-center gap-2">
              <span class="material-icons text-sm text-red-500 shrink-0">info</span>
              <span>This lead record and all attached media will be permanently deleted.</span>
            </p>

            <!-- Modal Action Buttons -->
            <div class="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button 
                type="button" 
                (click)="cancelDelete()" 
                class="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button 
                type="button" 
                (click)="confirmDeleteLead()" 
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
export class LeadListComponent implements OnInit {
  private db = inject(ApplicationDatabase);
  private router = inject(Router);
  stallService = inject(StallService);

  allLeads = signal<LocalLead[]>([]);
  selectedLeadForView = signal<LocalLead | null>(null);
  selectedStallId = signal<string>('ALL');

  pageSize = signal(20);
  pageSizeSelect = 20;
  currentPage = signal(1);

  async ngOnInit(): Promise<void> {
    await this.loadLeads();
  }

  async loadLeads(): Promise<void> {
    const list = await this.db.getAllLeads();
    let updated = false;
    for (let i = 0; i < list.length; i++) {
      if (!list[i].leadNumber) {
        list[i].leadNumber = `S1L${(list.length - i).toString().padStart(5, '0')}`;
        await this.db.saveLead(list[i]);
        updated = true;
      }
    }
    this.allLeads.set(list);
  }

  onStallFilterChange(stallId: string): void {
    this.selectedStallId.set(stallId);
    if (stallId !== 'ALL') {
      const found = this.stallService.stalls().find((s) => s.id === stallId);
      if (found) {
        this.stallService.setActiveStall(found);
      }
    }
    this.currentPage.set(1);
  }

  getStallName(exhibitionId?: string): string {
    if (!exhibitionId) return 'Stall 01 - Main Exhibition';
    const stall = this.stallService.stalls().find((s) => s.id === exhibitionId);
    return stall ? stall.name : 'Stall 01 - Main Exhibition';
  }

  filteredLeads = computed(() => {
    const stallId = this.selectedStallId();
    if (stallId === 'ALL' || !stallId) {
      return this.allLeads();
    }
    return this.allLeads().filter((l) => l.exhibitionId === stallId || (!l.exhibitionId && stallId === '33333333-3333-3333-3333-333333333333'));
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

  openViewModal(lead: LocalLead): void {
    this.selectedLeadForView.set(lead);
  }

  closeViewModal(): void {
    this.selectedLeadForView.set(null);
  }

  editFromViewModal(): void {
    const lead = this.selectedLeadForView();
    if (lead) {
      this.closeViewModal();
      this.editLead(lead);
    }
  }

  editLead(lead: LocalLead): void {
    this.router.navigate(['/capture', lead.id]);
  }

  getVoiceAudioUrl(lead: LocalLead | null): string | null {
    if (!lead || !lead.voiceBlob) return null;
    if (lead.voiceBlob instanceof Blob) {
      return URL.createObjectURL(lead.voiceBlob);
    }
    if (typeof lead.voiceBlob === 'string') {
      return lead.voiceBlob;
    }
    return null;
  }

  getCardImageUrl(lead: LocalLead | null): string | null {
    if (!lead || !lead.photoBlob) return null;
    if (typeof lead.photoBlob === 'string') return lead.photoBlob;
    if (lead.photoBlob instanceof Blob) return URL.createObjectURL(lead.photoBlob);
    return null;
  }

  downloadLeadCardImage(lead: LocalLead | null): void {
    if (!lead) return;
    const url = this.getCardImageUrl(lead);
    if (!url) return;
    const fileName = `${lead.leadNumber || 'S1L00001'}.jpg`;
    try {
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      console.warn('[LeadList] Image download failed:', e);
    }
  }

  selectedLeadForDelete = signal<LocalLead | null>(null);

  deleteLead(lead: LocalLead): void {
    this.selectedLeadForDelete.set(lead);
  }

  cancelDelete(): void {
    this.selectedLeadForDelete.set(null);
  }

  async confirmDeleteLead(): Promise<void> {
    const lead = this.selectedLeadForDelete();
    if (lead) {
      await this.db.deleteLead(lead.id);
      this.selectedLeadForDelete.set(null);
      await this.loadLeads();
    }
  }
}
