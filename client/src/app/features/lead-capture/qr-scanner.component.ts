import { Component, EventEmitter, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface QrParsedContact {
  name?: string;
  company?: string;
  phone?: string;
  email?: string;
}

@Component({
  selector: 'app-qr-scanner',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="qr-scanner p-4 border rounded-lg bg-white shadow-sm">
      <h3 class="text-lg font-semibold mb-2">QR Code & vCard Scanner</h3>
      
      @if (isScanning()) {
        <div class="p-3 bg-indigo-50 text-indigo-700 rounded mb-2">
          📷 Camera active. Align visitor QR code...
        </div>
      }

      <div class="flex gap-2">
        <button 
          (click)="toggleScan()" 
          class="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 font-medium text-sm"
        >
          {{ isScanning() ? 'Stop Camera' : 'Start Camera Scanner' }}
        </button>

        <button 
          (click)="simulateScan()" 
          class="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 font-medium text-sm"
        >
          Simulate vCard Scan
        </button>
      </div>
    </div>
  `
})
export class QrScannerComponent {
  @Output() qrScanned = new EventEmitter<QrParsedContact>();

  isScanning = signal(false);

  toggleScan(): void {
    this.isScanning.update((val) => !val);
  }

  simulateScan(): void {
    const mockVcard = {
      name: 'Sarah Connor',
      company: 'Cyberdyne Systems',
      phone: '+1 555-0144',
      email: 's.connor@cyberdyne.io',
    };
    this.qrScanned.emit(mockVcard);
  }
}
