import { Component, OnInit, inject, signal, computed, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router, ActivatedRoute } from '@angular/router';
import { firstValueFrom, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
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
  marketingRepIds?: string;
  marketingRepNames?: string;
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

  isViewModalOpen = signal(false);
  viewingStall = signal<StallMasterDto | null>(null);

  openViewModal(stall: StallMasterDto): void {
    this.viewingStall.set(stall);
    this.isViewModalOpen.set(true);
  }

  closeViewModal(): void {
    this.isViewModalOpen.set(false);
    this.viewingStall.set(null);
  }

  switchToEditFromView(): void {
    const stall = this.viewingStall();
    this.closeViewModal();
    if (stall && this.canEditStall()) {
      this.openEditModal(stall);
    }
  }

  getLinkedExhibition(exhibitionId?: string): ExhibitionDto | undefined {
    if (!exhibitionId) return undefined;
    const target = exhibitionId.trim().toLowerCase();
    return this.exhibitions().find(e => e.id && e.id.trim().toLowerCase() === target);
  }

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
    marketingRepIds?: string;
    marketingRepNames?: string;
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
    exhibitionId: '',
    marketingRepIds: '',
    marketingRepNames: ''
  };

  currentUser = this.auth.currentUser();

  isSuperAdmin = computed(() => this.currentUser?.role === 'SuperAdmin');
  isAdmin = computed(() => this.currentUser?.role === 'Admin');
  isStallOwner = computed(() => this.currentUser?.role === 'StallOwner');

  // Matrix Row 22: CREATE STALL - Super Admin: TRUE, Admin: TRUE, Stall Owner: FALSE, Marketing: FALSE
  canCreateStall = computed(() => this.isSuperAdmin() || this.isAdmin());

  // Matrix Row 23: VIEW STALL - Super Admin: TRUE, Admin: TRUE, Stall Owner: TRUE, Marketing: FALSE
  canViewStall = computed(() => this.isSuperAdmin() || this.isAdmin() || this.isStallOwner());

  // Matrix Row 24: EDIT STALL - Super Admin: TRUE, Admin: TRUE, Stall Owner: TRUE, Marketing: FALSE
  canEditStall = computed(() => this.isSuperAdmin() || this.isAdmin() || this.isStallOwner());

  // Matrix Row 25: DELETE STALL - Super Admin: TRUE, Admin: TRUE, Stall Owner: FALSE, Marketing: FALSE
  canDeleteStall = computed(() => this.isSuperAdmin() || this.isAdmin());

  // Matrix Row 26: ASSIGN A STALL MASTER TO A STALL - Super Admin: TRUE, Admin: TRUE, Stall Owner: FALSE
  canAssignStallOwner = computed(() => this.isSuperAdmin() || this.isAdmin());

  // Strictly only users with StallOwner role can be assigned as Stall Owners
  stallOwnerUsers = computed(() => this.users().filter(u => u.role === 'StallOwner'));

  // Strictly only users with Marketing role can be assigned as Marketing Reps
  marketingUsers = computed(() => this.users().filter(u => u.role === 'Marketing'));

  selectedMarketingRepIds = signal<string[]>([]);
  isMarketingDropdownOpen = signal<boolean>(false);

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (this.isMarketingDropdownOpen() && !target.closest('.marketing-dropdown-container')) {
      this.isMarketingDropdownOpen.set(false);
    }
  }

  toggleMarketingDropdown(event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
    }
    this.isMarketingDropdownOpen.update((v) => !v);
  }

  closeMarketingDropdown(): void {
    this.isMarketingDropdownOpen.set(false);
  }

  toggleMarketingRep(userId: string): void {
    const current = this.selectedMarketingRepIds();
    if (current.includes(userId)) {
      this.selectedMarketingRepIds.set(current.filter(id => id !== userId));
    } else {
      this.selectedMarketingRepIds.set([...current, userId]);
    }
  }

  isMarketingRepSelected(userId: string): boolean {
    return this.selectedMarketingRepIds().includes(userId);
  }

  getSelectedMarketingRepNames(): string[] {
    const ids = this.selectedMarketingRepIds();
    return this.marketingUsers()
      .filter(u => ids.includes(u.id))
      .map(u => u.fullName || u.username);
  }

  getSelectedMarketingRepList() {
    const ids = this.selectedMarketingRepIds();
    return this.marketingUsers().filter((u) => ids.includes(u.id));
  }

  getSelectedMarketingRepsSummary(): string {
    const names = this.getSelectedMarketingRepNames();
    if (names.length === 0) {
      return '-- Select Marketing Reps (Multiple) --';
    }
    if (names.length === 1) {
      return `${names[0]} (1 Rep Selected)`;
    }
    return `${names.length} Reps Selected: ${names.join(', ')}`;
  }

  getRepNamesList(stall: StallMasterDto | null | undefined): string[] {
    if (!stall?.marketingRepNames) return [];
    return stall.marketingRepNames.split(',').map(s => s.trim()).filter(Boolean);
  }

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
      const localLeads = await this.db.getAllLeads().catch(() => []);
      const localStalls = await this.db.getAllStalls().catch(() => []);
      const [cloudStalls, apiStalls] = await Promise.all([
        this.supabaseSync.getStallsFromSupabase().catch(() => [] as any[]),
        firstValueFrom(this.http.get<StallMasterDto[]>(this.apiUrl).pipe(catchError(() => of([]))))
      ]);

      const apiMapById = new Map<string, any>();
      const apiMapByCode = new Map<string, any>();
      for (const a of (apiStalls || [])) {
        if (a.id) apiMapById.set(a.id.toLowerCase(), a);
        if (a.code) {
          apiMapByCode.set(a.code.toLowerCase(), a);
          const baseCode = a.code.split('-').slice(0, 3).join('-').toLowerCase();
          if (!apiMapByCode.has(baseCode)) apiMapByCode.set(baseCode, a);
        }
      }

      const localMap = new Map<string, any>(localStalls.map((s: any) => [s.id?.toLowerCase(), s]));
      const stallMap = new Map<string, StallMasterDto>();

      const processRecord = (s: any) => {
        if (!s.id) return;
        const idKey = s.id.toLowerCase();
        const codeKey = (s.code || '').toLowerCase();
        const baseCodeKey = (s.code || '').split('-').slice(0, 3).join('-').toLowerCase();

        const apiMatch = apiMapById.get(idKey) || apiMapByCode.get(codeKey) || apiMapByCode.get(baseCodeKey);
        const local = localMap.get(idKey);

        const localCount = localLeads.filter((l: any) => l.exhibitionId === s.id || l.stallId === s.id).length;
        const totalCount = Math.max(s.leadCount || 0, apiMatch?.leadCount || 0, localCount);

        const full: StallMasterDto = {
          id: s.id,
          name: s.name || apiMatch?.name || 'Unnamed Stall',
          code: s.code || apiMatch?.code || '',
          eventName: s.eventName || apiMatch?.eventName || '',
          organizer: s.organizer || apiMatch?.organizer || '',
          durationDays: s.durationDays || apiMatch?.durationDays || 3,
          startDate: s.startDate || apiMatch?.startDate || '',
          endDate: s.endDate || apiMatch?.endDate || '',
          location: s.location || apiMatch?.location || '',
          hallNumber: s.hallNumber || apiMatch?.hallNumber || '',
          boothNumber: s.boothNumber || apiMatch?.boothNumber || '',
          ownerId: s.ownerId || apiMatch?.ownerId || local?.ownerId || '',
          ownerName: s.ownerName || apiMatch?.ownerName || local?.ownerName || '',
          status: s.status || apiMatch?.status || 'Active',
          leadCount: totalCount,
          createdAt: s.createdAt || apiMatch?.createdAt || new Date().toISOString(),
          exhibitionId: s.exhibitionId || apiMatch?.exhibitionId || undefined,
          marketingRepIds: s.marketingRepIds || apiMatch?.marketingRepIds || local?.marketingRepIds || '',
          marketingRepNames: s.marketingRepNames || apiMatch?.marketingRepNames || local?.marketingRepNames || ''
        };

        stallMap.set(idKey, full);
      };

      for (const cs of (cloudStalls || [])) {
        processRecord(cs);
      }
      for (const as of (apiStalls || [])) {
        if (!stallMap.has((as.id || '').toLowerCase())) {
          processRecord(as);
        }
      }

      const merged = Array.from(stallMap.values());
      this.stalls.set(merged);

      // Cache locally
      for (const st of merged) {
        await this.db.saveStall(st as any);
      }
    } catch {
      this.stalls.set([]);
    }
  }

  filteredStalls = computed(() => {
    let list = this.stalls();
    if (this.isStallOwner()) {
      const myId = this.currentUser?.id?.toLowerCase();
      const myUsername = this.currentUser?.username?.toLowerCase();
      const myFullName = this.currentUser?.fullName?.toLowerCase();
      list = list.filter((s) => {
        const ownerId = s.ownerId?.toLowerCase();
        const ownerName = s.ownerName?.toLowerCase();
        return (
          (ownerId && myId && ownerId === myId) ||
          (ownerName && myUsername && ownerName === myUsername) ||
          (ownerName && myFullName && ownerName === myFullName)
        );
      });
    }

    const q = this.searchQuery.toLowerCase().trim();
    if (!q) return list;
    return list.filter(
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
    if (!this.canCreateStall()) {
      this.toast.showError('Access Denied', 'Only Super Admin and Admin can create stalls.');
      return;
    }
    this.isEditMode.set(false);
    this.editingStallId = null;
    this.selectedMarketingRepIds.set([]);
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
          exhibitionId: presetExhibitionId || '',
          marketingRepIds: '',
          marketingRepNames: ''
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
        this.formData.marketingRepIds = '';
        this.formData.marketingRepNames = '';
        if (presetExhibitionId) this.onExhibitionChange(presetExhibitionId);
        this.isModalOpen.set(true);
      }
    });
  }

  openEditModal(stall: StallMasterDto): void {
    if (this.isStallOwner()) {
      const myId = this.currentUser?.id?.toLowerCase();
      const myUsername = this.currentUser?.username?.toLowerCase();
      const myFullName = this.currentUser?.fullName?.toLowerCase();
      const ownerId = stall.ownerId?.toLowerCase();
      const ownerName = stall.ownerName?.toLowerCase();
      const isOwner = (ownerId && myId && ownerId === myId) ||
                      (ownerName && myUsername && ownerName === myUsername) ||
                      (ownerName && myFullName && ownerName === myFullName);
      if (!isOwner) {
        this.toast.showError('Access Denied', 'You can only edit stalls mapped to your account.');
        return;
      }
    }

    this.isEditMode.set(true);
    this.editingStallId = stall.id;

    // Match existing owner in users list either by id, fullName, or username
    const matchedUser = this.users().find(
      (u) => u.id === stall.ownerId || 
             (stall.ownerName && (u.fullName?.toLowerCase() === stall.ownerName.toLowerCase() || u.username?.toLowerCase() === stall.ownerName.toLowerCase()))
    );

    // Match marketing reps from stall
    const repIdsFromStall = stall.marketingRepIds ? stall.marketingRepIds.split(',').map(s => s.trim()).filter(Boolean) : [];
    if (repIdsFromStall.length === 0 && stall.marketingRepNames) {
      const names = stall.marketingRepNames.toLowerCase().split(',').map(s => s.trim());
      const matchedIds = this.marketingUsers()
        .filter(u => names.includes(u.fullName?.toLowerCase() || '') || names.includes(u.username?.toLowerCase() || ''))
        .map(u => u.id);
      this.selectedMarketingRepIds.set(matchedIds);
    } else {
      this.selectedMarketingRepIds.set(repIdsFromStall);
    }

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
      exhibitionId: stall.exhibitionId || '',
      marketingRepIds: stall.marketingRepIds || '',
      marketingRepNames: stall.marketingRepNames || ''
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
    this.isMarketingDropdownOpen.set(false);
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
    return this.stallOwnerUsers().some((u) => u.id === ownerId);
  }

  saveStall(): void {
    if (!this.isEditMode() && !this.canCreateStall()) {
      this.toast.showError('Access Denied', 'Only Super Admin and Admin can create stalls.');
      return;
    }
    if (this.isEditMode() && !this.canEditStall()) {
      this.toast.showError('Access Denied', 'You do not have permission to edit stalls.');
      return;
    }

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

    const repIds = this.selectedMarketingRepIds().join(',');
    const repNames = this.getSelectedMarketingRepNames().join(', ');
    this.formData.marketingRepIds = repIds;
    this.formData.marketingRepNames = repNames;

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
      exhibitionId: exhibitionIdVal,
      marketingRepIds: repIds,
      marketingRepNames: repNames
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
    if (!this.canDeleteStall()) {
      this.toast.showError('Access Denied', 'Only Super Admin and Admin can delete stalls.');
      return;
    }
    this.selectedStallForDelete.set(stall);
  }

  cancelDeleteStall(): void {
    this.selectedStallForDelete.set(null);
  }

  confirmDeleteStall(): void {
    if (!this.canDeleteStall()) {
      this.toast.showError('Access Denied', 'Only Super Admin and Admin can delete stalls.');
      this.selectedStallForDelete.set(null);
      return;
    }
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
