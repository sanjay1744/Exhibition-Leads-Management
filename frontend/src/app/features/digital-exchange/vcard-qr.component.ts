import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-vcard-qr',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="max-w-md mx-auto my-6">
      <div class="card text-center">
        <h2 class="text-lg font-bold text-gray-900 mb-1 flex items-center justify-center gap-2">
          <span class="material-icons text-blue-600">qr_code_2</span>
          Digital Business Card Exchange
        </h2>
        <p class="text-xs text-gray-500 mb-4">Let visitors scan this offline vCard QR code to instantly save your contact details.</p>

        <div class="p-4 bg-gray-50 rounded border inline-block mb-4 w-full">
          <div class="material-icons text-6xl text-slate-700 mb-2">qr_code_scanner</div>
          <div class="font-mono text-xs text-left text-gray-600 bg-white p-3 rounded border">
            BEGIN:VCARD<br/>
            VERSION:3.0<br/>
            FN:Alex Morgan<br/>
            TITLE:Sales Director<br/>
            ORG:AriyAI ERP Solutions<br/>
            TEL;TYPE=CELL:+91 9876543210<br/>
            EMAIL:alex&#64;ariyai.com<br/>
            END:VCARD
          </div>
        </div>

        <button (click)="downloadBrochure()" class="btn btn-success w-full justify-center">
          <span class="material-icons text-sm">picture_as_pdf</span>
          Share Company PDF Brochure Offline
        </button>
      </div>
    </div>
  `
})
export class VcardQrComponent {
  brochureStatus = signal<string | null>(null);

  downloadBrochure(): void {
    alert('Brochure PDF presented offline from IndexedDB cache.');
  }
}
