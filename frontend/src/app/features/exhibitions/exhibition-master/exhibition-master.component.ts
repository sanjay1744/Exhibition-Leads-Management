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
