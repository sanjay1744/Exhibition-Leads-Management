import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ExhibitionService, ExhibitionDto, CreateExhibitionRequest, InlineStallRequest } from '../../../core/services/exhibition.service';
import { StallService } from '../../../core/services/stall.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { UserService } from '../../../core/services/user.service';

@Component({
  selector: 'app-exhibition-master',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './exhibition-master.component.html',
  styleUrl: './exhibition-master.component.css'
})
export class ExhibitionMasterComponent implements OnInit {
  private exhibitionService = inject(ExhibitionService);
  private stallService = inject(StallService);
  private authService = inject(AuthService);
  private toastService = inject(ToastService);
  private router = inject(Router);
  private userService = inject(UserService);

  exhibitions = this.exhibitionService.exhibitions;
  users = this.userService.users;
  adminUsers = computed(() => this.users().filter(u => u.role === 'Admin'));

  formAdminId = '';
  formAdminName = '';

  searchQuery = '';
  selectedStatusFilter = signal<string>('ALL');

  isModalOpen = signal(false);
  isEditMode = signal(false);
  editingId = signal<string | null>(null);

  isViewModalOpen = signal(false);
  viewingExhibition = signal<ExhibitionDto | null>(null);

  openViewModal(exhibition: ExhibitionDto): void {
    this.viewingExhibition.set(exhibition);
    this.isViewModalOpen.set(true);
  }

  closeViewModal(): void {
    this.isViewModalOpen.set(false);
    this.viewingExhibition.set(null);
  }

  switchToEditFromView(): void {
    const exh = this.viewingExhibition();
    this.closeViewModal();
    if (exh && this.canEditExhibition()) {
      this.editExhibition(exh);
    }
  }

  getStallsForExh(exhibitionId?: string): any[] {
    if (!exhibitionId) return [];
    const target = exhibitionId.trim().toLowerCase();
    return this.stallService.stalls().filter((s) => s.exhibitionId && s.exhibitionId.trim().toLowerCase() === target);
  }

  formCode = signal('');
  formStallNumber = 1;
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
  closedCount = computed(() => this.exhibitions().filter(e => e.status === 'Closed').length);
  totalStallsCount = computed(() => this.exhibitions().reduce((acc, curr) => acc + (curr.stallCount || 0), 0));

  isDateAutomatedStatus = true;
  reviewBufferState = {
    isActive: false,
    isExpired: false,
    reviewEndDate: null as Date | null,
    reviewEndDateFormatted: '',
    currentDay: 1
  };

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
    this.userService.initUsers();
    this.userService.getUsers().subscribe({
      next: (res) => {
        if (res) this.userService.users.set(res);
      }
    });
    this.exhibitionService.loadExhibitions().then(() => {
      this.autoCloseExpiredExhibitions();
    });
    this.stallService.loadStalls();
  }

  autoCloseExpiredExhibitions(): void {
    const today = this.getTodayMidnight();
    for (const exh of this.exhibitions()) {
      if (exh.status !== 'Closed' && exh.status !== 'Archived' && exh.endDate) {
        const end = this.parseLocalDate(exh.endDate);
        if (end) {
          const reviewEnd = new Date(end.getTime());
          reviewEnd.setDate(reviewEnd.getDate() + 2);
          if (today > reviewEnd) {
            this.exhibitionService.updateExhibition(exh.id, {
              ...exh,
              status: 'Closed'
            }).subscribe();
          }
        }
      }
    }
  }

  getTodayMidnight(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  }

  parseLocalDate(dateStr?: string | null): Date | null {
    if (!dateStr) return null;
    const clean = dateStr.split('T')[0];
    const parts = clean.split('-');
    if (parts.length !== 3) return null;
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    return new Date(y, m, d, 0, 0, 0, 0);
  }

  // Matrix Row 17: CREATE A EXHIBITION - Super Admin: TRUE, Admin: TRUE, Stall Owner: FALSE, Marketing: FALSE
  canCreateExhibition(): boolean {
    const role = this.authService.currentUser()?.role;
    return role === 'SuperAdmin' || role === 'Admin';
  }

  // Matrix Row 19: DELETE EXHIBITION - Super Admin: TRUE, Admin: TRUE, Stall Owner: FALSE, Marketing: FALSE
  canDeleteExhibition(): boolean {
    const role = this.authService.currentUser()?.role;
    return role === 'SuperAdmin' || role === 'Admin';
  }

  // Matrix Row 18: EDIT EXHIBITION - Super Admin: TRUE, Admin: TRUE, Stall Owner: FALSE, Marketing: FALSE
  canEditExhibition(): boolean {
    const role = this.authService.currentUser()?.role;
    return role === 'SuperAdmin' || role === 'Admin';
  }

  // Matrix Row 20: ASIGN A EXHIBITION ADMIN (ONLY ADMINS CAN BE ASSIGNED HERE) - Super Admin: TRUE, Admin: FALSE
  canAssignExhibitionAdmin(): boolean {
    return this.authService.currentUser()?.role === 'SuperAdmin';
  }

  onAdminChange(adminId: string): void {
    this.formAdminId = adminId;
    const found = this.users().find(u => u.id === adminId);
    this.formAdminName = found ? (found.fullName || found.username) : '';
  }

  updateCodeForStall(stallNum: number): void {
    const validNum = stallNum && stallNum > 0 ? stallNum : 1;
    this.formStallNumber = validNum;
    const year2Digits = new Date().getFullYear().toString().slice(-2);
    if (this.isEditMode() && this.editingId()) {
      // In edit mode, update the stall quota segment in existing code
      const currentCode = this.formCode();
      if (/EXH-STL\d+-/i.test(currentCode)) {
        this.formCode.set(currentCode.replace(/EXH-STL\d+-/i, `EXH-STL${validNum}-`));
      } else {
        const parts = currentCode.split('-');
        const lastPart = parts.length > 1 ? parts[parts.length - 1] : '001';
        this.formCode.set(`EXH-STL${validNum}-${year2Digits}-${lastPart}`);
      }
    } else {
      this.exhibitionService.getNextCode(validNum).subscribe({
        next: (res) => this.formCode.set(res.code),
        error: () => this.formCode.set(`EXH-STL${validNum}-${year2Digits}-001`)
      });
    }
  }

  openCreateModal(): void {
    if (!this.canCreateExhibition()) {
      this.toastService.showError('Access Denied', 'Only Super Admin can create new exhibitions.');
      return;
    }
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
    this.isDateAutomatedStatus = true;
    this.reviewBufferState = { isActive: false, isExpired: false, reviewEndDate: null, reviewEndDateFormatted: '', currentDay: 1 };
    this.inlineStalls = [];
    this.formStallNumber = 1;
    this.formAdminId = '';
    this.formAdminName = '';

    this.updateCodeForStall(1);
    this.isModalOpen.set(true);
  }

  editExhibition(exhibition: ExhibitionDto): void {
    if (!this.canEditExhibition()) {
      this.toastService.showError('Access Denied', 'You do not have permission to edit exhibitions.');
      return;
    }
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
    this.formAdminId = exhibition.adminId || '';
    this.formAdminName = exhibition.adminName || '';
    this.formStallNumber = exhibition.stallCount || 1;
    this.inlineStalls = [];
    this.isDateAutomatedStatus = false;
    this.onDateChange();

    this.isModalOpen.set(true);
  }

  onDateChange(): void {
    if (this.formStartDate && this.formEndDate) {
      const start = this.parseLocalDate(this.formStartDate);
      const end = this.parseLocalDate(this.formEndDate);
      if (start && end && end >= start) {
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
        this.formDurationDays = diffDays;
      }
    }

    this.updateAutomatedStatus();
  }

  updateAutomatedStatus(): void {
    if (!this.formStartDate) {
      this.reviewBufferState = { isActive: false, isExpired: false, reviewEndDate: null, reviewEndDateFormatted: '', currentDay: 1 };
      return;
    }

    const today = this.getTodayMidnight();
    const start = this.parseLocalDate(this.formStartDate);
    const end = this.formEndDate ? this.parseLocalDate(this.formEndDate) : start;

    if (!start) return;

    // 1. Future dates -> Upcoming
    if (start > today) {
      this.formStatus = 'Upcoming';
      this.isDateAutomatedStatus = true;
      this.reviewBufferState = { isActive: false, isExpired: false, reviewEndDate: null, reviewEndDateFormatted: '', currentDay: 1 };
      return;
    }

    // 2. Present dates -> Active
    if (end && start <= today && today <= end) {
      this.formStatus = 'Active';
      this.isDateAutomatedStatus = true;
      this.reviewBufferState = { isActive: false, isExpired: false, reviewEndDate: null, reviewEndDateFormatted: '', currentDay: 1 };
      return;
    }

    // 3. Completed dates -> 2 days review buffer, then closed
    if (end && today > end) {
      const reviewEnd = new Date(end.getTime());
      reviewEnd.setDate(reviewEnd.getDate() + 2);

      const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };
      const formattedReviewEnd = reviewEnd.toLocaleDateString(undefined, options);

      if (today <= reviewEnd) {
        // Within 2-day review period
        const dayDiff = Math.floor((today.getTime() - end.getTime()) / (1000 * 60 * 60 * 24));
        const currentDay = Math.min(Math.max(dayDiff, 1), 2);

        this.formStatus = 'Completed';
        this.isDateAutomatedStatus = true;
        this.reviewBufferState = {
          isActive: true,
          isExpired: false,
          reviewEndDate: reviewEnd,
          reviewEndDateFormatted: formattedReviewEnd,
          currentDay
        };
      } else {
        // Review period ended -> Closed
        this.formStatus = 'Closed';
        this.isDateAutomatedStatus = true;
        this.reviewBufferState = {
          isActive: false,
          isExpired: true,
          reviewEndDate: reviewEnd,
          reviewEndDateFormatted: formattedReviewEnd,
          currentDay: 2
        };
      }
    }
  }

  onManualStatusChange(): void {
    this.isDateAutomatedStatus = false;
  }

  closeFormExhibition(): void {
    this.formStatus = 'Closed';
    this.isDateAutomatedStatus = false;
    this.toastService.showSuccess('Status Set to Closed', 'Exhibition marked as Closed.');
  }

  reopenFormExhibitionToReview(): void {
    this.formStatus = 'Completed';
    this.isDateAutomatedStatus = true;
  }

  isExhibitionInReview(exhibition: ExhibitionDto): boolean {
    if (exhibition.status === 'Closed' || exhibition.status === 'Archived') return false;
    if (!exhibition.endDate) return false;
    const end = this.parseLocalDate(exhibition.endDate);
    if (!end) return false;
    const today = this.getTodayMidnight();
    if (today <= end) return false;

    const reviewEnd = new Date(end.getTime());
    reviewEnd.setDate(reviewEnd.getDate() + 2);
    return today > end && today <= reviewEnd;
  }

  isExhibitionReviewExpired(exhibition: ExhibitionDto): boolean {
    if (exhibition.status === 'Closed' || exhibition.status === 'Archived') return false;
    if (!exhibition.endDate) return false;
    const end = this.parseLocalDate(exhibition.endDate);
    if (!end) return false;
    const today = this.getTodayMidnight();

    const reviewEnd = new Date(end.getTime());
    reviewEnd.setDate(reviewEnd.getDate() + 2);
    return today > reviewEnd;
  }

  getReviewDaysLeftText(exhibition: ExhibitionDto): string {
    if (!exhibition.endDate) return '';
    const end = this.parseLocalDate(exhibition.endDate);
    if (!end) return '';
    const today = this.getTodayMidnight();
    const reviewEnd = new Date(end.getTime());
    reviewEnd.setDate(reviewEnd.getDate() + 2);
    const diffDays = Math.ceil((reviewEnd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return `${diffDays}d review left`;
  }

  closeExhibition(exhibition: ExhibitionDto): void {
    const payload: CreateExhibitionRequest = {
      name: exhibition.name,
      code: exhibition.code,
      organizer: exhibition.organizer,
      venue: exhibition.venue,
      startDate: exhibition.startDate,
      endDate: exhibition.endDate,
      durationDays: exhibition.durationDays,
      description: exhibition.description,
      status: 'Closed',
      stallCount: exhibition.stallCount
    };

    this.exhibitionService.updateExhibition(exhibition.id, payload).subscribe({
      next: () => {
        this.toastService.showSuccess(
          'Exhibition Closed',
          `Exhibition "${exhibition.name}" has been marked as Closed.`
        );
      },
      error: () => {
        this.toastService.showError('Close Failed', 'Could not close the exhibition.');
      }
    });
  }

  closeModal(): void {
    this.isModalOpen.set(false);
  }

  addInlineStall(): void {
    if (this.inlineStalls.length >= this.formStallNumber) {
      this.toastService.showError(
        'Stall Limit Reached',
        `You have set 'No of stalls' to ${this.formStallNumber}. Increase 'No of stalls' if you wish to add more.`
      );
      return;
    }
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

  getStallCountForExh(exhibitionId: string): number {
    if (!exhibitionId) return 0;
    const target = exhibitionId.trim().toLowerCase();
    return this.stallService.stalls().filter((s) => s.exhibitionId && s.exhibitionId.trim().toLowerCase() === target).length;
  }

  saveExhibition(): void {
    if (!this.formName.trim()) {
      this.toastService.showError('Validation Error', 'Exhibition title is required.');
      return;
    }

    // Validation: If editing, cannot reduce No of stalls below already assigned count
    if (this.isEditMode() && this.editingId()) {
      const assignedCount = this.getStallCountForExh(this.editingId()!);
      if (this.formStallNumber < assignedCount) {
        this.toastService.showError(
          'Validation Error',
          `Cannot reduce 'No of stalls' to ${this.formStallNumber} because ${assignedCount} stall(s) are already assigned to this exhibition.`
        );
        return;
      }
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
      stallCount: this.formStallNumber || 1,
      initialStalls: !this.isEditMode() ? this.inlineStalls : undefined,
      adminId: this.formAdminId || undefined,
      adminName: this.formAdminName || undefined
    };

    if (this.isEditMode() && this.editingId()) {
      if (!this.canEditExhibition()) {
        this.toastService.showError('Access Denied', 'You do not have permission to edit exhibitions.');
        return;
      }
      this.exhibitionService.updateExhibition(this.editingId()!, payload).subscribe({
        next: () => {
          this.toastService.showSuccess('Exhibition Updated', `Exhibition updated with quota of ${payload.stallCount} stall(s).`);
          this.closeModal();
        },
        error: () => this.toastService.showError('Update Failed', 'Failed to update exhibition details.')
      });
    } else {
      if (!this.canCreateExhibition()) {
        this.toastService.showError('Access Denied', 'Only Super Admin can create new exhibitions.');
        return;
      }
      this.exhibitionService.createExhibition(payload).subscribe({
        next: () => {
          this.toastService.showSuccess('Exhibition Created', `Exhibition created with capacity for ${payload.stallCount} stall(s).`);
          this.stallService.loadStalls();
          this.closeModal();
        },
        error: () => this.toastService.showError('Creation Failed', 'Failed to create new exhibition.')
      });
    }
  }

  viewStalls(exhibition: ExhibitionDto): void {
    this.selectedExhibitionForStalls.set(exhibition);
    const target = exhibition.id.trim().toLowerCase();
    const stalls = this.stallService.stalls().filter((s) => s.exhibitionId && s.exhibitionId.trim().toLowerCase() === target);
    this.linkedStallsList.set(stalls);
  }

  closeStallsModal(): void {
    this.selectedExhibitionForStalls.set(null);
  }

  goToCreateStallForExhibition(exhibition: ExhibitionDto): void {
    this.closeStallsModal();
    this.router.navigate(['/stalls'], { queryParams: { exhibitionId: exhibition.id } });
  }

  promptDeleteExhibition(exhibition: ExhibitionDto): void {
    if (!this.canDeleteExhibition()) {
      this.toastService.showError('Access Denied', 'You do not have permission to delete exhibitions.');
      return;
    }
    this.selectedExhibitionForDelete.set(exhibition);
  }

  confirmDeleteExhibition(): void {
    if (!this.canDeleteExhibition()) {
      this.toastService.showError('Access Denied', 'You do not have permission to delete exhibitions.');
      this.selectedExhibitionForDelete.set(null);
      return;
    }
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
