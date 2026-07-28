import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApplicationDatabase } from '../../core/services/db.service';
import { LocalLead } from '../../core/models/lead.model';
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
      <div class="page-title-bar">
        <div>
          <h1 class="page-title">Capture Exhibition Lead</h1>
          <p class="page-subtitle">Offline-first local storage (IndexedDB) with automatic CRM sync.</p>
        </div>
      </div>

      <!-- Quick Acquisition Hardware Tools (3 Equal Cards) -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <app-ocr-scanner (cardExtracted)="onCardExtracted($event)"></app-ocr-scanner>
        <app-qr-scanner (qrScanned)="onQrScanned($event)"></app-qr-scanner>
        <app-voice-recorder (voiceRecorded)="onVoiceRecorded($event)"></app-voice-recorder>
      </div>

      <!-- Visitor Information Form Card -->
      <div class="card-panel">
        <div class="flex items-center justify-between border-b pb-4 mb-6">
          <div class="flex items-center gap-2">
            <span class="material-icons text-blue-600">contact_page</span>
            <h2 class="text-base font-bold text-gray-800">Visitor Information & Requirements</h2>
          </div>
          @if (isAutoFilled()) {
            <span class="status-pill green">
              <span class="material-icons text-xs">auto_awesome</span> Auto-Filled from Scanner
            </span>
          }
        </div>

        <form (ngSubmit)="saveLead()">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
            <!-- Full Name -->
            <div>
              <label class="form-label">Full Name *</label>
              <div class="relative flex items-center">
                <span class="material-icons absolute left-3 text-gray-400 text-lg">person</span>
                <input 
                  [(ngModel)]="name" 
                  name="name" 
                  required 
                  class="form-control pl-10" 
                  placeholder="Visitor Name" 
                />
              </div>
            </div>

            <!-- Company Name -->
            <div>
              <label class="form-label">Company Name *</label>
              <div class="relative flex items-center">
                <span class="material-icons absolute left-3 text-gray-400 text-lg">business</span>
                <input 
                  [(ngModel)]="company" 
                  name="company" 
                  required 
                  class="form-control pl-10" 
                  placeholder="Company Name" 
                />
              </div>
            </div>

            <!-- Mobile Phone -->
            <div>
              <label class="form-label">Mobile Phone *</label>
              <div class="relative flex items-center">
                <span class="material-icons absolute left-3 text-gray-400 text-lg">call</span>
                <input 
                  [(ngModel)]="phone" 
                  name="phone" 
                  required 
                  class="form-control pl-10" 
                  placeholder="+91 9876543210" 
                />
              </div>
            </div>

            <!-- Email Address -->
            <div>
              <label class="form-label">Email Address</label>
              <div class="relative flex items-center">
                <span class="material-icons absolute left-3 text-gray-400 text-lg">mail</span>
                <input 
                  [(ngModel)]="email" 
                  name="email" 
                  class="form-control pl-10" 
                  placeholder="visitor@company.com" 
                />
              </div>
            </div>

            <!-- Designation -->
            <div>
              <label class="form-label">Designation / Role</label>
              <div class="relative flex items-center">
                <span class="material-icons absolute left-3 text-gray-400 text-lg">work</span>
                <input 
                  [(ngModel)]="designation" 
                  name="designation" 
                  class="form-control pl-10" 
                  placeholder="Purchase Manager / Director" 
                />
              </div>
            </div>

            <!-- Interest Level Buttons -->
            <div>
              <label class="form-label">Interest Priority</label>
              <div class="flex gap-2 pt-0.5">
                <button 
                  type="button" 
                  (click)="interestLevel = 'Hot'" 
                  class="flex-1 py-2 px-3 rounded-lg text-xs font-semibold border transition flex items-center justify-center gap-1"
                  [ngClass]="interestLevel === 'Hot' ? 'bg-red-50 border-red-500 text-red-700 shadow-sm' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'"
                >
                  🔥 Hot
                </button>

                <button 
                  type="button" 
                  (click)="interestLevel = 'Warm'" 
                  class="flex-1 py-2 px-3 rounded-lg text-xs font-semibold border transition flex items-center justify-center gap-1"
                  [ngClass]="interestLevel === 'Warm' ? 'bg-amber-50 border-amber-500 text-amber-700 shadow-sm' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'"
                >
                  ⚡ Warm
                </button>

                <button 
                  type="button" 
                  (click)="interestLevel = 'Cold'" 
                  class="flex-1 py-2 px-3 rounded-lg text-xs font-semibold border transition flex items-center justify-center gap-1"
                  [ngClass]="interestLevel === 'Cold' ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-sm' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'"
                >
                  ❄️ Cold
                </button>
              </div>
            </div>
          </div>

          <!-- Discussion Remarks & Quick Tags -->
          <div class="mb-5">
            <div class="flex justify-between items-center mb-1.5">
              <label class="form-label mb-0">Discussion Remarks & Requirements</label>
              <span class="text-[11px] text-gray-400">Click chips below to add quick notes</span>
            </div>

            <!-- Quick Template Chips -->
            <div class="flex flex-wrap gap-1.5 mb-2.5">
              @for (chip of quickChips; track chip) {
                <button 
                  type="button" 
                  (click)="addQuickRemark(chip)" 
                  class="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-full font-medium transition"
                >
                  + {{ chip }}
                </button>
              }
            </div>

            <textarea 
              [(ngModel)]="remarks" 
              name="remarks" 
              rows="3" 
              class="form-control" 
              placeholder="Enter key discussion notes, budget, or required follow-ups..."
            ></textarea>
          </div>

          <!-- Saved Feedback Banner -->
          @if (savedMessage()) {
            <div class="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-semibold flex items-center gap-2">
              <span class="material-icons text-sm text-emerald-600">check_circle</span>
              {{ savedMessage() }}
            </div>
          }

          <!-- Form Action Bar -->
          <div class="flex items-center justify-between border-top pt-4">
            <button type="button" (click)="resetForm()" class="btn btn-outline-pill text-xs">
              <span class="material-icons text-sm">refresh</span> Reset Form
            </button>

            <button type="submit" class="btn btn-primary px-6 py-2.5 rounded-lg text-sm shadow-sm">
              <span class="material-icons text-sm">save</span>
              Save Lead (Offline IndexedDB)
            </button>
          </div>
        </form>
      </div>
    </div>
  `
})
export class LeadFormComponent {
  private db = inject(ApplicationDatabase);

  name = '';
  company = '';
  phone = '';
  email = '';
  designation = '';
  interestLevel: 'Hot' | 'Warm' | 'Cold' = 'Warm';
  remarks = '';
  voiceBlob: Blob | null = null;

  isAutoFilled = signal(false);
  savedMessage = signal<string | null>(null);

  quickChips = [
    'Need Urgent Quotation',
    'Schedule Demo Session',
    'High Budget Opportunity',
    'Send Product Catalog PDF',
    'Decision Maker'
  ];

  onCardExtracted(data: ExtractedCardData): void {
    if (data.name) this.name = data.name;
    if (data.company) this.company = data.company;
    if (data.phone) this.phone = data.phone;
    if (data.email) this.email = data.email;
    this.isAutoFilled.set(true);
  }

  onQrScanned(data: QrParsedContact): void {
    if (data.name) this.name = data.name;
    if (data.company) this.company = data.company;
    if (data.phone) this.phone = data.phone;
    if (data.email) this.email = data.email;
    this.isAutoFilled.set(true);
  }

  onVoiceRecorded(blob: Blob): void {
    this.voiceBlob = blob;
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
    this.remarks = '';
    this.interestLevel = 'Warm';
    this.isAutoFilled.set(false);
  }

  async saveLead(): Promise<void> {
    if (!this.name || !this.company || !this.phone) {
      alert('Name, Company, and Mobile Phone are required.');
      return;
    }

    const newLead: LocalLead = {
      id: crypto.randomUUID(),
      exhibitionId: 'EXPO_2026_DEFAULT',
      repId: 'REP_001',
      name: this.name,
      company: this.company,
      phone: this.phone,
      email: this.email,
      designation: this.designation,
      captureMethod: 'manual',
      interestLevel: this.interestLevel,
      productCategory: ['Enterprise'],
      priority: 'High',
      remarks: this.remarks,
      status: 'New',
      syncStatus: 'Pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await this.db.saveLead(newLead);
    this.savedMessage.set('✓ Lead saved locally to Dexie IndexedDB! Status: Pending Sync.');

    this.resetForm();

    setTimeout(() => this.savedMessage.set(null), 3500);
  }
}
