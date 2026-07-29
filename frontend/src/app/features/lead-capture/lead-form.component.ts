import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { ApplicationDatabase } from '../../core/services/db.service';
import { LocalLead, CaptureMethod } from '../../core/models/lead.model';
import { StallService } from '../../core/services/stall.service';
import { OcrScannerComponent, ExtractedCardData } from './ocr-scanner.component';
import { QrScannerComponent, QrParsedContact } from './qr-scanner.component';
import { VoiceRecorderComponent } from './voice-recorder.component';

@Component({
  selector: 'app-lead-form',
  standalone: true,
  imports: [CommonModule, FormsModule, OcrScannerComponent, QrScannerComponent, VoiceRecorderComponent],
  template: `
    <div class="max-w-5xl mx-auto">
      <!-- Page Header -->
      <div class="page-title-bar flex items-center justify-between mb-6">
        <div>
          <h1 class="page-title text-xl font-bold text-slate-900 uppercase tracking-wide">
            {{ isEditMode() ? 'EDIT LEAD ENTRY' : 'NEW LEAD ENTRY' }}
          </h1>
          <p class="page-subtitle text-xs text-slate-500">
            {{ isEditMode() ? 'Modify visitor details for record ID: ' + editingLeadId : 'Capture visitor details for project: ' + (stallService.activeStall()?.name || 'Main Exhibition') }}
          </p>
        </div>

        <div class="text-xs bg-blue-50 border border-blue-200 text-blue-800 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 shadow-2xs">
          <span class="material-icons text-sm text-blue-600">storefront</span>
          {{ stallService.activeStall()?.code || 'STALL-01' }}
        </div>
      </div>

      <!-- Quick Acquisition Tools Grid (Shown when creating or optional) -->
      @if (!isEditMode()) {
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <app-ocr-scanner (cardExtracted)="onCardExtracted($event)"></app-ocr-scanner>
          <app-qr-scanner (qrScanned)="onQrScanned($event)"></app-qr-scanner>
          <app-voice-recorder (voiceRecorded)="onVoiceRecorded($event)"></app-voice-recorder>
        </div>
      }

      <!-- Visitor Information Form Card -->
      <div class="card-panel bg-white rounded-xl border border-slate-200 p-6 shadow-sm overflow-hidden">
        <div class="bg-[#1a3a5c] text-white p-4 rounded-t-xl -mx-6 -mt-6 mb-6 flex items-center justify-between shadow-xs">
          <div class="flex items-center gap-2">
            <span class="material-icons text-blue-300">contact_page</span>
            <h2 class="text-sm font-bold text-white uppercase tracking-wide">
              {{ isEditMode() ? 'Edit Visitor Record & Requirements' : 'Visitor Information & Requirements' }}
            </h2>
          </div>
          @if (isAutoFilled()) {
            <span class="status-pill green bg-emerald-500 text-white font-bold border border-emerald-400">
              <span class="material-icons text-xs">auto_awesome</span> Auto-Filled from {{ captureMethod === 'qr_scan' ? 'QR Scanner' : captureMethod === 'card_ocr' ? 'OCR Card' : 'Scanner' }}
            </span>
          }
        </div>

        <form (ngSubmit)="saveLead()">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
            <!-- Full Name * (Mandatory) -->
            <div>
              <label class="form-label font-bold text-xs text-slate-700 mb-1">Full Name *</label>
              <div class="relative flex items-center">
                <span class="material-icons absolute left-3 text-slate-400 text-lg">person</span>
                <input 
                  [(ngModel)]="name" 
                  name="name" 
                  required 
                  class="form-control pl-10 text-xs font-semibold" 
                  placeholder="Visitor Name" 
                />
              </div>
            </div>

            <!-- Company Name (Optional) -->
            <div>
              <label class="form-label font-bold text-xs text-slate-700 mb-1">Company Name</label>
              <div class="relative flex items-center">
                <span class="material-icons absolute left-3 text-slate-400 text-lg">business</span>
                <input 
                  [(ngModel)]="company" 
                  name="company" 
                  class="form-control pl-10 text-xs font-semibold" 
                  placeholder="Company Name" 
                />
              </div>
            </div>

            <!-- Mobile Phone * (Mandatory) -->
            <div>
              <label class="form-label font-bold text-xs text-slate-700 mb-1">Mobile Phone *</label>
              <div class="relative flex items-center">
                <span class="material-icons absolute left-3 text-slate-400 text-lg">call</span>
                <input 
                  [(ngModel)]="phone" 
                  name="phone" 
                  required 
                  class="form-control pl-10 text-xs font-semibold" 
                  placeholder="+91 9876543210" 
                />
              </div>
            </div>

            <!-- Email Address (Optional) -->
            <div>
              <label class="form-label font-bold text-xs text-slate-700 mb-1">Email Address</label>
              <div class="relative flex items-center">
                <span class="material-icons absolute left-3 text-slate-400 text-lg">mail</span>
                <input 
                  [(ngModel)]="email" 
                  name="email" 
                  class="form-control pl-10 text-xs font-semibold" 
                  placeholder="visitor@company.com" 
                />
              </div>
            </div>

            <!-- Designation (Optional) -->
            <div>
              <label class="form-label font-bold text-xs text-slate-700 mb-1">Designation / Role</label>
              <div class="relative flex items-center">
                <span class="material-icons absolute left-3 text-slate-400 text-lg">work</span>
                <input 
                  [(ngModel)]="designation" 
                  name="designation" 
                  class="form-control pl-10 text-xs font-semibold" 
                  placeholder="Purchase Manager / Director" 
                />
              </div>
            </div>

            <!-- Website URL (Optional) -->
            <div>
              <label class="form-label font-bold text-xs text-slate-700 mb-1">Website URL</label>
              <div class="relative flex items-center">
                <span class="material-icons absolute left-3 text-slate-400 text-lg">language</span>
                <input 
                  [(ngModel)]="website" 
                  name="website" 
                  class="form-control pl-10 text-xs font-semibold" 
                  placeholder="www.company.com" 
                />
              </div>
            </div>

            <!-- Address / Location (Optional) -->
            <div>
              <label class="form-label font-bold text-xs text-slate-700 mb-1">Address / Location</label>
              <div class="relative flex items-center">
                <span class="material-icons absolute left-3 text-slate-400 text-lg">location_on</span>
                <input 
                  [(ngModel)]="address" 
                  name="address" 
                  class="form-control pl-10 text-xs font-semibold" 
                  placeholder="City, State or Full Address" 
                />
              </div>
            </div>

            <!-- Interest Priority Buttons -->
            <div>
              <label class="form-label font-bold text-xs text-slate-700 mb-1">Interest Priority</label>
              <div class="flex gap-2 pt-0.5">
                <button 
                  type="button" 
                  (click)="interestLevel = 'Hot'" 
                  class="flex-1 py-2 px-3 rounded-lg text-xs font-bold border transition flex items-center justify-center gap-1"
                  [ngClass]="interestLevel === 'Hot' ? 'bg-red-50 border-red-500 text-red-700 shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'"
                >
                  Hot
                </button>

                <button 
                  type="button" 
                  (click)="interestLevel = 'Warm'" 
                  class="flex-1 py-2 px-3 rounded-lg text-xs font-bold border transition flex items-center justify-center gap-1"
                  [ngClass]="interestLevel === 'Warm' ? 'bg-amber-50 border-amber-500 text-amber-700 shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'"
                >
                  Warm
                </button>

                <button 
                  type="button" 
                  (click)="interestLevel = 'Cold'" 
                  class="flex-1 py-2 px-3 rounded-lg text-xs font-bold border transition flex items-center justify-center gap-1"
                  [ngClass]="interestLevel === 'Cold' ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'"
                >
                  Cold
                </button>
              </div>
            </div>
          </div>

          <!-- Discussion Remarks & Quick Tags -->
          <div class="mb-5">
            <div class="flex justify-between items-center mb-1.5">
              <label class="form-label font-bold text-xs text-slate-700 mb-0">Discussion Remarks & Requirements</label>
              <span class="text-[11px] text-slate-400 font-medium">Click chips below to add quick notes</span>
            </div>

            <div class="flex flex-wrap gap-1.5 mb-2.5">
              @for (chip of quickChips; track chip) {
                <button 
                  type="button" 
                  (click)="addQuickRemark(chip)" 
                  class="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-full font-semibold transition"
                >
                  + {{ chip }}
                </button>
              }
            </div>

            <textarea 
              [(ngModel)]="remarks" 
              name="remarks" 
              rows="3" 
              class="form-control text-xs font-medium" 
              placeholder="Enter key discussion notes, budget, or required follow-ups..."
            ></textarea>
          </div>

          @if (savedMessage()) {
            <div class="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-semibold flex items-center gap-2">
              <span class="material-icons text-sm text-emerald-600">check_circle</span>
              {{ savedMessage() }}
            </div>
          }

          <div class="flex items-center justify-between border-t pt-4">
            <button type="button" (click)="resetForm()" class="btn btn-outline-pill text-xs">
              <span class="material-icons text-sm">refresh</span> Reset Form
            </button>

            <button type="submit" class="btn btn-primary px-8 py-2.5 rounded-lg text-xs font-bold shadow-md">
              <span class="material-icons text-sm">save</span>
              {{ isEditMode() ? 'Update Lead Record' : 'Save Lead to ' + (stallService.activeStall()?.code || 'Active Stall') }}
            </button>
          </div>
        </form>
      </div>
    </div>
  `
})
export class LeadFormComponent implements OnInit {
  private db = inject(ApplicationDatabase);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  stallService = inject(StallService);

  editingLeadId: string | null = null;
  existingCreatedAt: string | null = null;
  isEditMode = signal(false);

  name = '';
  company = '';
  phone = '';
  email = '';
  designation = '';
  website = '';
  address = '';
  interestLevel: 'Hot' | 'Warm' | 'Cold' = 'Warm';
  remarks = '';
  voiceBlob: Blob | null = null;

  captureMethod: CaptureMethod = 'manual';
  isAutoFilled = signal(false);
  savedMessage = signal<string | null>(null);

  quickChips = [
    'Need Urgent Quotation',
    'Schedule Demo Session',
    'High Budget Opportunity',
    'Send Product Catalog PDF',
    'Decision Maker'
  ];

  async ngOnInit(): Promise<void> {
    const idParam = this.route.snapshot.paramMap.get('id') || this.route.snapshot.queryParamMap.get('id');
    if (idParam) {
      this.editingLeadId = idParam;
      this.isEditMode.set(true);
      await this.loadLeadForEdit(idParam);
    }
  }

  async loadLeadForEdit(id: string): Promise<void> {
    const lead = await this.db.getLeadById(id);
    if (lead) {
      this.name = lead.name;
      this.company = lead.company || '';
      this.phone = lead.phone;
      this.email = lead.email || '';
      this.designation = lead.designation || '';
      this.website = lead.website || '';
      this.address = lead.address || '';
      this.interestLevel = lead.interestLevel;
      this.remarks = lead.remarks || '';
      this.captureMethod = lead.captureMethod || 'manual';
      this.existingCreatedAt = lead.createdAt;
    } else {
      alert('Selected lead record not found.');
      this.router.navigate(['/leads']);
    }
  }

  onCardExtracted(data: ExtractedCardData): void {
    if (data.name) this.name = data.name;
    if (data.company) this.company = data.company;
    if (data.phone) this.phone = data.phone;
    if (data.email) this.email = data.email;
    if (data.designation) this.designation = data.designation;
    if (data.website) this.website = data.website;
    if (data.address) this.address = data.address;
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
    this.interestLevel = 'Warm';
    this.captureMethod = 'manual';
    this.isAutoFilled.set(false);
  }

  async saveLead(): Promise<void> {
    if (!this.name || !this.phone) {
      alert('Full Name and Mobile Phone are required.');
      return;
    }

    const activeStallId = this.stallService.activeStall()?.id || '33333333-3333-3333-3333-333333333333';

    const leadToSave: LocalLead = {
      id: this.editingLeadId || crypto.randomUUID(),
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
      interestLevel: this.interestLevel,
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
    this.savedMessage.set(`Lead ${actionText} successfully! Redirecting to Leads list...`);

    setTimeout(() => {
      this.router.navigate(['/leads']);
    }, 1000);
  }
}
