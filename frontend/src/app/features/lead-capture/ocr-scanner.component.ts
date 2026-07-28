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
    <div class="ocr-card p-4 border rounded-lg shadow-sm bg-white">
      <h3 class="text-lg font-semibold mb-2">Business Card OCR Scanner</h3>
      
      @if (isProcessing()) {
        <div class="p-4 bg-blue-50 text-blue-700 rounded mb-3 flex items-center">
          <span class="animate-spin mr-2">⚙️</span> Extracting text from business card...
        </div>
      }

      <div class="mb-3">
        <input 
          type="file" 
          accept="image/*" 
          capture="environment" 
          (change)="onFileSelected($event)" 
          class="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
      </div>

      @if (extractedData()) {
        <div class="text-sm bg-green-50 p-3 rounded text-green-800">
          ✓ Text Extracted Successfully! Check fields below.
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
      // Simulate Tesseract.js Wasm OCR Processing on device
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
        resolve(`John Doe\nSenior Director\nTechCorp Solutions\nPhone: +1 555-0199\nEmail: john.doe@techcorp.com\nWeb: www.techcorp.com`);
      }, 1500);
    });
  }

  private parseContactInfo(rawText: string): ExtractedCardData {
    const lines = rawText.split('\n').map((l) => l.trim());
    const phoneMatch = rawText.match(/(\+\d{1,3}[\s-]?)?\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{4}/);
    const emailMatch = rawText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    const webMatch = rawText.match(/www\.[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);

    return {
      name: lines[0] || '',
      company: lines[2] || '',
      phone: phoneMatch ? phoneMatch[0] : '',
      email: emailMatch ? emailMatch[0] : '',
      website: webMatch ? webMatch[0] : '',
    };
  }
}
