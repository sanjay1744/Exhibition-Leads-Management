import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ExhibitionService, ExhibitionDto, CreateExhibitionRequest, InlineStallRequest } from '../../../core/services/exhibition.service';
import { StallService } from '../../../core/services/stall.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';

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

  exhibitions = this.exhibitionService.exhibitions;

  searchQuery = '';
  selectedStatusFilter = signal<string>('ALL');

  isModalOpen = signal(false);
  isEditMode = signal(false);
  editingId = signal<string | null>(null);

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
    this.stallService.loadStalls();
  }

  canCreateExhibition(): boolean {
    return this.authService.currentUser()?.role === 'Admin' || true;
  }

  canDeleteExhibition(): boolean {
    return this.authService.currentUser()?.role === 'Admin';
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
    this.formStallNumber = 1;

    this.updateCodeForStall(1);
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
    this.formStallNumber = exhibition.stallCount || 1;
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
      initialStalls: !this.isEditMode() ? this.inlineStalls : undefined
    };

    if (this.isEditMode() && this.editingId()) {
      this.exhibitionService.updateExhibition(this.editingId()!, payload).subscribe({
        next: () => {
          this.toastService.showSuccess('Exhibition Updated', `Exhibition updated with quota of ${payload.stallCount} stall(s).`);
          this.closeModal();
        },
        error: () => this.toastService.showError('Update Failed', 'Failed to update exhibition details.')
      });
    } else {
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
