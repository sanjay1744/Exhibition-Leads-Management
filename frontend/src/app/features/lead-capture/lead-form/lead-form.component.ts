import { Component, inject, OnInit, signal, computed, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { ApplicationDatabase } from '../../../core/services/db.service';
import { LocalLead, CaptureMethod } from '../../../core/models/lead.model';
import { StallService } from '../../../core/services/stall.service';
import { ExhibitionService } from '../../../core/services/exhibition.service';
import { OcrScannerComponent, ExtractedCardData } from '../ocr-scanner/ocr-scanner.component';
import { QrScannerComponent, QrParsedContact } from '../qr-scanner/qr-scanner.component';
import { VoiceRecorderComponent } from '../voice-recorder/voice-recorder.component';
import { PREDEFINED_DESIGNATIONS } from '../../../core/services/card-parser.service';
import { VoiceParserService } from '../../../core/services/voice-parser.service';
import { getApiUrl } from '../../../core/config/api.config';

@Component({
  selector: 'app-lead-form',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, OcrScannerComponent, QrScannerComponent, VoiceRecorderComponent],
  templateUrl: './lead-form.component.html',
  styleUrl: './lead-form.component.css'
})
export class LeadFormComponent implements OnInit {
  private db = inject(ApplicationDatabase);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private voiceParser = inject(VoiceParserService);
  stallService = inject(StallService);

  @ViewChild('ocrScanner') ocrScanner?: OcrScannerComponent;
  @ViewChild('qrScanner') qrScanner?: QrScannerComponent;
  @ViewChild('voiceRecorder') voiceRecorder?: VoiceRecorderComponent;

  readonly predefinedDesignations = PREDEFINED_DESIGNATIONS;

  editingLeadId: string | null = null;
  existingLeadNumber: string | null = null;
  existingCreatedAt: string | null = null;
  isEditMode = signal(false);
  activeToolTab = signal<'all' | 'ocr' | 'qr' | 'voice'>('all');

  name = '';
  company = '';
  phoneNumbers: string[] = [''];

  get phone(): string {
    return this.phoneNumbers.map(p => p.trim()).filter(p => p.length > 0).join(', ');
  }

  set phone(val: string) {
    if (!val || !val.trim()) {
      this.phoneNumbers = [''];
      return;
    }
    const phonePattern = /(?:\+?91[\s.-]?)?[6-9]\d{4}[\s.-]?\d{5}|\b[6-9]\d{9}\b|(?:\+?91[\s.-]?)?(?:0?\d{3,4}[\s.-]?)?[2-5]\d{6,7}|\b\d{7,13}\b/g;
    const matches = val.match(phonePattern);
    if (matches && matches.length > 0) {
      const uniquePhones: string[] = [];
      const digitsSet = new Set<string>();
      for (const ph of matches) {
        const trimmed = ph.trim();
        const digits = trimmed.replace(/\D/g, '');
        const last10 = digits.length >= 10 ? digits.slice(-10) : digits;
        if (!digitsSet.has(last10)) {
          digitsSet.add(last10);
          uniquePhones.push(trimmed);
        }
      }
      this.phoneNumbers = uniquePhones.slice(0, 3);
    } else {
      const cleanVal = val.trim();
      if (cleanVal.length > 0) {
        this.phoneNumbers = [cleanVal];
      } else {
        this.phoneNumbers = [''];
      }
    }
  }

  addPhoneInput(): void {
    if (this.phoneNumbers.length < 3) {
      this.phoneNumbers.push('');
    }
  }

  removePhoneInput(index: number): void {
    if (index > 0 && index < this.phoneNumbers.length) {
      this.phoneNumbers.splice(index, 1);
    }
  }

  email = '';
  designation = '';
  website = '';
  address = '';
  interestLevel: 'Hot' | 'Warm' | 'Cold' | null = null;
  remarks = '';
  voiceBlob: Blob | string | null = null;
  voiceNotesTranscript: string = '';
  scannedPhotoDataUrl: string | null = null;

  captureMethod: CaptureMethod = 'manual';
  isAutoFilled = signal(false);
  exhibitionService = inject(ExhibitionService);

  sessionLeads = signal<LocalLead[]>([]);
  selectedLeadForView = signal<LocalLead | null>(null);

  activeStallSubtitle = computed(() => {
    const stall = this.stallService.activeStall();
    if (!stall) return 'Main Exhibition & Stall';
    const exh = stall.exhibitionId
      ? this.exhibitionService.exhibitions().find((e) => e.id === stall.exhibitionId)
      : null;
    if (exh) {
      return `${exh.name} - ${stall.name} (${stall.code})`;
    }
    return `${stall.name} (${stall.code})`;
  });

  currentPage = signal<number>(1);
  pageSizeSelect = 20;
  pageSize = signal<number>(20);

  paginatedSessionLeads = computed(() => {
    const list = this.sessionLeads();
    const size = this.pageSize();
    const page = this.currentPage();
    const start = (page - 1) * size;
    return list.slice(start, start + size);
  });

  startIndex = computed(() => {
    if (this.sessionLeads().length === 0) return 0;
    return (this.currentPage() - 1) * this.pageSize() + 1;
  });

  endIndex = computed(() => {
    const end = this.currentPage() * this.pageSize();
    return Math.min(end, this.sessionLeads().length);
  });

  onPageSizeChange(): void {
    this.pageSize.set(Number(this.pageSizeSelect));
    this.currentPage.set(1);
  }

  prevPage(): void {
    if (this.currentPage() > 1) {
      this.currentPage.update((p) => p - 1);
    }
  }

  nextPage(): void {
    if (this.endIndex() < this.sessionLeads().length) {
      this.currentPage.update((p) => p + 1);
    }
  }
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
    this.exhibitionService.loadExhibitions();
    this.stallService.loadStalls();
    
    const activeStall = this.stallService.activeStall();
    if (activeStall?.exhibitionId) {
      this.targetExhibitionId.set(activeStall.exhibitionId);
    } else {
      this.targetExhibitionId.set(this.exhibitionService.exhibitions()[0]?.id || '');
    }
    this.targetStallId.set(activeStall?.id || '');
    this.isTargetModalOpen.set(true);
  }

  selectTargetExhibition(exhId: string): void {
    this.targetExhibitionId.set(exhId);
    this.targetStallId.set('');
  }

  closeTargetSelectionModal(): void {
    this.isTargetModalOpen.set(false);
  }

  confirmTargetStallSelection(): void {
    const stall = this.stallService.stalls().find((s) => s.id === this.targetStallId());
    if (stall) {
      this.stallService.setActiveStall(stall);
    }
    const exh = this.exhibitionService.exhibitions().find((e) => e.id === this.targetExhibitionId());
    if (exh) {
      this.exhibitionService.setActiveExhibition(exh);
    }
    this.isTargetModalOpen.set(false);
  }
  savedMessage = signal<string | null>(null);
  showValidationErrors = signal(false);
  showValidationModal = signal(false);

  quickChips = [
    'Need Urgent Quotation',
    'Schedule Demo Session',
    'High Budget Opportunity',
    'Send Product Catalog PDF',
    'Decision Maker'
  ];

  async ngOnInit(): Promise<void> {
    this.exhibitionService.loadExhibitions();
    this.stallService.loadStalls();

    const stallIdParam = this.route.snapshot.queryParamMap.get('stallId');
    if (stallIdParam) {
      const stall = this.stallService.stalls().find((s) => s.id === stallIdParam);
      if (stall) {
        this.stallService.setActiveStall(stall);
      }
    }

    const idParam = this.route.snapshot.paramMap.get('id') || this.route.snapshot.queryParamMap.get('id');
    if (idParam) {
      this.editingLeadId = idParam;
      this.isEditMode.set(true);
      await this.loadLeadForEdit(idParam);
    }

    this.sessionLeads.set([]);
  }

  formatTimeDisplay(dateStr: string | undefined | null): string {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '-';
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return '-';
    }
  }

  getPhoneNumbersList(phoneStr: string | undefined | null): string[] {
    if (!phoneStr || !phoneStr.trim()) return ['-'];
    return phoneStr.split(/[,/]+/).map(p => p.trim()).filter(p => p.length > 0);
  }

  loadLeadForEditFromPreview(lead: LocalLead): void {
    this.editingLeadId = lead.id;
    this.existingLeadNumber = lead.leadNumber || null;
    this.existingCreatedAt = lead.createdAt;
    this.isEditMode.set(true);

    this.name = lead.name;
    this.company = lead.company || '';
    if (lead.phone) {
      this.phoneNumbers = lead.phone.split(/[,/]+/).map((p) => p.trim()).filter((p) => p.length > 0);
      if (this.phoneNumbers.length === 0) this.phoneNumbers = [''];
    }
    this.email = lead.email || '';
    this.designation = lead.designation || '';
    this.website = lead.website || '';
    this.address = lead.address || '';
    this.interestLevel = lead.interestLevel;
    this.remarks = lead.remarks || '';
    this.voiceBlob = lead.voiceBlob || null;
    this.voiceNotesTranscript = lead.voiceNotesTranscript || '';
    this.scannedPhotoDataUrl = typeof lead.photoBlob === 'string' ? lead.photoBlob : null;
    this.captureMethod = lead.captureMethod || 'manual';
    this.isAutoFilled.set(true);

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async loadLeadForEdit(id: string): Promise<void> {
    const lead = await this.db.getLeadById(id);
    if (lead) {
      this.name = lead.name;
      this.existingLeadNumber = lead.leadNumber || null;
      this.company = lead.company || '';
      this.phone = lead.phone;
      this.email = lead.email || '';
      this.designation = lead.designation || '';
      this.website = lead.website || '';
      this.address = lead.address || '';
      this.interestLevel = lead.interestLevel;
      this.remarks = lead.remarks || '';
      this.voiceBlob = lead.voiceBlob || null;
      this.voiceNotesTranscript = lead.voiceNotesTranscript || '';
      this.scannedPhotoDataUrl = typeof lead.photoBlob === 'string' ? lead.photoBlob : null;
      this.captureMethod = lead.captureMethod || 'manual';
      this.existingCreatedAt = lead.createdAt;
    } else {
      alert('Selected lead record not found.');
      this.router.navigate(['/leads']);
    }
  }

  async generateNextLeadNumber(): Promise<string> {
    const activeStall = this.stallService.activeStall();
    let stallNum = 1;
    if (activeStall?.code) {
      const match = activeStall.code.match(/\d+$/) || activeStall.code.match(/\d+/);
      if (match) {
        stallNum = parseInt(match[0], 10);
      }
    }
    const prefix = `S${stallNum}L`;

    const allLeads = await this.db.getAllLeads();
    let maxSeq = 0;
    for (const lead of allLeads) {
      if (lead.leadNumber) {
        const match = lead.leadNumber.match(/S\d+L(\d+)/i);
        if (match && match[1]) {
          const seq = parseInt(match[1], 10);
          if (seq > maxSeq) maxSeq = seq;
        }
      }
    }
    const nextSeq = maxSeq + 1;
    return `${prefix}${nextSeq.toString().padStart(5, '0')}`;
  }

  onCardExtracted(data: ExtractedCardData): void {
    if (data.name) this.name = data.name;
    if (data.company) this.company = data.company;
    if (data.phone) this.phone = data.phone;
    if (data.email) this.email = data.email;
    if (data.designation) this.designation = data.designation;
    if (data.website) this.website = data.website;
    if (data.address) this.address = data.address;
    if (data.photoDataUrl) this.scannedPhotoDataUrl = data.photoDataUrl;
    this.captureMethod = 'card_ocr';
    this.isAutoFilled.set(true);
  }

  onQrScanned(data: QrParsedContact): void {
    if (data.name) this.name = data.name;
    if (data.company) this.company = data.company;
    if (data.phone) this.phone = data.phone;
    if (data.email) this.email = data.email;
    if (data.designation) this.designation = data.designation;
    if (data.website) this.website = data.website;
    if (data.address) this.address = data.address;
    if (data.remarks && !this.remarks) this.remarks = data.remarks;
    this.captureMethod = 'qr_scan';
    this.isAutoFilled.set(true);
  }

  onVoiceRecorded(blob: Blob): void {
    this.voiceBlob = blob;
    if (this.captureMethod === 'manual') {
      this.captureMethod = 'voice_note';
    }
  }

  onTranscriptGenerated(transcript: string): void {
    this.voiceNotesTranscript = transcript;
    if (transcript && transcript.trim().length > 0) {
      const parsed = this.voiceParser.parseVoiceTranscript(transcript);
      console.log('Voice parser extracted entities:', parsed);

      if (parsed.name && parsed.name.toLowerCase() !== 'hello') {
        this.name = parsed.name;
      }
      if (parsed.company && (!this.company || this.company.trim() === '')) {
        this.company = parsed.company;
      }
      if (parsed.phone && parsed.phone.trim().length > 0) {
        this.phone = parsed.phone;
      }
      if (parsed.email && (!this.email || this.email.trim() === '')) {
        this.email = parsed.email;
      }
      if (parsed.designation && (!this.designation || this.designation.trim() === '')) {
        this.designation = parsed.designation;
      }
      if (parsed.interestLevel) {
        this.interestLevel = parsed.interestLevel;
      }
      if (parsed.remarks && (!this.remarks || this.remarks.trim() === '')) {
        this.remarks = parsed.remarks;
      }

      this.isAutoFilled.set(true);
    }
  }

  onVoiceCleared(): void {
    this.voiceBlob = null;
    this.voiceNotesTranscript = '';
  }

  addQuickRemark(chip: string): void {
    if (this.remarks) {
      this.remarks += `, ${chip}`;
    } else {
      this.remarks = chip;
    }
  }

  resetForm(): void {
    this.name = '';
    this.company = '';
    this.phone = '';
    this.email = '';
    this.designation = '';
    this.website = '';
    this.address = '';
    this.remarks = '';
    this.voiceBlob = null;
    this.voiceNotesTranscript = '';
    this.scannedPhotoDataUrl = null;
    this.interestLevel = null;
    this.captureMethod = 'manual';
    this.isAutoFilled.set(false);
    this.showValidationErrors.set(false);
    this.showValidationModal.set(false);

    this.ocrScanner?.reset();
    this.qrScanner?.reset();
    this.voiceRecorder?.reset();
  }

  private convertBlobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  private async saveImageToLocalDeviceFolder(dataUrl: string, leadNumber: string): Promise<void> {
    try {
      const apiUrl = `${getApiUrl()}/v1/leads/save-image-local`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadNumber: leadNumber,
          photoDataUrl: dataUrl
        })
      });
      if (response.ok) {
        const res = await response.json();
        console.log(`[LeadForm] Image written directly to device folder: ${res.savedDevicePath}`);
      }
    } catch (e) {
      console.warn('[LeadForm] Backend local folder save offline/unavailable:', e);
    }
  }

  private async saveAudioToLocalDeviceFolder(dataUrl: string, leadNumber: string): Promise<string | null> {
    try {
      const apiUrl = `${getApiUrl()}/v1/leads/save-audio-local`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadNumber: leadNumber,
          audioDataUrl: dataUrl
        })
      });
      if (response.ok) {
        const res = await response.json();
        console.log(`[LeadForm] Audio written directly to device folder: ${res.savedDevicePath}`);
        return res.webUrl || res.savedDevicePath;
      }
    } catch (e) {
      console.warn('[LeadForm] Backend local folder audio save offline/unavailable:', e);
    }
    return null;
  }

  async saveLead(): Promise<void> {
    if (!this.name || !this.name.trim() || !this.phone || !this.phone.trim() || this.phone === '-' || !this.interestLevel) {
      this.showValidationErrors.set(true);
      this.showValidationModal.set(true);
      return;
    }

    this.showValidationErrors.set(false);
    this.showValidationModal.set(false);

    const activeStallId = this.stallService.activeStall()?.id || '33333333-3333-3333-3333-333333333333';

    let leadNumberToUse = this.existingLeadNumber;
    if (!leadNumberToUse) {
      leadNumberToUse = await this.generateNextLeadNumber();
    }

    if (this.scannedPhotoDataUrl) {
      await this.saveImageToLocalDeviceFolder(this.scannedPhotoDataUrl, leadNumberToUse);
    }

    let finalVoiceAudioUrl: string | undefined = undefined;
    if (this.voiceBlob) {
      if (this.voiceBlob instanceof Blob) {
        finalVoiceAudioUrl = await this.convertBlobToDataUrl(this.voiceBlob);
      } else if (typeof this.voiceBlob === 'string') {
        finalVoiceAudioUrl = this.voiceBlob;
      }

      if (finalVoiceAudioUrl) {
        await this.saveAudioToLocalDeviceFolder(finalVoiceAudioUrl, leadNumberToUse);
      }
    }

    const leadToSave: LocalLead = {
      id: this.editingLeadId || crypto.randomUUID(),
      leadNumber: leadNumberToUse,
      exhibitionId: activeStallId,
      repId: 'REP_001',
      name: this.name,
      company: this.company,
      phone: this.phone,
      email: this.email,
      designation: this.designation,
      website: this.website,
      address: this.address,
      captureMethod: this.captureMethod,
      photoBlob: this.scannedPhotoDataUrl || undefined,
      voiceBlob: finalVoiceAudioUrl || (typeof this.voiceBlob === 'string' ? this.voiceBlob : undefined),
      voiceNotesTranscript: this.voiceNotesTranscript || undefined,
      interestLevel: this.interestLevel || 'Warm',
      productCategory: ['Enterprise'],
      priority: 'High',
      remarks: this.remarks,
      status: 'New',
      syncStatus: 'Pending',
      createdAt: this.existingCreatedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await this.db.saveLead(leadToSave);
    const actionText = this.isEditMode() ? 'updated' : 'saved';
    
    this.sessionLeads.update(list => [leadToSave, ...list.filter(l => l.id !== leadToSave.id)]);
    this.currentPage.set(1);

    this.savedMessage.set(`Lead ${leadNumberToUse} ${actionText} successfully and added to preview grid below!`);

    this.isEditMode.set(false);
    this.editingLeadId = null;
    this.existingLeadNumber = null;
    this.existingCreatedAt = null;
    this.resetForm();

    setTimeout(() => {
      this.savedMessage.set(null);
    }, 4000);
  }
}
