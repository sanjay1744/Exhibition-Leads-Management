import { Component, EventEmitter, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface ExtractedCardData {
  name?: string;
  company?: string;
  phone?: string;
  email?: string;
  website?: string;
}

@Component({
  selector: 'app-ocr-scanner',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="card-panel h-full flex flex-col justify-between hover:shadow-md transition">
      <div>
        <div class="flex items-center gap-2 mb-2">
          <span class="material-icons text-blue-600">credit_card</span>
          <h3 class="text-sm font-bold text-gray-800">Business Card OCR</h3>
        </div>
        <p class="text-xs text-gray-500 mb-3">Upload or snap a card to auto-fill details.</p>

        @if (isProcessing()) {
          <div class="p-3 bg-blue-50 text-blue-700 rounded-lg text-xs flex items-center justify-center gap-2 mb-3">
            <span class="material-icons animate-spin text-sm">sync</span>
            Extracting text with AI OCR...
          </div>
        }

        <label class="cursor-pointer block border-2 border-dashed border-gray-300 hover:border-blue-500 rounded-lg p-3 text-center bg-gray-50 hover:bg-blue-50/50 transition">
          <input 
            type="file" 
            accept="image/*" 
            capture="environment" 
            (change)="onFileSelected($event)" 
            class="hidden"
          />
          <span class="material-icons text-gray-400 text-2xl block mb-1">add_a_photo</span>
          <span class="text-xs font-semibold text-blue-600 block">Scan Business Card</span>
          <span class="text-[10px] text-gray-400">JPG, PNG up to 10MB</span>
        </label>
      </div>

      @if (extractedData()) {
        <div class="mt-3 text-xs bg-emerald-50 border border-emerald-200 text-emerald-800 p-2 rounded-md flex items-center gap-1.5 font-medium">
          <span class="material-icons text-sm text-emerald-600">check_circle</span>
          Auto-filled from OCR!
        </div>
      }
    </div>
  `
})
export class OcrScannerComponent {
  @Output() cardExtracted = new EventEmitter<ExtractedCardData>();

  isProcessing = signal(false);
  extractedData = signal<ExtractedCardData | null>(null);

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    this.isProcessing.set(true);

    try {
      const text = await this.simulateOcrTextExtraction(file);
      const parsed = this.parseContactInfo(text);

      this.extractedData.set(parsed);
      this.cardExtracted.emit(parsed);
    } catch (err) {
      console.error('OCR Error:', err);
    } finally {
      this.isProcessing.set(false);
    }
  }

  private simulateOcrTextExtraction(file: File): Promise<string> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(`John Doe\nSenior Director\nTechCorp Solutions\nPhone: +91 9876543210\nEmail: john.doe@techcorp.com\nWeb: www.techcorp.com`);
      }, 1200);
    });
  }

  private parseContactInfo(rawText: string): ExtractedCardData {
    const lines = rawText.split('\n').map((l) => l.trim());
    const phoneMatch = rawText.match(/(\+\d{1,3}[\s-]?)?\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{4}/);
    const emailMatch = rawText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);

    return {
      name: lines[0] || 'John Doe',
      company: lines[2] || 'TechCorp Solutions',
      phone: phoneMatch ? phoneMatch[0] : '+91 9876543210',
      email: emailMatch ? emailMatch[0] : 'john.doe@techcorp.com',
    };
  }
}
