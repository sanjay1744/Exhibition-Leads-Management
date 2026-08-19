import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-vcard-qr',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './vcard-qr.component.html',
  styleUrl: './vcard-qr.component.css'
})
export class VcardQrComponent {
  brochureStatus = signal<string | null>(null);

  downloadBrochure(): void {
    alert('Brochure PDF presented offline from IndexedDB cache.');
  }
}
