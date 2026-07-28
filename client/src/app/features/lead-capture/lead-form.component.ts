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
    <div class="max-w-3xl mx-auto p-6 bg-slate-50 min-h-screen">
      <h1 class="text-2xl font-bold text-slate-800 mb-6">Capture Exhibition Lead (Offline-First)</h1>

      <!-- Acquisition Tabs -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <app-ocr-scanner (cardExtracted)="onCardExtracted($event)"></app-ocr-scanner>
        <app-qr-scanner (qrScanned)="onQrScanned($event)"></app-qr-scanner>
        <app-voice-recorder (voiceRecorded)="onVoiceRecorded($event)"></app-voice-recorder>
      </div>

      <!-- Lead Form -->
      <form (ngSubmit)="saveLead()" class="bg-white p-6 rounded-lg shadow-md border border-gray-200">
        <h2 class="text-lg font-semibold text-gray-700 mb-4">Visitor Lead Details</h2>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
            <input [(ngModel)]="name" name="name" required class="w-full border rounded p-2 text-sm" placeholder="Visitor Name" />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Company *</label>
            <input [(ngModel)]="company" name="company" required class="w-full border rounded p-2 text-sm" placeholder="Company Name" />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Mobile Number *</label>
            <input [(ngModel)]="phone" name="phone" required class="w-full border rounded p-2 text-sm" placeholder="+1 555-0199" />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
            <input [(ngModel)]="email" name="email" class="w-full border rounded p-2 text-sm" placeholder="email@domain.com" />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Designation</label>
            <input [(ngModel)]="designation" name="designation" class="w-full border rounded p-2 text-sm" placeholder="Director / Manager" />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Interest Level</label>
            <select [(ngModel)]="interestLevel" name="interestLevel" class="w-full border rounded p-2 text-sm">
              <option value="Hot">🔥 Hot</option>
              <option value="Warm">⚡ Warm</option>
              <option value="Cold">❄️ Cold</option>
            </select>
          </div>
        </div>

        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-1">Discussion Remarks</label>
          <textarea [(ngModel)]="remarks" name="remarks" rows="3" class="w-full border rounded p-2 text-sm" placeholder="Key discussion points..."></textarea>
        </div>

        @if (savedMessage()) {
          <div class="mb-4 p-3 bg-green-100 text-green-800 rounded text-sm">
            {{ savedMessage() }}
          </div>
        }

        <button type="submit" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded transition">
          💾 Save Lead to Offline Storage (IndexedDB)
        </button>
      </form>
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

  savedMessage = signal<string | null>(null);

  onCardExtracted(data: ExtractedCardData): void {
    if (data.name) this.name = data.name;
    if (data.company) this.company = data.company;
    if (data.phone) this.phone = data.phone;
    if (data.email) this.email = data.email;
  }

  onQrScanned(data: QrParsedContact): void {
    if (data.name) this.name = data.name;
    if (data.company) this.company = data.company;
    if (data.phone) this.phone = data.phone;
    if (data.email) this.email = data.email;
  }

  onVoiceRecorded(blob: Blob): void {
    this.voiceBlob = blob;
  }

  async saveLead(): Promise<void> {
    if (!this.name || !this.company || !this.phone) {
      alert('Name, Company, and Mobile Number are required.');
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

    // Reset Form
    this.name = '';
    this.company = '';
    this.phone = '';
    this.email = '';
    this.remarks = '';

    setTimeout(() => this.savedMessage.set(null), 3000);
  }
}
