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
    <div class="card-panel h-full flex flex-col justify-between hover:shadow-md transition">
      <div>
        <div class="flex items-center gap-2 mb-2">
          <span class="material-icons text-indigo-600">qr_code_scanner</span>
          <h3 class="text-sm font-bold text-gray-800">QR Code / vCard</h3>
        </div>
        <p class="text-xs text-gray-500 mb-3">Scan visitor badge or vCard QR code.</p>

        @if (isScanning()) {
          <div class="p-3 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-lg text-xs flex items-center justify-between mb-3 animate-pulse">
            <span class="flex items-center gap-1.5 font-medium">
              <span class="material-icons text-sm">videocam</span> Camera Active...
            </span>
            <button (click)="toggleScan()" class="text-[10px] bg-indigo-200 px-2 py-0.5 rounded font-bold">CANCEL</button>
          </div>
        }

        <div>
          <button 
            (click)="toggleScan()" 
            class="btn btn-primary w-full justify-center text-xs text-center py-2.5 rounded-lg font-bold shadow-sm"
          >
            <span class="material-icons text-sm">camera_alt</span>
            {{ isScanning() ? 'Stop Camera' : 'Scan QR' }}
          </button>
        </div>
      </div>

      @if (scannedSuccess()) {
        <div class="mt-3 text-xs bg-indigo-50 border border-indigo-200 text-indigo-800 p-2 rounded-md flex items-center gap-1.5 font-medium">
          <span class="material-icons text-sm text-indigo-600">verified</span>
          vCard QR Scanned!
        </div>
      }
    </div>
  `
})
export class QrScannerComponent {
  @Output() qrScanned = new EventEmitter<QrParsedContact>();

  isScanning = signal(false);
  scannedSuccess = signal(false);

  toggleScan(): void {
    this.isScanning.update((val) => !val);
  }

  simulateScan(): void {
    this.scannedSuccess.set(true);
    const mockVcard = {
      name: 'Sarah Connor',
      company: 'Cyberdyne Systems',
      phone: '+91 9876500112',
      email: 's.connor@cyberdyne.io',
    };
    this.qrScanned.emit(mockVcard);
    setTimeout(() => this.scannedSuccess.set(false), 3000);
  }
}
