import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ApplicationDatabase } from '../../../core/services/db.service';
import { LocalLead } from '../../../core/models/lead.model';
import { NetworkService } from '../../../core/services/network.service';
import { StallService, Stall } from '../../../core/services/stall.service';
import { ExhibitionService } from '../../../core/services/exhibition.service';
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
  Math = Math;
  private db = inject(ApplicationDatabase);
  private auth = inject(AuthService);
  private http = inject(HttpClient);
  private syncService = inject(SyncService);
  private toastService = inject(ToastService);
  private supabaseSync = inject(SupabaseSyncService);
  private router = inject(Router);
  stallService = inject(StallService);
  exhibitionService = inject(ExhibitionService);
  network = inject(NetworkService);

  allLeads = signal<LocalLead[]>([]);
  isCreateStallModalOpen = signal(false);
  isSyncing = signal(false);

  // Target Exhibition & Stall Modal for New Lead
  isTargetModalOpen = signal<boolean>(false);
  targetExhibitionId = signal<string>('');
  targetStallId = signal<string>('');

  availableExhibitions = computed(() => {
    const list = this.exhibitionService.exhibitions();
    if (this.auth.isStallOwner() || this.auth.isMarketing()) {
      const myStallExhIds = new Set(this.stallService.stalls().map((s) => s.exhibitionId).filter(Boolean));
      return list.filter((e) => myStallExhIds.has(e.id));
    }
    return list;
  });

  targetStalls = computed(() => {
    const exhId = this.targetExhibitionId();
    if (!exhId) return [];
    return this.stallService.stalls().filter((s) => s.exhibitionId === exhId);
  });

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
    return role === 'SuperAdmin' || role === 'Admin' || role === 'StallOwner';
  });

  async ngOnInit(): Promise<void> {
    this.exhibitionService.loadExhibitions();
    this.stallService.loadStalls();
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

  openTargetSelectionModal(): void {
    this.exhibitionService.loadExhibitions();
    this.stallService.loadStalls();

    const activeStall = this.stallService.activeStall();
    const available = this.availableExhibitions();
    if (activeStall?.exhibitionId && available.some((e) => e.id === activeStall.exhibitionId)) {
      this.targetExhibitionId.set(activeStall.exhibitionId);
    } else {
      this.targetExhibitionId.set(available[0]?.id || '');
    }
    this.targetStallId.set('');
    this.isTargetModalOpen.set(true);
  }

  selectTargetExhibition(exhId: string): void {
    this.targetExhibitionId.set(exhId);
    this.targetStallId.set('');
  }

  closeTargetSelectionModal(): void {
    this.isTargetModalOpen.set(false);
  }

  proceedToCaptureLead(): void {
    const stall = this.stallService.stalls().find((s) => s.id === this.targetStallId());
    if (stall) {
      this.stallService.setActiveStall(stall);
    }
    const exhId = this.targetExhibitionId();
    if (exhId) {
      const exh = this.exhibitionService.exhibitions().find((e) => e.id === exhId);
      if (exh) {
        this.exhibitionService.setActiveExhibition(exh);
      }
    }
    this.isTargetModalOpen.set(false);
    this.router.navigate(['/capture'], { queryParams: { stallId: this.targetStallId(), exhibitionId: exhId } });
  }

  // Dual Filter Bar State: Exhibition & Active Stall
  selectedExhibitionId = signal<string>('ALL');
  selectedStallId = signal<string>('ALL');
  showExhibitionDropdown = signal<boolean>(false);
  showStallDropdown = signal<boolean>(false);

  dropdownStalls = computed(() => {
    const exhId = this.selectedExhibitionId();
    if (!exhId || exhId === 'ALL') {
      return this.stallService.stalls();
    }
    return this.stallService.stalls().filter((s) => s.exhibitionId === exhId);
  });

  getSelectedExhibitionName(): string {
    if (this.selectedExhibitionId() === 'ALL') return 'All Exhibitions';
    const found = this.availableExhibitions().find((e) => e.id === this.selectedExhibitionId());
    return found ? `${found.name} (${found.code})` : 'All Exhibitions';
  }

  getSelectedStallName(): string {
    if (this.selectedStallId() === 'ALL') return 'All Stalls (All Leads)';
    const found = this.stallService.stalls().find((s) => s.id === this.selectedStallId());
    return found ? `${found.name} (${found.code})` : 'All Stalls (All Leads)';
  }

  openExhibitionDropdown(): void {
    this.showStallDropdown.set(false);
    this.showExhibitionDropdown.update((v) => !v);
  }

  openStallDropdown(): void {
    this.showExhibitionDropdown.set(false);
    this.showStallDropdown.update((v) => !v);
  }

  onExhibitionFilterChange(exhibitionId: string): void {
    this.selectedExhibitionId.set(exhibitionId);
    if (this.selectedStallId() !== 'ALL') {
      const validStalls = this.dropdownStalls();
      const stillValid = validStalls.some((s) => s.id === this.selectedStallId());
      if (!stillValid) {
        this.selectedStallId.set('ALL');
      }
    }
  }

  onStallFilterChange(stallId: string): void {
    this.selectedStallId.set(stallId);
    if (stallId !== 'ALL') {
      const found = this.stallService.stalls().find((s) => s.id === stallId);
      if (found) {
        this.stallService.setActiveStall(found);
      }
    }
  }

  onStallChange(stallId: string): void {
    this.onStallFilterChange(stallId);
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
    let list = this.allLeads();
    const exhId = this.selectedExhibitionId();
    const stallId = this.selectedStallId();

    // 1. Filter by Exhibition if not ALL
    if (exhId && exhId !== 'ALL') {
      const stallsInExh = new Set(this.stallService.stalls().filter(s => s.exhibitionId === exhId).map(s => s.id));
      list = list.filter(l => l.exhibitionId === exhId || (l.stallId && stallsInExh.has(l.stallId)) || (!l.stallId && stallsInExh.has(l.exhibitionId)));
    }

    // 2. Filter by Stall if not ALL
    if (stallId && stallId !== 'ALL') {
      list = list.filter(l => l.stallId === stallId || l.exhibitionId === stallId);
    }

    return list;
  });

  parentExhibition = computed(() => {
    const exhId = this.selectedExhibitionId();
    if (exhId && exhId !== 'ALL') {
      return this.availableExhibitions().find(e => e.id === exhId) || null;
    }
    const activeStall = this.stallService.activeStall();
    if (this.selectedStallId() !== 'ALL' && activeStall?.exhibitionId) {
      return this.availableExhibitions().find(e => e.id === activeStall.exhibitionId) || null;
    }
    return null;
  });

  activeStallReps = computed<string[]>(() => {
    if (this.selectedStallId() === 'ALL') {
      const set = new Set<string>();
      for (const s of this.dropdownStalls()) {
        if (s.marketingRepNames) {
          s.marketingRepNames.split(',').forEach(r => {
            const trimmed = r.trim();
            if (trimmed) set.add(trimmed);
          });
        }
      }
      return Array.from(set).slice(0, 5);
    }
    const repNamesStr = this.stallService.activeStall()?.marketingRepNames;
    if (!repNamesStr) return [];
    return repNamesStr.split(',').map(s => s.trim()).filter(Boolean);
  });

  totalLeads = computed(() => this.filteredStallLeads().length);
  hotLeads = computed(() => this.filteredStallLeads().filter((l) => l.interestLevel === 'Hot').length);
  warmLeads = computed(() => this.filteredStallLeads().filter((l) => l.interestLevel === 'Warm').length);
  coldLeads = computed(() => this.filteredStallLeads().filter((l) => l.interestLevel === 'Cold' || !l.interestLevel).length);

  todayLeadsCount = computed(() => {
    const today = new Date().toISOString().slice(0, 10);
    return this.filteredStallLeads().filter(l => l.createdAt && l.createdAt.startsWith(today)).length;
  });

  pendingSync = computed(() => this.filteredStallLeads().filter((l) => l.syncStatus === 'Pending').length);
  syncedLeadsCount = computed(() => this.filteredStallLeads().filter((l) => l.syncStatus === 'Synced').length);
  
  syncedPercentage = computed(() => {
    const total = this.totalLeads();
    if (total === 0) return 100;
    const synced = this.syncedLeadsCount();
    return Math.round((synced / total) * 100);
  });

  aiCapturesCount = computed(() => {
    return this.filteredStallLeads().filter(l => l.captureMethod === 'card_ocr' || l.captureMethod === 'voice_note').length;
  });

  aiCapturesPercentage = computed(() => {
    const total = this.totalLeads();
    if (total === 0) return 0;
    return Math.round((this.aiCapturesCount() / total) * 100);
  });

  followUpsCount = computed(() => {
    return this.filteredStallLeads().filter(l => !!l.followUpDate).length;
  });

  // Qualification pipeline stages
  pipelineStages = computed(() => {
    const leads = this.filteredStallLeads();
    const total = leads.length || 1;
    const newCount = leads.filter(l => !l.status || l.status === 'New').length;
    const qualifiedCount = leads.filter(l => l.status === 'Qualified').length;
    const convertedCount = leads.filter(l => l.status === 'Converted').length;
    const closedCount = leads.filter(l => l.status === 'Closed').length;

    return {
      new: { count: newCount, pct: Math.round((newCount / total) * 100) },
      qualified: { count: qualifiedCount, pct: Math.round((qualifiedCount / total) * 100) },
      converted: { count: convertedCount, pct: Math.round((convertedCount / total) * 100) },
      closed: { count: closedCount, pct: Math.round((closedCount / total) * 100) },
      conversionRate: Math.round((convertedCount / total) * 100)
    };
  });

  // Acquisition methods breakdown
  methodStats = computed(() => {
    const leads = this.filteredStallLeads();
    const total = leads.length || 1;

    const ocrCount = leads.filter(l => l.captureMethod === 'card_ocr').length;
    const qrCount = leads.filter(l => l.captureMethod === 'qr_scan').length;
    const voiceCount = leads.filter(l => l.captureMethod === 'voice_note').length;
    const manualCount = leads.filter(l => !l.captureMethod || l.captureMethod === 'manual').length;

    return [
      {
        key: 'ocr',
        name: 'Business Card OCR (AI)',
        count: ocrCount,
        pct: Math.round((ocrCount / total) * 100),
        icon: 'badge',
        gradient: 'from-blue-600 to-indigo-600',
        bgLight: 'bg-blue-50',
        textColor: 'text-blue-700',
        border: 'border-blue-200'
      },
      {
        key: 'qr',
        name: 'Badge QR / vCard Scan',
        count: qrCount,
        pct: Math.round((qrCount / total) * 100),
        icon: 'qr_code_scanner',
        gradient: 'from-emerald-500 to-teal-600',
        bgLight: 'bg-emerald-50',
        textColor: 'text-emerald-700',
        border: 'border-emerald-200'
      },
      {
        key: 'voice',
        name: 'Voice Note Audio (AI)',
        count: voiceCount,
        pct: Math.round((voiceCount / total) * 100),
        icon: 'mic',
        gradient: 'from-rose-500 to-pink-600',
        bgLight: 'bg-rose-50',
        textColor: 'text-rose-700',
        border: 'border-rose-200'
      },
      {
        key: 'manual',
        name: 'Manual Direct Entry',
        count: manualCount,
        pct: Math.round((manualCount / total) * 100),
        icon: 'edit_note',
        gradient: 'from-purple-500 to-violet-600',
        bgLight: 'bg-purple-50',
        textColor: 'text-purple-700',
        border: 'border-purple-200'
      }
    ];
  });

  // Time of day footfall velocity distribution
  velocityByTimeOfDay = computed(() => {
    const leads = this.filteredStallLeads();
    const total = leads.length || 1;

    let morning = 0;   // 09:00 - 12:00
    let noon = 0;      // 12:00 - 15:00
    let afternoon = 0; // 15:00 - 18:00
    let evening = 0;   // 18:00+

    for (const lead of leads) {
      if (lead.createdAt) {
        const d = new Date(lead.createdAt);
        const hour = d.getHours();
        if (hour < 12) morning++;
        else if (hour < 15) noon++;
        else if (hour < 18) afternoon++;
        else evening++;
      } else {
        noon++;
      }
    }

    const maxVal = Math.max(morning, noon, afternoon, evening, 1);

    return [
      { label: 'Morning (9AM - 12PM)', count: morning, pct: Math.round((morning / total) * 100), barHeight: Math.max(12, Math.round((morning / maxVal) * 100)) },
      { label: 'Noon Peak (12PM - 3PM)', count: noon, pct: Math.round((noon / total) * 100), barHeight: Math.max(12, Math.round((noon / maxVal) * 100)) },
      { label: 'Afternoon (3PM - 6PM)', count: afternoon, pct: Math.round((afternoon / total) * 100), barHeight: Math.max(12, Math.round((afternoon / maxVal) * 100)) },
      { label: 'Evening (6PM+)', count: evening, pct: Math.round((evening / total) * 100), barHeight: Math.max(12, Math.round((evening / maxVal) * 100)) }
    ];
  });

  // Recent leads live stream (last 6 leads)
  recentLeads = computed(() => {
    const copy = [...this.filteredStallLeads()];
    copy.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    return copy.slice(0, 6);
  });

  // Stall Team Attribution
  repAttribution = computed(() => {
    const leads = this.filteredStallLeads();
    const total = leads.length || 1;
    const map = new Map<string, number>();

    for (const l of leads) {
      const rep = l.repId || 'Stall Rep';
      map.set(rep, (map.get(rep) || 0) + 1);
    }

    const items: { name: string; count: number; pct: number }[] = [];
    map.forEach((count, name) => {
      items.push({ name, count, pct: Math.round((count / total) * 100) });
    });

    items.sort((a, b) => b.count - a.count);
    return items.slice(0, 4);
  });

  // Selected lead for quick view modal
  selectedLeadForQuickView = signal<LocalLead | null>(null);

  openQuickView(lead: LocalLead): void {
    this.selectedLeadForQuickView.set(lead);
  }

  closeQuickView(): void {
    this.selectedLeadForQuickView.set(null);
  }

  formatRelativeTime(dateStr?: string): string {
    if (!dateStr) return 'Recently';
    try {
      const now = new Date();
      const past = new Date(dateStr);
      const diffMs = now.getTime() - past.getTime();
      if (diffMs < 0 || isNaN(diffMs)) return 'Recently';
      const mins = Math.floor(diffMs / 60000);
      if (mins < 1) return 'Just now';
      if (mins < 60) return `${mins}m ago`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours}h ago`;
      const days = Math.floor(hours / 24);
      if (days === 1) return 'Yesterday';
      return `${days}d ago`;
    } catch {
      return 'Recently';
    }
  }

  getInitials(name?: string): string {
    if (!name || !name.trim()) return 'VL';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  exportStallLeadsCsv(): void {
    const leads = this.filteredStallLeads();
    if (leads.length === 0) {
      this.toastService.showInfo('No captured leads available for this stall to export.', 'Export');
      return;
    }

    const headers = [
      'Lead Number',
      'Full Name',
      'Company Name',
      'Designation',
      'Phone',
      'Email',
      'Interest Level',
      'Status',
      'Capture Method',
      'Created At'
    ];

    const rows = leads.map(l => [
      l.leadNumber || '',
      `"${(l.name || '').replace(/"/g, '""')}"`,
      `"${(l.company || '').replace(/"/g, '""')}"`,
      `"${(l.designation || '').replace(/"/g, '""')}"`,
      `"${(l.phone || '').replace(/"/g, '""')}"`,
      `"${(l.email || '').replace(/"/g, '""')}"`,
      l.interestLevel || 'Warm',
      l.status || 'New',
      l.captureMethod || 'manual',
      l.createdAt || ''
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const stallCode = this.stallService.activeStall()?.code || 'stall';
    link.setAttribute('href', url);
    link.setAttribute('download', `leads_${stallCode}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    this.toastService.showSuccess(`Exported ${leads.length} leads to CSV`, 'Export Successful');
  }

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
