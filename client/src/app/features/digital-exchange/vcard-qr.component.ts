import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-vcard-qr',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md border text-center my-6">
      <h2 class="text-xl font-bold text-gray-800 mb-2">Digital Business Card Exchange</h2>
      <p class="text-sm text-gray-600 mb-4">Let visitors scan this offline vCard QR code to save your contact card.</p>

      <div class="p-6 bg-slate-100 rounded-lg inline-block mb-4 border">
        <div class="text-6xl mb-2">📱</div>
        <div class="font-mono text-xs text-gray-500 bg-white p-2 rounded border">
          BEGIN:VCARD<br/>
          FN:Alex Morgan<br/>
          ORG:AriyAI Technologies<br/>
          TEL:+1 555-0199<br/>
          END:VCARD
        </div>
      </div>

      <button (click)="downloadBrochure()" class="w-full bg-emerald-600 text-white font-semibold py-2 rounded hover:bg-emerald-700">
        📄 Share Company PDF Brochure Offline
      </button>
    </div>
  `
})
export class VcardQrComponent {
  brochureStatus = signal<string | null>(null);

  downloadBrochure(): void {
    alert('Brochure PDF presented offline from IndexedDB cache.');
  }
}
