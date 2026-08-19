import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApplicationDatabase } from '../../../core/services/db.service';
import { LocalLead } from '../../../core/models/lead.model';
import { StallService } from '../../../core/services/stall.service';
import { ExhibitionService } from '../../../core/services/exhibition.service';

@Component({
  selector: 'app-lead-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './lead-list.component.html',
  styleUrl: './lead-list.component.css'
})
export class LeadListComponent implements OnInit {
  private db = inject(ApplicationDatabase);
  private router = inject(Router);
  stallService = inject(StallService);
  exhibitionService = inject(ExhibitionService);

  allLeads = signal<LocalLead[]>([]);
  selectedLeadForView = signal<LocalLead | null>(null);
  selectedExhibitionId = signal<string>('ALL');
  selectedStallId = signal<string>('ALL');

  isTargetModalOpen = signal<boolean>(false);
  targetExhibitionId = signal<string>('');
  targetStallId = signal<string>('');

  targetStalls = computed(() => {
    const exhId = this.targetExhibitionId();
    if (!exhId) return [];
    return this.stallService.stalls().filter(
      (s) => s.exhibitionId === exhId || (!s.exhibitionId && exhId === '44444444-4444-4444-4444-444444444444')
    );
  });

  openTargetSelectionModal(): void {
    this.targetExhibitionId.set('');
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
    this.isTargetModalOpen.set(false);
    this.router.navigate(['/capture'], { queryParams: { stallId: this.targetStallId(), exhibitionId: exhId } });
  }

  headerSubtitle = computed(() => {
    const exhId = this.selectedExhibitionId();
    const stallId = this.selectedStallId();

    const selectedExh = exhId !== 'ALL' ? this.exhibitionService.exhibitions().find((e) => e.id === exhId) : null;
    const selectedStall = stallId !== 'ALL' ? this.stallService.stalls().find((s) => s.id === stallId) : null;

    if (selectedExh && selectedStall) {
      return `${selectedExh.name.toUpperCase()} • ${selectedStall.name.toUpperCase()}`;
    } else if (selectedExh && !selectedStall) {
      return `${selectedExh.name.toUpperCase()} (ALL STALLS)`;
    } else if (!selectedExh && selectedStall) {
      const parentExh = selectedStall.exhibitionId
        ? this.exhibitionService.exhibitions().find((e) => e.id === selectedStall.exhibitionId)
        : null;
      return parentExh
        ? `${parentExh.name.toUpperCase()} • ${selectedStall.name.toUpperCase()}`
        : selectedStall.name.toUpperCase();
    } else {
      return 'ALL EXHIBITIONS & STALLS';
    }
  });

  searchTerm = signal<string>('');
  filterDateFrom = signal<string>('');
  filterDateTo = signal<string>('');
  filterInterest = signal<string>('Hot');
  filterSyncStatus = signal<string>('ALL');
  filterHasMedia = signal<string>('ALL');
  showFilterSection = signal<boolean>(false);

  toggleFilterSection(): void {
    this.showFilterSection.update((v) => !v);
  }

  pageSize = signal(20);
  pageSizeSelect = 20;
  currentPage = signal(1);

  hasActiveFilters = computed(() => {
    return !!(
      this.selectedExhibitionId() !== 'ALL' ||
      this.selectedStallId() !== 'ALL' ||
      this.searchTerm().trim() ||
      this.filterDateFrom() ||
      this.filterDateTo() ||
      this.filterInterest() !== 'ALL' ||
      this.filterSyncStatus() !== 'ALL' ||
      this.filterHasMedia() !== 'ALL'
    );
  });

  resetAllFilters(): void {
    this.selectedExhibitionId.set('ALL');
    this.selectedStallId.set('ALL');
    this.searchTerm.set('');
    this.filterDateFrom.set('');
    this.filterDateTo.set('');
    this.filterInterest.set('ALL');
    this.filterSyncStatus.set('ALL');
    this.filterHasMedia.set('ALL');
    this.currentPage.set(1);
  }

  setTodayFilter(): void {
    const todayStr = new Date().toISOString().split('T')[0];
    if (this.isTodayActive()) {
      this.filterDateFrom.set('');
      this.filterDateTo.set('');
    } else {
      this.filterDateFrom.set(todayStr);
      this.filterDateTo.set(todayStr);
    }
    this.currentPage.set(1);
  }

  isTodayActive(): boolean {
    const todayStr = new Date().toISOString().split('T')[0];
    return this.filterDateFrom() === todayStr && this.filterDateTo() === todayStr;
  }

  setHotLeadsFilter(): void {
    this.filterInterest.set(this.filterInterest() === 'Hot' ? 'ALL' : 'Hot');
    this.currentPage.set(1);
  }

  setPendingSyncFilter(): void {
    this.filterSyncStatus.set(this.filterSyncStatus() === 'Pending' ? 'ALL' : 'Pending');
    this.currentPage.set(1);
  }

  setMediaOnlyFilter(): void {
    this.filterHasMedia.set(this.filterHasMedia() === 'ANY_MEDIA' ? 'ALL' : 'ANY_MEDIA');
    this.currentPage.set(1);
  }

  showInterestDropdown = signal(false);
  showSyncDropdown = signal(false);
  showStallDropdown = signal(false);
  showExhibitionDropdown = signal(false);

  dropdownStalls = computed(() => {
    const exhId = this.selectedExhibitionId();
    if (!exhId || exhId === 'ALL') {
      return this.stallService.stalls();
    }
    return this.stallService.stalls().filter(
      (s) => s.exhibitionId === exhId || (!s.exhibitionId && exhId === '44444444-4444-4444-4444-444444444444')
    );
  });

  openExhibitionDropdown(): void {
    this.closeDatePicker();
    this.showInterestDropdown.set(false);
    this.showSyncDropdown.set(false);
    this.showStallDropdown.set(false);
    this.showExhibitionDropdown.update((v) => !v);
  }

  getSelectedExhibitionName(): string {
    if (this.selectedExhibitionId() === 'ALL') return 'All Exhibitions';
    const found = this.exhibitionService.exhibitions().find((e) => e.id === this.selectedExhibitionId());
    return found ? `${found.name} (${found.code})` : 'All Exhibitions';
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
    this.currentPage.set(1);
  }

  openInterestDropdown(): void {
    this.closeDatePicker();
    this.showExhibitionDropdown.set(false);
    this.showSyncDropdown.set(false);
    this.showStallDropdown.set(false);
    this.showInterestDropdown.update((v) => !v);
  }

  openSyncDropdown(): void {
    this.closeDatePicker();
    this.showExhibitionDropdown.set(false);
    this.showInterestDropdown.set(false);
    this.showStallDropdown.set(false);
    this.showSyncDropdown.update((v) => !v);
  }

  openStallDropdown(): void {
    this.closeDatePicker();
    this.showExhibitionDropdown.set(false);
    this.showInterestDropdown.set(false);
    this.showSyncDropdown.set(false);
    this.showStallDropdown.update((v) => !v);
  }

  getSelectedStallName(): string {
    if (this.selectedStallId() === 'ALL') return 'All Stalls (All Leads)';
    const found = this.stallService.stalls().find((s) => s.id === this.selectedStallId());
    return found ? `${found.name} (${found.code})` : 'All Stalls (All Leads)';
  }

  showDatePicker = signal<'from' | 'to' | null>(null);
  currentPickerYear = signal<number>(new Date().getFullYear());
  currentPickerMonth = signal<number>(new Date().getMonth());

  monthShortNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  weekDayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  openDatePicker(mode: 'from' | 'to'): void {
    this.showExhibitionDropdown.set(false);
    this.showInterestDropdown.set(false);
    this.showSyncDropdown.set(false);
    this.showStallDropdown.set(false);

    if (this.showDatePicker() === mode) {
      this.showDatePicker.set(null);
      return;
    }

    let targetDateStr = mode === 'from' ? this.filterDateFrom() : this.filterDateTo();
    if (!targetDateStr && mode === 'to' && this.filterDateFrom()) {
      targetDateStr = this.filterDateFrom();
    }

    if (targetDateStr) {
      const parts = targetDateStr.split('-');
      if (parts.length === 3) {
        this.currentPickerYear.set(parseInt(parts[0], 10));
        this.currentPickerMonth.set(parseInt(parts[1], 10) - 1);
      }
    } else {
      this.currentPickerYear.set(new Date().getFullYear());
      this.currentPickerMonth.set(new Date().getMonth());
    }

    this.showDatePicker.set(mode);
  }

  closeDatePicker(): void {
    this.showDatePicker.set(null);
  }

  prevPickerMonth(): void {
    if (this.currentPickerMonth() === 0) {
      this.currentPickerMonth.set(11);
      this.currentPickerYear.update((y) => y - 1);
    } else {
      this.currentPickerMonth.update((m) => m - 1);
    }
  }

  nextPickerMonth(): void {
    if (this.currentPickerMonth() === 11) {
      this.currentPickerMonth.set(0);
      this.currentPickerYear.update((y) => y + 1);
    } else {
      this.currentPickerMonth.update((m) => m + 1);
    }
  }

  pickerCalendarDays = computed(() => {
    const year = this.currentPickerYear();
    const month = this.currentPickerMonth();

    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevDaysInMonth = new Date(year, month, 0).getDate();

    const result: { dateStr: string; dayNum: number; isCurrentMonth: boolean }[] = [];

    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = prevDaysInMonth - i;
      const prevM = month === 0 ? 11 : month - 1;
      const prevY = month === 0 ? year - 1 : year;
      const mStr = String(prevM + 1).padStart(2, '0');
      const dStr = String(dayNum).padStart(2, '0');
      result.push({
        dateStr: `${prevY}-${mStr}-${dStr}`,
        dayNum,
        isCurrentMonth: false
      });
    }

    const mStr = String(month + 1).padStart(2, '0');
    for (let d = 1; d <= daysInMonth; d++) {
      const dStr = String(d).padStart(2, '0');
      result.push({
        dateStr: `${year}-${mStr}-${dStr}`,
        dayNum: d,
        isCurrentMonth: true
      });
    }

    const totalCells = Math.ceil(result.length / 7) * 7;
    const nextCount = totalCells - result.length;
    const nextM = month === 11 ? 0 : month + 1;
    const nextY = month === 11 ? year + 1 : year;
    const nextMStr = String(nextM + 1).padStart(2, '0');
    for (let d = 1; d <= nextCount; d++) {
      const dStr = String(d).padStart(2, '0');
      result.push({
        dateStr: `${nextY}-${nextMStr}-${dStr}`,
        dayNum: d,
        isCurrentMonth: false
      });
    }

    return result;
  });

  selectPickerDate(dateStr: string): void {
    const mode = this.showDatePicker();
    if (mode === 'from') {
      this.filterDateFrom.set(dateStr);
      if (this.filterDateTo() && this.filterDateTo() < dateStr) {
        this.filterDateTo.set('');
      }
      this.currentPage.set(1);
      this.showDatePicker.set('to');
    } else if (mode === 'to') {
      if (this.filterDateFrom() && dateStr < this.filterDateFrom()) {
        this.filterDateTo.set(this.filterDateFrom());
        this.filterDateFrom.set(dateStr);
      } else {
        this.filterDateTo.set(dateStr);
      }
      this.currentPage.set(1);
      this.showDatePicker.set(null);
    }
  }

  isDateSelected(dateStr: string): boolean {
    const mode = this.showDatePicker();
    if (mode === 'from') {
      return this.filterDateFrom() === dateStr;
    } else if (mode === 'to') {
      return this.filterDateTo() === dateStr;
    }
    return this.filterDateFrom() === dateStr || this.filterDateTo() === dateStr;
  }

  isTodayDate(dateStr: string): boolean {
    const today = new Date().toISOString().split('T')[0];
    return dateStr === today;
  }

  isInRangeDate(dateStr: string): boolean {
    const from = this.filterDateFrom();
    const to = this.filterDateTo();
    if (!from || !to) return false;
    return dateStr >= from && dateStr <= to;
  }

  formatDateDisplay(dateStr: string): string {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const y = parts[0];
    const mIdx = parseInt(parts[1], 10) - 1;
    const d = parts[2];
    const mName = this.monthShortNames[mIdx] || parts[1];
    return `${d}/${mName}/${y}`;
  }

  setThisMonthFilter(): void {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    this.filterDateFrom.set(this.formatYYYYMMDD(firstDay));
    this.filterDateTo.set(this.formatYYYYMMDD(now));
    this.currentPage.set(1);
  }

  formatYYYYMMDD(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  async ngOnInit(): Promise<void> {
    this.exhibitionService.loadExhibitions();
    this.stallService.loadStalls();
    await this.loadLeads();
  }

  async loadLeads(): Promise<void> {
    const list = await this.db.getAllLeads();
    let updated = false;
    for (let i = 0; i < list.length; i++) {
      if (!list[i].leadNumber) {
        list[i].leadNumber = `S1L${(list.length - i).toString().padStart(5, '0')}`;
        await this.db.saveLead(list[i]);
        updated = true;
      }
    }
    this.allLeads.set(list);
  }

  getPhoneNumbersList(phoneStr: string | undefined | null): string[] {
    if (!phoneStr || !phoneStr.trim()) return ['-'];
    return phoneStr.split(/[,/]+/).map(p => p.trim()).filter(p => p.length > 0);
  }

  formatCreatedDate(dateStr: string | undefined | null): string {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '-';
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return '-';
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
    this.currentPage.set(1);
  }

  getStallName(exhibitionId?: string): string {
    if (!exhibitionId) return 'Stall 01 - Main Exhibition';
    const stall = this.stallService.stalls().find((s) => s.id === exhibitionId);
    return stall ? stall.name : 'Stall 01 - Main Exhibition';
  }

  dateAndStallFilteredLeads = computed(() => {
    let list = this.allLeads();

    const exhId = this.selectedExhibitionId();
    if (exhId && exhId !== 'ALL') {
      const stallsInExhibition = new Set(
        this.stallService.stalls()
          .filter((s) => s.exhibitionId === exhId)
          .map((s) => s.id)
      );
      const defaultExhId = '44444444-4444-4444-4444-444444444444';
      const defaultStallId = '33333333-3333-3333-3333-333333333333';

      list = list.filter((l) => {
        if (l.exhibitionId === exhId) return true;
        if (l.exhibitionId && stallsInExhibition.has(l.exhibitionId)) return true;
        if (!l.exhibitionId && (exhId === defaultExhId || stallsInExhibition.has(defaultStallId))) return true;
        return false;
      });
    }

    const stallId = this.selectedStallId();
    if (stallId && stallId !== 'ALL') {
      list = list.filter((l) => l.exhibitionId === stallId || (!l.exhibitionId && stallId === '33333333-3333-3333-3333-333333333333'));
    }

    const q = this.searchTerm().trim().toLowerCase();
    if (q) {
      list = list.filter((l) =>
        (l.name && l.name.toLowerCase().includes(q)) ||
        (l.leadNumber && l.leadNumber.toLowerCase().includes(q)) ||
        (l.company && l.company.toLowerCase().includes(q)) ||
        (l.phone && l.phone.toLowerCase().includes(q)) ||
        (l.designation && l.designation.toLowerCase().includes(q)) ||
        (l.email && l.email.toLowerCase().includes(q)) ||
        (l.address && l.address.toLowerCase().includes(q)) ||
        (l.remarks && l.remarks.toLowerCase().includes(q))
      );
    }

    const fromStr = this.filterDateFrom();
    if (fromStr) {
      const fromTime = new Date(fromStr + 'T00:00:00').getTime();
      list = list.filter((l) => {
        if (!l.createdAt) return false;
        return new Date(l.createdAt).getTime() >= fromTime;
      });
    }

    const toStr = this.filterDateTo();
    if (toStr) {
      const toTime = new Date(toStr + 'T23:59:59').getTime();
      list = list.filter((l) => {
        if (!l.createdAt) return false;
        return new Date(l.createdAt).getTime() <= toTime;
      });
    }

    const sync = this.filterSyncStatus();
    if (sync && sync !== 'ALL') {
      list = list.filter((l) => l.syncStatus === sync);
    }

    const media = this.filterHasMedia();
    if (media === 'CARD_ONLY') {
      list = list.filter((l) => !!l.photoBlob);
    } else if (media === 'VOICE_ONLY') {
      list = list.filter((l) => !!l.voiceBlob || !!l.voiceNotesTranscript);
    } else if (media === 'ANY_MEDIA') {
      list = list.filter((l) => !!l.photoBlob || !!l.voiceBlob || !!l.voiceNotesTranscript);
    }

    return list;
  });

  hotLeadsCount = computed(() => this.dateAndStallFilteredLeads().filter((l) => l.interestLevel === 'Hot').length);
  warmLeadsCount = computed(() => this.dateAndStallFilteredLeads().filter((l) => l.interestLevel === 'Warm').length);
  coldLeadsCount = computed(() => this.dateAndStallFilteredLeads().filter((l) => l.interestLevel === 'Cold').length);

  filteredLeads = computed(() => {
    let list = this.dateAndStallFilteredLeads();

    const interest = this.filterInterest();
    if (interest && interest !== 'ALL') {
      list = list.filter((l) => l.interestLevel === interest);
    }

    return list;
  });

  paginatedLeads = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize();
    return this.filteredLeads().slice(start, start + this.pageSize());
  });

  startIndex = computed(() => {
    if (this.filteredLeads().length === 0) return 0;
    return (this.currentPage() - 1) * this.pageSize() + 1;
  });

  endIndex = computed(() => Math.min(this.currentPage() * this.pageSize(), this.filteredLeads().length));

  onPageSizeChange(): void {
    this.pageSize.set(Number(this.pageSizeSelect));
    this.currentPage.set(1);
  }

  prevPage(): void {
    if (this.currentPage() > 1) this.currentPage.update((p) => p - 1);
  }

  nextPage(): void {
    if (this.endIndex() < this.filteredLeads().length) this.currentPage.update((p) => p + 1);
  }

  goToFirstPage(): void {
    this.currentPage.set(1);
  }

  goToLastPage(): void {
    const totalPages = Math.ceil(this.filteredLeads().length / this.pageSize());
    this.currentPage.set(Math.max(1, totalPages));
  }

  openViewModal(lead: LocalLead): void {
    this.selectedLeadForView.set(lead);
  }

  closeViewModal(): void {
    this.selectedLeadForView.set(null);
  }

  editFromViewModal(): void {
    const lead = this.selectedLeadForView();
    if (lead) {
      this.closeViewModal();
      this.editLead(lead);
    }
  }

  editLead(lead: LocalLead): void {
    this.router.navigate(['/capture', lead.id]);
  }

  getVoiceAudioUrl(lead: LocalLead | null): string | null {
    if (!lead || !lead.voiceBlob) return null;
    if (lead.voiceBlob instanceof Blob) {
      return URL.createObjectURL(lead.voiceBlob);
    }
    if (typeof lead.voiceBlob === 'string') {
      return lead.voiceBlob;
    }
    return null;
  }

  downloadLeadAudio(lead: LocalLead | null): void {
    if (!lead) return;
    const url = this.getVoiceAudioUrl(lead);
    if (!url) return;
    const ext = url.startsWith('data:audio/mp4') || url.startsWith('data:audio/m4a') ? '.m4a' : '.webm';
    const fileName = `${lead.leadNumber || 'lead'}_voice_note${ext}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  getCardImageUrl(lead: LocalLead | null): string | null {
    if (!lead || !lead.photoBlob) return null;
    if (typeof lead.photoBlob === 'string') return lead.photoBlob;
    if (lead.photoBlob instanceof Blob) return URL.createObjectURL(lead.photoBlob);
    return null;
  }

  downloadLeadCardImage(lead: LocalLead | null): void {
    if (!lead) return;
    const url = this.getCardImageUrl(lead);
    if (!url) return;
    const fileName = `${lead.leadNumber || 'S1L00001'}.jpg`;
    try {
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      console.warn('[LeadList] Image download failed:', e);
    }
  }

  selectedLeadForDelete = signal<LocalLead | null>(null);

  deleteLead(lead: LocalLead): void {
    this.selectedLeadForDelete.set(lead);
  }

  cancelDelete(): void {
    this.selectedLeadForDelete.set(null);
  }

  async confirmDeleteLead(): Promise<void> {
    const lead = this.selectedLeadForDelete();
    if (lead) {
      await this.db.deleteLead(lead.id);
      this.selectedLeadForDelete.set(null);
      await this.loadLeads();
    }
  }
}
