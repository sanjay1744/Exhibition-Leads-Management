import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ApplicationDatabase } from '../../../core/services/db.service';
import { LocalLead } from '../../../core/models/lead.model';
import { NetworkService } from '../../../core/services/network.service';
import { StallService, Stall } from '../../../core/services/stall.service';
import { AuthService } from '../../../core/services/auth.service';
import { getApiUrl } from '../../../core/config/api.config';

@Component({
  selector: 'app-sales-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './sales-dashboard.component.html',
  styleUrl: './sales-dashboard.component.css'
})
export class SalesDashboardComponent implements OnInit {
  private db = inject(ApplicationDatabase);
  private auth = inject(AuthService);
  private http = inject(HttpClient);
  stallService = inject(StallService);
  network = inject(NetworkService);

  allLeads = signal<LocalLead[]>([]);
  isCreateStallModalOpen = signal(false);

  newStallData = {
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

  async ngOnInit(): Promise<void> {
    const list = await this.db.getAllLeads();
    this.allLeads.set(list);
  }

  onStallChange(stallId: string): void {
    const found = this.stallService.stalls().find((s) => s.id === stallId);
    if (found) {
      this.stallService.setActiveStall(found);
    }
  }

  onDateChange(): void {
    if (this.newStallData.startDate && this.newStallData.endDate) {
      const start = new Date(this.newStallData.startDate);
      const end = new Date(this.newStallData.endDate);
      if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end >= start) {
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
        this.newStallData.durationDays = diffDays;
      }
    }
  }

  filteredStallLeads = computed(() => {
    const activeStallId = this.stallService.activeStall()?.id;
    if (!activeStallId) return this.allLeads();
    return this.allLeads().filter((l) => l.exhibitionId === activeStallId || !l.exhibitionId);
  });

  totalLeads = computed(() => this.filteredStallLeads().length);
  hotLeads = computed(() => this.filteredStallLeads().filter((l) => l.interestLevel === 'Hot').length);
  pendingSync = computed(() => this.filteredStallLeads().filter((l) => l.syncStatus === 'Pending').length);
  syncedPercentage = computed(() => {
    const total = this.totalLeads();
    if (total === 0) return 100;
    const synced = this.filteredStallLeads().filter((l) => l.syncStatus === 'Synced').length;
    return Math.round((synced / total) * 100);
  });

  openCreateStallModal(): void {
    this.http.get<{ code: string }>(`${getApiUrl()}/stalls/next-code`).subscribe({
      next: (res) => {
        const nextCode = res.code || `STL-${new Date().getFullYear()}-002`;
        this.newStallData = {
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
          ownerId: '11111111-1111-1111-1111-111111111111',
          ownerName: 'Thalaimalai'
        };
        this.isCreateStallModalOpen.set(true);
      },
      error: () => {
        this.newStallData.code = `STL-${new Date().getFullYear()}-002`;
        this.isCreateStallModalOpen.set(true);
      }
    });
  }

  saveNewStall(): void {
    if (!this.newStallData.name) {
      alert('Stall Name is required.');
      return;
    }

    this.http.post<Stall>(`${getApiUrl()}/stalls`, this.newStallData).subscribe({
      next: (created) => {
        alert(`New Stall (Project) "${created.name}" created with Auto Code: ${created.code}!`);
        this.stallService.loadStalls();
        this.isCreateStallModalOpen.set(false);
      },
      error: (err) => {
        alert(err?.error?.message || `Failed to create Stall.`);
      }
    });
  }
}
