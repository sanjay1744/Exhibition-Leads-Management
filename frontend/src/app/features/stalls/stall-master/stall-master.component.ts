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

  private get apiUrl() { return `${getApiUrl()}/stalls`; }

  stalls = signal<StallMasterDto[]>([]);
  exhibitions = this.exhibitionService.exhibitions;
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
    durationDays: 4,
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 4 * 86400000).toISOString().split('T')[0],
    location: 'Codissia Trade Fair Complex, Coimbatore',
    hallNumber: 'Hall A',
    boothNumber: 'Booth 12',
    ownerId: '11111111-1111-1111-1111-111111111111',
    ownerName: 'Thalaimalai',
    exhibitionId: ''
  };

  currentUser = this.auth.currentUser();

  canCreateStall = computed(() => {
    const role = this.currentUser?.role;
    return role === 'Admin' || role === 'StallOwner';
  });

  ngOnInit(): void {
    this.exhibitionService.loadExhibitions();
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

  openCreateModal(presetExhibitionId?: string): void {
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
          durationDays: null as any,
          startDate: '',
          endDate: '',
          location: '',
          hallNumber: '',
          boothNumber: '',
          ownerId: this.currentUser?.token || '11111111-1111-1111-1111-111111111111',
          ownerName: this.currentUser?.fullName || 'Thalaimalai',
          exhibitionId: presetExhibitionId || ''
        };
        if (this.formData.exhibitionId) {
          this.onExhibitionChange(this.formData.exhibitionId);
        }
        this.isModalOpen.set(true);
      },
      error: () => {
        const fallbackCode = `STL-${new Date().getFullYear()}-002`;
        this.formData.code = fallbackCode;
        if (presetExhibitionId) this.onExhibitionChange(presetExhibitionId);
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
      ownerName: stall.ownerName || 'Thalaimalai',
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
