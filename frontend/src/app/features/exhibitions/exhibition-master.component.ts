import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ExhibitionService, ExhibitionDto, CreateExhibitionRequest, InlineStallRequest } from '../../core/services/exhibition.service';
import { StallService } from '../../core/services/stall.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-exhibition-master',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div>
      <!-- Page Title & Top Action Bar -->
      <div class="page-title-bar flex items-center justify-between mb-6">
        <div>
          <h1 class="page-title text-xl font-bold text-slate-900 uppercase tracking-wide">EXHIBITION MASTER</h1>
          <p class="text-xs text-slate-500">Conducted & Upcoming Exhibitions, Venues, Organizers, and Linked Stalls</p>
        </div>

        <div class="page-actions flex items-center gap-2">
          @if (canCreateExhibition()) {
            <button 
              (click)="openCreateModal()" 
              class="btn btn-primary text-xs px-4 py-2 rounded-lg font-bold flex items-center gap-1.5 shadow-md bg-[#1a3a5c] hover:bg-[#132b45] text-white"
            >
              <span class="material-icons text-sm">add_circle</span>
              Create New Exhibition
            </button>
          }
        </div>
      </div>

      <!-- Top KPI Summary Cards -->
      <div class="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <span class="material-icons text-lg">event</span>
          </div>
          <div>
            <div class="text-xs text-slate-500 font-semibold uppercase">Total Exhibitions</div>
            <div class="text-lg font-black text-slate-900">{{ exhibitions().length }}</div>
          </div>
        </div>

        <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <span class="material-icons text-lg">play_circle_filled</span>
          </div>
          <div>
            <div class="text-xs text-slate-500 font-semibold uppercase">Active</div>
            <div class="text-lg font-black text-emerald-700">{{ activeCount() }}</div>
          </div>
        </div>

        <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
            <span class="material-icons text-lg">upcoming</span>
          </div>
          <div>
            <div class="text-xs text-slate-500 font-semibold uppercase">Upcoming</div>
            <div class="text-lg font-black text-amber-700">{{ upcomingCount() }}</div>
          </div>
        </div>

        <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <span class="material-icons text-lg">task_alt</span>
          </div>
          <div>
            <div class="text-xs text-slate-500 font-semibold uppercase">Completed</div>
            <div class="text-lg font-black text-blue-700">{{ completedCount() }}</div>
          </div>
        </div>

        <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
            <span class="material-icons text-lg">storefront</span>
          </div>
          <div>
            <div class="text-xs text-slate-500 font-semibold uppercase">Total Stalls</div>
            <div class="text-lg font-black text-purple-700">{{ totalStallsCount() }}</div>
          </div>
        </div>
      </div>

      <!-- Main Data Table Container Card -->
      <div class="card-panel p-0 overflow-hidden bg-white rounded-xl border border-slate-200 shadow-sm">
        
        <!-- Search & Status Filter Bar -->
        <div class="p-4 bg-white border-b border-slate-200 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div class="w-80 relative">
            <span class="material-icons absolute left-3 top-2.5 text-slate-400 text-sm">search</span>
            <input 
              type="text" 
              [(ngModel)]="searchQuery" 
              placeholder="Search code, title, venue, organizer..." 
              class="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg outline-none focus:border-blue-600 font-medium"
            />
          </div>

          <!-- Status Filter Tabs -->
          <div class="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200/80">
            <button 
              (click)="selectedStatusFilter.set('ALL'); currentPage.set(1)"
              class="px-3 py-1 text-xs font-bold rounded-md transition"
              [ngClass]="selectedStatusFilter() === 'ALL' ? 'bg-white text-blue-800 shadow-xs border border-slate-200' : 'text-slate-600 hover:text-slate-900'"
            >
              All
            </button>
            <button 
              (click)="selectedStatusFilter.set('Active'); currentPage.set(1)"
              class="px-3 py-1 text-xs font-bold rounded-md transition"
              [ngClass]="selectedStatusFilter() === 'Active' ? 'bg-white text-emerald-800 shadow-xs border border-slate-200' : 'text-slate-600 hover:text-slate-900'"
            >
              Active
            </button>
            <button 
              (click)="selectedStatusFilter.set('Upcoming'); currentPage.set(1)"
              class="px-3 py-1 text-xs font-bold rounded-md transition"
              [ngClass]="selectedStatusFilter() === 'Upcoming' ? 'bg-white text-amber-800 shadow-xs border border-slate-200' : 'text-slate-600 hover:text-slate-900'"
            >
              Upcoming
            </button>
            <button 
              (click)="selectedStatusFilter.set('Completed'); currentPage.set(1)"
              class="px-3 py-1 text-xs font-bold rounded-md transition"
              [ngClass]="selectedStatusFilter() === 'Completed' ? 'bg-white text-blue-800 shadow-xs border border-slate-200' : 'text-slate-600 hover:text-slate-900'"
            >
              Completed
            </button>
          </div>
        </div>

        <!-- Table Data Grid (Matching AriyAI #1a3a5c Navy Master Theme) -->
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-[#1a3a5c] text-white text-[11px] font-bold uppercase tracking-wider">
                <th class="py-2.5 px-4 border-r border-white/20">Code</th>
                <th class="py-2.5 px-4 border-r border-white/20">Exhibition Title</th>
                <th class="py-2.5 px-4 border-r border-white/20">Organizer</th>
                <th class="py-2.5 px-4 border-r border-white/20">Venue / Location</th>
                <th class="py-2.5 px-4 border-r border-white/20">Event Dates</th>
                <th class="py-2.5 px-4 border-r border-white/20 text-center">Stalls</th>
                <th class="py-2.5 px-4 border-r border-white/20 text-center">Leads</th>
                <th class="py-2.5 px-4 border-r border-white/20 text-center">Status</th>
                <th class="py-2.5 px-3 border-r border-white/20 text-center w-14">Edit</th>
                <th class="py-2.5 px-3 text-center w-14">Delete</th>
              </tr>
            </thead>
            <tbody class="text-xs text-slate-700 font-medium">
              @for (exhibition of paginatedExhibitions(); track exhibition.id; let idx = $index) {
                <tr 
                  class="border-b border-slate-100 transition"
                  [ngClass]="idx % 2 === 0 ? 'bg-[#f4f8fc]' : 'bg-white'"
                >
                  <!-- Exhibition Code Badge -->
                  <td class="py-2.5 px-4 font-mono font-bold border-r border-slate-200/60">
                    <span class="bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-0.5 rounded text-[11px] inline-block shadow-2xs">
                      {{ exhibition.code }}
                    </span>
                  </td>

                  <!-- Title -->
                  <td class="py-2.5 px-4 border-r border-slate-200/60">
                    <div class="font-bold text-slate-900 text-xs">{{ exhibition.name }}</div>
                    @if (exhibition.description) {
                      <div class="text-[11px] text-slate-400 font-normal truncate max-w-xs">{{ exhibition.description }}</div>
                    }
                  </td>

                  <!-- Organizer -->
                  <td class="py-2.5 px-4 text-slate-700 font-semibold border-r border-slate-200/60">
                    {{ exhibition.organizer }}
                  </td>

                  <!-- Venue Location -->
                  <td class="py-2.5 px-4 text-slate-700 font-medium border-r border-slate-200/60 max-w-xs truncate">
                    <span class="material-icons text-xs text-slate-400 align-middle mr-0.5">place</span>
                    {{ exhibition.venue }}
                  </td>

                  <!-- Event Dates -->
                  <td class="py-2.5 px-4 text-slate-700 font-medium border-r border-slate-200/60 whitespace-nowrap">
                    {{ exhibition.startDate ? (exhibition.startDate | date:'mediumDate') : 'TBD' }} 
                    - 
                    {{ exhibition.endDate ? (exhibition.endDate | date:'mediumDate') : 'TBD' }}
                    <span class="text-[10px] text-slate-400 block font-bold">({{ exhibition.durationDays }} Days)</span>
                  </td>

                  <!-- Stalls -->
                  <td class="py-2.5 px-4 text-center border-r border-slate-200/60">
                    <button 
                      (click)="viewStalls(exhibition)" 
                      class="px-2.5 py-0.5 bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 rounded-full text-xs font-bold transition flex items-center justify-center gap-1 mx-auto shadow-2xs"
                      title="View stalls linked to this exhibition"
                    >
                      <span class="material-icons text-xs">storefront</span>
                      {{ exhibition.stallCount }} Stall{{ exhibition.stallCount === 1 ? '' : 's' }}
                    </button>
                  </td>

                  <!-- Leads -->
                  <td class="py-2.5 px-4 text-center border-r border-slate-200/60">
                    <span class="px-2.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-xs font-bold inline-block shadow-2xs">
                      {{ exhibition.leadCount }} Leads
                    </span>
                  </td>

                  <!-- Status -->
                  <td class="py-2.5 px-4 text-center border-r border-slate-200/60">
                    <span 
                      class="px-2.5 py-0.5 rounded text-[11px] font-bold uppercase inline-block"
                      [ngClass]="{
                        'bg-emerald-100 text-emerald-800': exhibition.status === 'Active',
                        'bg-amber-100 text-amber-800': exhibition.status === 'Upcoming',
                        'bg-blue-100 text-blue-800': exhibition.status === 'Completed',
                        'bg-slate-100 text-slate-600': exhibition.status === 'Archived'
                      }"
                    >
                      {{ exhibition.status }}
                    </span>
                  </td>

                  <!-- Edit -->
                  <td class="py-2.5 px-3 text-center border-r border-slate-200/60">
                    <button 
                      (click)="editExhibition(exhibition)" 
                      class="text-blue-600 hover:text-blue-800 p-0.5"
                      title="Edit Exhibition"
                    >
                      <span class="material-icons text-base">edit</span>
                    </button>
                  </td>

                  <!-- Delete -->
                  <td class="py-2.5 px-3 text-center">
                    @if (canDeleteExhibition()) {
                      <button 
                        (click)="promptDeleteExhibition(exhibition)" 
                        class="text-red-600 hover:text-red-800 p-0.5"
                        title="Delete Exhibition"
                      >
                        <span class="material-icons text-base">delete</span>
                      </button>
                    }
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="10" class="py-8 text-center text-slate-400 font-medium">
                    No exhibitions found. Click "Create New Exhibition" to add one.
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <!-- Table Footer / Pagination -->
        <div class="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600 font-medium">
          <div class="flex items-center gap-2">
            <span>Items per page:</span>
            <select [(ngModel)]="pageSizeSelect" (change)="onPageSizeChange()" class="border border-slate-300 rounded px-2.5 py-1 bg-white text-xs outline-none focus:border-blue-600 font-semibold cursor-pointer">
              <option [value]="10">10</option>
              <option [value]="20">20</option>
              <option [value]="50">50</option>
            </select>
          </div>

          <div>
            {{ startIndex() }} - {{ endIndex() }} of {{ filteredExhibitions().length }}
          </div>

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
              [disabled]="endIndex() >= filteredExhibitions().length" 
              (click)="nextPage()" 
              class="p-1 rounded hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition text-slate-600" 
              title="Next Page"
            >
              <span class="material-icons text-base">chevron_right</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Modal: Create / Edit Exhibition -->
      @if (isModalOpen()) {
        <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div class="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <!-- Modal Header -->
            <div class="px-6 py-4 bg-[#1a3a5c] text-white flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="material-icons text-blue-300">event_available</span>
                <h3 class="font-extrabold text-base tracking-wide">
                  {{ isEditMode() ? 'Edit Exhibition Details' : 'Create New Exhibition' }}
                </h3>
              </div>
              <button (click)="closeModal()" class="text-white/80 hover:text-white transition p-1">
                <span class="material-icons text-base">close</span>
              </button>
            </div>

            <!-- Form Body -->
            <div class="p-6 overflow-y-auto space-y-4 flex-1">
              <!-- Code & Status -->
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-xs font-bold text-slate-700 mb-1">Exhibition Code (Auto)</label>
                  <input 
                    type="text" 
                    [value]="formCode()" 
                    disabled 
                    class="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-xs font-mono font-bold text-blue-800"
                  />
                </div>
                <div>
                  <label class="block text-xs font-bold text-slate-700 mb-1">Status *</label>
                  <select 
                    [(ngModel)]="formStatus" 
                    class="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="Active">Active</option>
                    <option value="Upcoming">Upcoming</option>
                    <option value="Completed">Completed</option>
                    <option value="Archived">Archived</option>
                  </select>
                </div>
              </div>

              <!-- Title -->
              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">Exhibition Title *</label>
                <input 
                  type="text" 
                  [(ngModel)]="formName" 
                  placeholder="e.g. International TexFair 2026" 
                  class="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <!-- Organizer & Venue -->
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-xs font-bold text-slate-700 mb-1">Organizer Name *</label>
                  <input 
                    type="text" 
                    [(ngModel)]="formOrganizer" 
                    placeholder="e.g. SIMA Trade Association" 
                    class="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label class="block text-xs font-bold text-slate-700 mb-1">Venue / Location *</label>
                  <input 
                    type="text" 
                    [(ngModel)]="formVenue" 
                    placeholder="e.g. Codissia Trade Fair Complex, Coimbatore" 
                    class="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <!-- Start Date & Duration -->
              <div class="grid grid-cols-3 gap-4">
                <div>
                  <label class="block text-xs font-bold text-slate-700 mb-1">Start Date</label>
                  <input 
                    type="date" 
                    [(ngModel)]="formStartDate" 
                    (ngModelChange)="onDateChange()"
                    class="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label class="block text-xs font-bold text-slate-700 mb-1">End Date</label>
                  <input 
                    type="date" 
                    [(ngModel)]="formEndDate" 
                    (ngModelChange)="onDateChange()"
                    class="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label class="block text-xs font-bold text-slate-700 mb-1">Duration (Days)</label>
                  <input 
                    type="number" 
                    [(ngModel)]="formDurationDays" 
                    readonly
                    tabindex="-1"
                    placeholder="Auto-calculated"
                    class="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-bold bg-slate-100 text-blue-900 cursor-not-allowed outline-none select-none"
                  />
                </div>
              </div>

              <!-- Description -->
              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">Description</label>
                <textarea 
                  [(ngModel)]="formDescription" 
                  rows="2" 
                  placeholder="Additional event details, targets, or instructions..." 
                  class="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                ></textarea>
              </div>


            </div>

            <!-- Modal Footer -->
            <div class="px-6 py-3 bg-slate-100 border-t border-slate-200 flex items-center justify-end gap-2">
              <button 
                (click)="closeModal()" 
                class="px-4 py-2 border border-slate-300 hover:bg-white rounded-lg text-xs font-bold text-slate-700 transition"
              >
                Cancel
              </button>
              <button 
                (click)="saveExhibition()" 
                class="px-5 py-2 bg-[#1a3a5c] hover:bg-[#132b45] text-white rounded-lg text-xs font-bold transition shadow"
              >
                {{ isEditMode() ? 'Save Changes' : 'Create Exhibition' }}
              </button>
            </div>
          </div>
        </div>
      }

      <!-- Modal Drawer: Linked Stalls -->
      @if (selectedExhibitionForStalls()) {
        <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div class="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden flex flex-col max-h-[85vh]">
            <div class="px-6 py-4 bg-[#1a3a5c] text-white flex items-center justify-between">
              <div>
                <h3 class="font-extrabold text-base tracking-wide flex items-center gap-2">
                  <span class="material-icons">storefront</span>
                  Stalls in {{ selectedExhibitionForStalls()?.name }}
                </h3>
                <p class="text-xs text-blue-200 mt-0.5">{{ selectedExhibitionForStalls()?.organizer }} • {{ selectedExhibitionForStalls()?.venue }}</p>
              </div>
              <button (click)="closeStallsModal()" class="text-white/80 hover:text-white transition p-1">
                <span class="material-icons text-base">close</span>
              </button>
            </div>

            <div class="p-6 overflow-y-auto space-y-3 flex-1">
              @for (stall of linkedStallsList(); track stall.id) {
                <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                  <div>
                    <span class="px-2 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-mono font-extrabold rounded mr-2">
                      {{ stall.code }}
                    </span>
                    <span class="font-bold text-slate-900 text-xs">{{ stall.name }}</span>
                    <div class="text-[11px] text-slate-500 font-medium mt-0.5">
                      {{ stall.hallNumber || 'Hall A' }} • {{ stall.boothNumber || 'Booth 01' }} | Owner: {{ stall.ownerName }}
                    </div>
                  </div>
                  <span class="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[10px] font-bold">Active</span>
                </div>
              } @empty {
                <div class="text-center py-6 text-slate-400 text-xs font-medium">
                  No stalls currently linked to this exhibition.
                </div>
              }
            </div>

            <div class="px-6 py-3 bg-slate-100 border-t border-slate-200 flex items-center justify-between">
              <button 
                (click)="goToCreateStallForExhibition(selectedExhibitionForStalls()!)"
                class="px-3 py-1.5 bg-[#1a3a5c] hover:bg-[#132b45] text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-xs"
              >
                <span class="material-icons text-xs">add</span> Add Stall in Stall Master
              </button>
              <button (click)="closeStallsModal()" class="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-bold transition">
                Close
              </button>
            </div>
          </div>
        </div>
      }

      <!-- Delete Confirmation Modal -->
      @if (selectedExhibitionForDelete()) {
        <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div class="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 text-center">
            <div class="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-3">
              <span class="material-icons text-2xl">warning</span>
            </div>
            <h3 class="text-base font-bold text-slate-900 mb-1">Delete Exhibition?</h3>
            <p class="text-xs text-slate-500 mb-4">
              Are you sure you want to delete <strong class="text-slate-900">{{ selectedExhibitionForDelete()?.name }}</strong>? Associated stalls will be unlinked.
            </p>
            <div class="flex items-center justify-center gap-3">
              <button 
                (click)="selectedExhibitionForDelete.set(null)" 
                class="px-4 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button 
                (click)="confirmDeleteExhibition()" 
                class="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition shadow"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `
})
export class ExhibitionMasterComponent implements OnInit {
  private exhibitionService = inject(ExhibitionService);
  private stallService = inject(StallService);
  private authService = inject(AuthService);
  private toastService = inject(ToastService);
  private router = inject(Router);

  exhibitions = this.exhibitionService.exhibitions;

  searchQuery = '';
  selectedStatusFilter = signal<string>('ALL');

  isModalOpen = signal(false);
  isEditMode = signal(false);
  editingId = signal<string | null>(null);

  formCode = signal('');
  formName = '';
  formOrganizer = '';
  formVenue = '';
  formStartDate = '';
  formEndDate = '';
  formDurationDays = 3;
  formDescription = '';
  formStatus = 'Active';

  inlineStalls: InlineStallRequest[] = [];

  selectedExhibitionForStalls = signal<ExhibitionDto | null>(null);
  linkedStallsList = signal<any[]>([]);

  selectedExhibitionForDelete = signal<ExhibitionDto | null>(null);

  activeCount = computed(() => this.exhibitions().filter(e => e.status === 'Active').length);
  upcomingCount = computed(() => this.exhibitions().filter(e => e.status === 'Upcoming').length);
  completedCount = computed(() => this.exhibitions().filter(e => e.status === 'Completed').length);
  totalStallsCount = computed(() => this.exhibitions().reduce((acc, curr) => acc + (curr.stallCount || 0), 0));

  filteredExhibitions = computed(() => {
    const q = this.searchQuery.trim().toLowerCase();
    const status = this.selectedStatusFilter();

    return this.exhibitions().filter(e => {
      const matchesSearch = !q || 
        e.code.toLowerCase().includes(q) || 
        e.name.toLowerCase().includes(q) || 
        e.organizer.toLowerCase().includes(q) || 
        e.venue.toLowerCase().includes(q);

      const matchesStatus = status === 'ALL' || e.status.toLowerCase() === status.toLowerCase();

      return matchesSearch && matchesStatus;
    });
  });

  pageSize = signal(10);
  pageSizeSelect = 10;
  currentPage = signal(1);

  paginatedExhibitions = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize();
    return this.filteredExhibitions().slice(start, start + this.pageSize());
  });

  startIndex = computed(() => {
    if (this.filteredExhibitions().length === 0) return 0;
    return (this.currentPage() - 1) * this.pageSize() + 1;
  });

  endIndex = computed(() => Math.min(this.currentPage() * this.pageSize(), this.filteredExhibitions().length));

  onPageSizeChange(): void {
    this.pageSize.set(Number(this.pageSizeSelect));
    this.currentPage.set(1);
  }

  prevPage(): void {
    if (this.currentPage() > 1) this.currentPage.update((p) => p - 1);
  }

  nextPage(): void {
    if (this.endIndex() < this.filteredExhibitions().length) this.currentPage.update((p) => p + 1);
  }

  ngOnInit(): void {
    this.exhibitionService.loadExhibitions();
  }

  canCreateExhibition(): boolean {
    return this.authService.currentUser()?.role === 'Admin' || true;
  }

  canDeleteExhibition(): boolean {
    return this.authService.currentUser()?.role === 'Admin';
  }

  openCreateModal(): void {
    this.isEditMode.set(false);
    this.editingId.set(null);
    this.formName = '';
    this.formOrganizer = '';
    this.formVenue = '';
    this.formStartDate = '';
    this.formEndDate = '';
    this.formDurationDays = null as any;
    this.formDescription = '';
    this.formStatus = 'Upcoming';
    this.inlineStalls = [];

    this.exhibitionService.getNextCode().subscribe({
      next: (res) => this.formCode.set(res.code),
      error: () => this.formCode.set(`EXH-${new Date().getFullYear()}-001`)
    });

    this.isModalOpen.set(true);
  }

  editExhibition(exhibition: ExhibitionDto): void {
    this.isEditMode.set(true);
    this.editingId.set(exhibition.id);
    this.formCode.set(exhibition.code);
    this.formName = exhibition.name;
    this.formOrganizer = exhibition.organizer;
    this.formVenue = exhibition.venue;
    this.formStartDate = exhibition.startDate ? exhibition.startDate.split('T')[0] : '';
    this.formEndDate = exhibition.endDate ? exhibition.endDate.split('T')[0] : '';
    this.formDurationDays = exhibition.durationDays || 3;
    this.formDescription = exhibition.description || '';
    this.formStatus = exhibition.status || 'Active';
    this.inlineStalls = [];
    this.onDateChange();

    this.isModalOpen.set(true);
  }

  onDateChange(): void {
    if (this.formStartDate && this.formEndDate) {
      const start = new Date(this.formStartDate);
      const end = new Date(this.formEndDate);
      if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end >= start) {
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
        this.formDurationDays = diffDays;
      }
    }
  }

  closeModal(): void {
    this.isModalOpen.set(false);
  }

  addInlineStall(): void {
    this.inlineStalls.push({
      name: '',
      hallNumber: '',
      boothNumber: '',
      ownerName: ''
    });
  }

  removeInlineStall(index: number): void {
    this.inlineStalls.splice(index, 1);
  }

  saveExhibition(): void {
    if (!this.formName.trim()) {
      this.toastService.showError('Validation Error', 'Exhibition title is required.');
      return;
    }

    const payload: CreateExhibitionRequest = {
      name: this.formName.trim(),
      code: this.formCode(),
      organizer: this.formOrganizer.trim(),
      venue: this.formVenue.trim(),
      startDate: this.formStartDate ? new Date(this.formStartDate).toISOString() : undefined,
      endDate: this.formEndDate ? new Date(this.formEndDate).toISOString() : undefined,
      durationDays: this.formDurationDays,
      description: this.formDescription.trim(),
      status: this.formStatus,
      initialStalls: !this.isEditMode() ? this.inlineStalls : undefined
    };

    if (this.isEditMode() && this.editingId()) {
      this.exhibitionService.updateExhibition(this.editingId()!, payload).subscribe({
        next: () => {
          this.toastService.showSuccess('Exhibition Updated', 'Exhibition details updated successfully.');
          this.closeModal();
        },
        error: () => this.toastService.showError('Update Failed', 'Failed to update exhibition details.')
      });
    } else {
      this.exhibitionService.createExhibition(payload).subscribe({
        next: () => {
          this.toastService.showSuccess('Exhibition Created', 'Exhibition and stalls created successfully.');
          this.stallService.loadStalls();
          this.closeModal();
        },
        error: () => this.toastService.showError('Creation Failed', 'Failed to create new exhibition.')
      });
    }
  }

  viewStalls(exhibition: ExhibitionDto): void {
    this.selectedExhibitionForStalls.set(exhibition);
    this.exhibitionService.getExhibitionById(exhibition.id).subscribe({
      next: (res) => {
        this.linkedStallsList.set(res.stalls || []);
      },
      error: () => {
        this.linkedStallsList.set([]);
      }
    });
  }

  closeStallsModal(): void {
    this.selectedExhibitionForStalls.set(null);
  }

  goToCreateStallForExhibition(exhibition: ExhibitionDto): void {
    this.closeStallsModal();
    this.router.navigate(['/stalls'], { queryParams: { exhibitionId: exhibition.id } });
  }

  promptDeleteExhibition(exhibition: ExhibitionDto): void {
    this.selectedExhibitionForDelete.set(exhibition);
  }

  confirmDeleteExhibition(): void {
    const item = this.selectedExhibitionForDelete();
    if (!item) return;

    this.exhibitionService.deleteExhibition(item.id).subscribe({
      next: () => {
        this.toastService.showSuccess('Exhibition Deleted', `Deleted ${item.name}.`);
        this.selectedExhibitionForDelete.set(null);
      },
      error: () => this.toastService.showError('Delete Failed', 'Could not delete exhibition.')
    });
  }
}
