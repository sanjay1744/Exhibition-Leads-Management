import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { StallService } from '../../../core/services/stall.service';
import { ExhibitionService, ExhibitionDto } from '../../../core/services/exhibition.service';
import { ApplicationDatabase } from '../../../core/services/db.service';
import { getApiUrl } from '../../../core/config/api.config';
import { ToastService } from '../../../core/services/toast.service';
import { UserService } from '../../../core/services/user.service';
import { SupabaseSyncService } from '../../../core/services/supabase-sync.service';

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
  exhibitionId?: string;
}

@Component({
  selector: 'app-stall-master',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './stall-master.component.html',
  styleUrl: './stall-master.component.css'
})
export class StallMasterComponent implements OnInit {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private stallService = inject(StallService);
  private exhibitionService = inject(ExhibitionService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private toast = inject(ToastService);
  private db = inject(ApplicationDatabase);
  private userService = inject(UserService);
  private supabaseSync = inject(SupabaseSyncService);

  private get apiUrl() { return `${getApiUrl()}/stalls`; }

  stalls = signal<StallMasterDto[]>([]);
  exhibitions = this.exhibitionService.exhibitions;
  users = this.userService.users;
  searchQuery = '';
  isModalOpen = signal(false);
  isEditMode = signal(false);
  editingStallId: string | null = null;

  formData: {
    name: string;
    code: string;
    eventName: string;
    organizer: string;
    durationDays: number;
    startDate: string;
    endDate: string;
    location: string;
    hallNumber: string;
    boothNumber: string;
    ownerId: string;
    ownerName: string;
    exhibitionId?: string;
  } = {
    name: '',
    code: '',
    eventName: '',
    organizer: '',
    durationDays: null as any,
    startDate: '',
    endDate: '',
    location: '',
    hallNumber: '',
    boothNumber: '',
    ownerId: '',
    ownerName: '',
    exhibitionId: ''
  };

  currentUser = this.auth.currentUser();

  canCreateStall = computed(() => {
    const role = this.currentUser?.role;
    return role === 'Admin' || role === 'StallOwner';
  });

  ngOnInit(): void {
    this.exhibitionService.loadExhibitions();
    this.userService.initUsers();
    this.userService.getUsers().subscribe({
      next: (res) => {
        if (res) this.userService.users.set(res);
      }
    });
    this.fetchStalls();

    this.route.queryParams.subscribe((params) => {
      if (params['exhibitionId']) {
        this.openCreateModal(params['exhibitionId']);
      }
    });
  }

  onExhibitionChange(exhibitionId: string): void {
    if (!exhibitionId) return;
    const exh = this.exhibitions().find(e => e.id === exhibitionId);
    if (exh) {
      this.formData.exhibitionId = exh.id;
      this.formData.eventName = exh.name;
      this.formData.organizer = exh.organizer;
      this.formData.location = exh.venue;
      if (exh.startDate) this.formData.startDate = exh.startDate.split('T')[0];
      if (exh.endDate) this.formData.endDate = exh.endDate.split('T')[0];
      if (exh.durationDays) this.formData.durationDays = exh.durationDays;
    }
  }

  async fetchStalls(): Promise<void> {
    try {
      const localLeads = await this.db.getAllLeads();
      // 1. Fetch live authoritative stalls from Supabase
      const cloudStalls = await this.supabaseSync.getStallsFromSupabase();
      if (cloudStalls && cloudStalls.length > 0) {
        const updated = cloudStalls.map((s: any) => {
          const localCount = localLeads.filter((l) => l.exhibitionId === s.id).length;
          const totalCount = Math.max(s.leadCount || 0, localCount);
          return { ...s, leadCount: totalCount };
        });
        this.stalls.set(updated);
        return;
      }

      // 2. Query backend
      this.http.get<StallMasterDto[]>(this.apiUrl).subscribe({
        next: (res) => {
          if (res) {
            const updated = res.map((s) => {
              const localCount = localLeads.filter((l) => l.exhibitionId === s.id).length;
              const totalCount = Math.max(s.leadCount || 0, localCount);
              return { ...s, leadCount: totalCount };
            });
            this.stalls.set(updated);
            // Synchronize backend stalls to Supabase
            for (const st of res) {
              this.supabaseSync.saveStallToSupabase(st);
            }
          }
        },
        error: () => {
          this.stalls.set([]);
        }
      });
    } catch {
      this.stalls.set([]);
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

  openCreateModal(presetExhibitionId?: string): void {
    this.isEditMode.set(false);
    this.editingStallId = null;
    this.http.get<{ code: string }>(`${this.apiUrl}/next-code`).subscribe({
      next: (res) => {
        const nextCode = res.code || `STL-${new Date().getFullYear()}-002`;
        const matchedUser = this.users().find(
          (u) => u.id === this.currentUser?.id || 
                 u.username === this.currentUser?.username || 
                 u.fullName === this.currentUser?.fullName
        );
        this.formData = {
          name: '',
          code: nextCode,
          eventName: '',
          organizer: '',
          durationDays: null as any,
          startDate: '',
          endDate: '',
          location: '',
          hallNumber: '',
          boothNumber: '',
          ownerId: matchedUser ? matchedUser.id : '',
          ownerName: matchedUser ? (matchedUser.fullName || matchedUser.username) : '',
          exhibitionId: presetExhibitionId || ''
        };
        if (this.formData.exhibitionId) {
          this.onExhibitionChange(this.formData.exhibitionId);
        }
        this.isModalOpen.set(true);
      },
      error: () => {
        const fallbackCode = `STL-${new Date().getFullYear()}-002`;
        const matchedUser = this.users().find(
          (u) => u.id === this.currentUser?.id || 
                 u.username === this.currentUser?.username || 
                 u.fullName === this.currentUser?.fullName
        );
        this.formData.code = fallbackCode;
        this.formData.ownerId = matchedUser ? matchedUser.id : '';
        this.formData.ownerName = matchedUser ? (matchedUser.fullName || matchedUser.username) : '';
        if (presetExhibitionId) this.onExhibitionChange(presetExhibitionId);
        this.isModalOpen.set(true);
      }
    });
  }

  openEditModal(stall: StallMasterDto): void {
    this.isEditMode.set(true);
    this.editingStallId = stall.id;

    // Match existing owner in users list either by id, fullName, or username
    const matchedUser = this.users().find(
      (u) => u.id === stall.ownerId || 
             (stall.ownerName && (u.fullName?.toLowerCase() === stall.ownerName.toLowerCase() || u.username?.toLowerCase() === stall.ownerName.toLowerCase()))
    );

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
      ownerId: matchedUser ? matchedUser.id : (stall.ownerId || ''),
      ownerName: matchedUser ? (matchedUser.fullName || matchedUser.username) : (stall.ownerName || ''),
      exhibitionId: stall.exhibitionId || ''
    };
    this.onDateChange();
    this.isModalOpen.set(true);
  }

  onDateChange(): void {
    if (this.formData.startDate && this.formData.endDate) {
      const start = new Date(this.formData.startDate);
      const end = new Date(this.formData.endDate);
      if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end >= start) {
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
        this.formData.durationDays = diffDays;
      }
    }
  }

  closeModal(): void {
    this.isModalOpen.set(false);
    this.isEditMode.set(false);
    this.editingStallId = null;
  }

  getAssignedStallCount(exhibitionId: string): number {
    if (!exhibitionId) return 0;
    const target = exhibitionId.trim().toLowerCase();
    return this.stalls().filter((s) => s.exhibitionId && s.exhibitionId.trim().toLowerCase() === target).length;
  }

  getExhibitionLimit(exhibitionId: string): number {
    if (!exhibitionId) return 0;
    const target = exhibitionId.trim().toLowerCase();
    const exh = this.exhibitions().find((e) => e.id && e.id.trim().toLowerCase() === target);
    return exh?.stallCount || 1;
  }

  isExhibitionLimitReached(exhibitionId: string): boolean {
    if (!exhibitionId) return false;
    const target = exhibitionId.trim().toLowerCase();
    const assigned = this.stalls().filter(
      (s) => s.exhibitionId && s.exhibitionId.trim().toLowerCase() === target && s.id !== this.editingStallId
    ).length;
    const limit = this.getExhibitionLimit(exhibitionId);
    return assigned >= limit;
  }

  onOwnerChange(userId: string): void {
    if (!userId) {
      this.formData.ownerId = '';
      this.formData.ownerName = '';
      return;
    }
    const user = this.users().find((u) => u.id === userId);
    if (user) {
      this.formData.ownerId = user.id;
      this.formData.ownerName = user.fullName || user.username;
    }
  }

  isOwnerInList(ownerId: string): boolean {
    if (!ownerId) return true;
    return this.users().some((u) => u.id === ownerId);
  }

  saveStall(): void {
    if (!this.formData.name) {
      this.toast.showError('Stall Name is required.');
      return;
    }

    if (!this.formData.ownerId && !this.formData.ownerName) {
      this.toast.showError('Assigned Stall Owner is required.');
      return;
    }

    if (this.formData.ownerId && !this.formData.ownerName) {
      const user = this.users().find((u) => u.id === this.formData.ownerId);
      if (user) {
        this.formData.ownerName = user.fullName || user.username;
      }
    }

    // Quota Enforcement: Verify exhibition capacity
    if (this.formData.exhibitionId && this.isExhibitionLimitReached(this.formData.exhibitionId)) {
      const maxAllowed = this.getExhibitionLimit(this.formData.exhibitionId);
      const assigned = this.getAssignedStallCount(this.formData.exhibitionId);
      this.toast.showError(
        'Stall Limit Reached',
        `This exhibition allows a maximum of ${maxAllowed} stall(s) (${assigned} already assigned). Please edit the exhibition in Exhibition Master and increase 'No of stalls' before adding more.`
      );
      return;
    }

    const stallId = this.isEditMode() && this.editingStallId 
      ? this.editingStallId 
      : crypto.randomUUID();

    const exhibitionIdVal = this.formData.exhibitionId && this.formData.exhibitionId.trim()
      ? this.formData.exhibitionId.trim()
      : undefined;

    const stallRecord: StallMasterDto = {
      id: stallId,
      name: this.formData.name.trim(),
      code: this.formData.code || `STL-${new Date().getFullYear()}-001`,
      eventName: this.formData.eventName || '',
      organizer: this.formData.organizer || '',
      durationDays: this.formData.durationDays || 3,
      startDate: this.formData.startDate || '',
      endDate: this.formData.endDate || '',
      location: this.formData.location || '',
      hallNumber: this.formData.hallNumber || '',
      boothNumber: this.formData.boothNumber || '',
      ownerId: this.formData.ownerId || '',
      ownerName: this.formData.ownerName || '',
      status: 'Active',
      leadCount: 0,
      createdAt: new Date().toISOString(),
      exhibitionId: exhibitionIdVal
    };

    // 1. Immediately update in-memory signals and Dexie so Exhibition Master changes from 0 to 1 in real time
    this.stallService.addOrUpdateStallInMemory(stallRecord as any);
    this.stalls.update((list) => {
      const targetId = stallId.toLowerCase();
      const idx = list.findIndex((s) => s.id?.toLowerCase() === targetId);
      if (idx >= 0) {
        const copy = [...list];
        copy[idx] = { ...copy[idx], ...stallRecord };
        return copy;
      }
      return [stallRecord, ...list];
    });
    this.db.saveStall(stallRecord as any);

    // 2. Persist to Supabase
    this.supabaseSync.saveStallToSupabase(stallRecord);

    // 3. Persist to Backend API
    const backendPayload = {
      ...this.formData,
      id: stallId,
      exhibitionId: exhibitionIdVal || null
    };

    if (this.isEditMode() && this.editingStallId) {
      this.http.put<StallMasterDto>(`${this.apiUrl}/${this.editingStallId}`, backendPayload).subscribe({
        next: (updated) => {
          if (updated) {
            this.stallService.addOrUpdateStallInMemory(updated as any);
            this.supabaseSync.saveStallToSupabase(updated);
          }
          this.toast.showSuccess(`Stall project "${updated?.name || this.formData.name}" updated successfully.`);
          this.closeModal();
        },
        error: () => {
          this.toast.showSuccess(`Stall project "${this.formData.name}" updated successfully.`);
          this.closeModal();
        }
      });
    } else {
      this.http.post<StallMasterDto>(this.apiUrl, backendPayload).subscribe({
        next: (created) => {
          if (created) {
            this.stallService.addOrUpdateStallInMemory(created as any);
            this.supabaseSync.saveStallToSupabase(created);
          }
          this.toast.showSuccess(`Stall project "${created?.name || this.formData.name}" created successfully.`);
          this.closeModal();
        },
        error: () => {
          this.toast.showSuccess(`Stall project "${this.formData.name}" created successfully.`);
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

    this.stallService.removeStallFromMemory(stall.id);
    this.stalls.update((list) => list.filter((s) => s.id !== stall.id));
    this.db.deleteStall(stall.id);
    this.supabaseSync.deleteStallFromSupabase(stall.id);

    this.http.delete(`${this.apiUrl}/${stall.id}`).subscribe({
      next: () => {
        this.toast.showSuccess(`Stall project "${stall.name}" deleted.`);
        this.selectedStallForDelete.set(null);
      },
      error: () => {
        this.toast.showSuccess(`Stall project "${stall.name}" deleted locally.`);
        this.selectedStallForDelete.set(null);
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
