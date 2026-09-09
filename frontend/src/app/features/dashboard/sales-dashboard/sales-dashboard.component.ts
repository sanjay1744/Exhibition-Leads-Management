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
import { SyncService } from '../../../core/services/sync.service';
import { ToastService } from '../../../core/services/toast.service';
import { SupabaseSyncService } from '../../../core/services/supabase-sync.service';
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
  private syncService = inject(SyncService);
  private toastService = inject(ToastService);
  private supabaseSync = inject(SupabaseSyncService);
  stallService = inject(StallService);
  network = inject(NetworkService);

  allLeads = signal<LocalLead[]>([]);
  isCreateStallModalOpen = signal(false);
  isSyncing = signal(false);

  newStallData = {
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
    ownerName: ''
  };

  currentUser = this.auth.currentUser();

  canCreateStall = computed(() => {
    const role = this.currentUser?.role;
    return role === 'Admin' || role === 'StallOwner';
  });

  async ngOnInit(): Promise<void> {
    try {
      const cloudLeads = await this.supabaseSync.getAllLeadsFromSupabase();
      if (cloudLeads && cloudLeads.length > 0) {
        for (const cl of cloudLeads) {
          await this.db.saveLead(cl);
        }
      }
    } catch {}

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

  onNewStallDateChange(): void {
    this.onDateChange();
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
    this.stallService.getNextCode().subscribe({
      next: (res) => {
        const nextCode = res.code || `STL-${new Date().getFullYear()}-001`;
        this.newStallData = {
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
          ownerId: this.currentUser?.id || this.currentUser?.token || '',
          ownerName: this.currentUser?.fullName || ''
        };
        this.isCreateStallModalOpen.set(true);
      }
    });
  }

  saveNewStall(): void {
    if (!this.newStallData.name) {
      alert('Stall Name is required.');
      return;
    }

    this.stallService.createStall(this.newStallData).subscribe({
      next: (created) => {
        this.toastService.showSuccess(`New Stall "${created.name}" created with code: ${created.code}!`, 'Stall Created');
        this.isCreateStallModalOpen.set(false);
      },
      error: () => {
        this.toastService.showError('Failed to create Stall.', 'Error');
      }
    });
  }

  async manualSync(): Promise<void> {
    this.isSyncing.set(true);
    try {
      await this.syncService.syncPendingLeads();
      const list = await this.db.getAllLeads();
      this.allLeads.set(list);
      this.toastService.showSuccess('All pending leads synchronized to Supabase Cloud!', 'Supabase Sync');
    } catch (err) {
      this.toastService.showError('Could not complete sync. Please verify internet connection.', 'Sync Failed');
    } finally {
      this.isSyncing.set(false);
    }
  }
}
