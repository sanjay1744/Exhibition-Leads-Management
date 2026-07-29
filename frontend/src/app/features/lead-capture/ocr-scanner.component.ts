import { Component, EventEmitter, Output, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { createWorker, Worker } from 'tesseract.js';
import { OcrPreprocessorService } from '../../core/services/ocr-preprocessor.service';
import { CardParserService, ExtractedCardData } from '../../core/services/card-parser.service';

export { ExtractedCardData };

@Component({
  selector: 'app-ocr-scanner',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="card-panel h-full flex flex-col justify-between hover:shadow-md transition bg-white border border-slate-200 rounded-xl p-4">
      <div>
        <!-- Header -->
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-2">
            <span class="material-icons text-blue-600">credit_card</span>
            <h3 class="text-sm font-bold text-slate-800">Business Card OCR</h3>
          </div>
          <span class="text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full flex items-center gap-1">
            <span class="material-icons text-[12px]">wifi_off</span> Offline Wasm
          </span>
        </div>
        <p class="text-xs text-slate-500 mb-3">Snap horizontal or vertical cards to auto-extract contact details offline.</p>

        <!-- Image Upload Button -->
        <label class="cursor-pointer block border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-lg p-3 text-center bg-slate-50 hover:bg-blue-50/50 transition mb-2">
          <input 
            type="file" 
            accept="image/*" 
            capture="environment" 
            (change)="onFileSelected($event)" 
            class="hidden"
            [disabled]="isProcessing()"
          />
          <span class="material-icons text-slate-400 text-2xl block mb-1">add_a_photo</span>
          <span class="text-xs font-semibold text-blue-600 block">Scan Business Card</span>
          <span class="text-[10px] text-slate-400">JPG, PNG, WebP up to 10MB</span>
        </label>
      </div>

      <!-- Processing Progress Overlay -->
      @if (isProcessing()) {
        <div class="mt-3 p-3 bg-blue-50/80 border border-blue-200 rounded-lg text-xs">
          <div class="flex items-center justify-between text-blue-800 font-semibold mb-1">
            <span class="flex items-center gap-1.5">
              <span class="material-icons animate-spin text-sm">sync</span>
              {{ statusMessage() }}
            </span>
            <span>{{ progressPercent() }}%</span>
          </div>
          <div class="w-full bg-blue-200 rounded-full h-1.5 overflow-hidden">
            <div class="bg-blue-600 h-1.5 rounded-full transition-all duration-300" [style.width.%]="progressPercent()"></div>
          </div>
        </div>
      }

      <!-- Enhanced Image & Extracted Preview -->
      @if (extractedData() && !isProcessing()) {
        <div class="mt-3 bg-slate-50 border border-slate-200 rounded-lg p-3">
          <div class="flex items-center justify-between mb-2 pb-2 border-b border-slate-200">
            <span class="text-xs font-bold text-slate-800 flex items-center gap-1">
              <span class="material-icons text-sm text-emerald-600">check_circle</span>
              Extracted Card Info
            </span>
            <button 
              type="button"
              (click)="openEditModal()"
              class="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-0.5"
            >
              <span class="material-icons text-xs">edit</span> Review & Edit
            </button>
          </div>

          <div class="space-y-1 text-xs text-slate-700">
            @if (extractedData()?.name) {
              <div class="flex items-center gap-1 font-bold text-slate-900">
                <span class="material-icons text-slate-400 text-xs">person</span>
                {{ extractedData()?.name }}
              </div>
            }
            @if (extractedData()?.designation) {
              <div class="flex items-center gap-1 text-slate-600">
                <span class="material-icons text-slate-400 text-xs">badge</span>
                {{ extractedData()?.designation }}
              </div>
            }
            @if (extractedData()?.company) {
              <div class="flex items-center gap-1 text-slate-600">
                <span class="material-icons text-slate-400 text-xs">business</span>
                {{ extractedData()?.company }}
              </div>
            }
            @if (extractedData()?.phone) {
              <div class="flex items-center gap-1 text-slate-600">
                <span class="material-icons text-slate-400 text-xs">phone</span>
                {{ extractedData()?.phone }}
              </div>
            }
            @if (extractedData()?.email) {
              <div class="flex items-center gap-1 text-slate-600">
                <span class="material-icons text-slate-400 text-xs">email</span>
                {{ extractedData()?.email }}
              </div>
            }
            @if (extractedData()?.website) {
              <div class="flex items-center gap-1 text-slate-600">
                <span class="material-icons text-slate-400 text-xs">language</span>
                {{ extractedData()?.website }}
              </div>
            }
          </div>

          <button 
            type="button" 
            (click)="applyData()"
            class="w-full mt-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-1.5 px-3 rounded-md transition shadow-xs flex items-center justify-center gap-1"
          >
            <span class="material-icons text-xs">bolt</span> Auto-Fill Lead Form
          </button>
        </div>
      }
    </div>

    <!-- Review & Edit Modal -->
    @if (showModal()) {
      <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-fadeIn">
          <div class="flex items-center justify-between border-b pb-3 mb-4">
            <div class="flex items-center gap-2">
              <span class="material-icons text-blue-600">auto_fix_high</span>
              <h3 class="text-base font-bold text-slate-900">Review OCR Extracted Data</h3>
            </div>
            <button (click)="closeEditModal()" class="text-slate-400 hover:text-slate-600">
              <span class="material-icons">close</span>
            </button>
          </div>

          <!-- Card Image & Rotation Controls -->
          @if (previewDataUrl()) {
            <div class="mb-4 bg-slate-900 rounded-lg p-2 border border-slate-700 flex flex-col items-center justify-center relative group">
              <img [src]="previewDataUrl()" alt="Card Preview" class="max-h-48 object-contain rounded" />
              <div class="flex items-center gap-2 mt-2">
                <button 
                  type="button" 
                  (click)="rotateCard(-90)" 
                  class="bg-slate-800 hover:bg-slate-700 text-white text-xs px-2.5 py-1 rounded flex items-center gap-1"
                  title="Rotate Left"
                >
                  <span class="material-icons text-xs">rotate_left</span> Rotate 90° Left
                </button>
                <button 
                  type="button" 
                  (click)="rotateCard(90)" 
                  class="bg-slate-800 hover:bg-slate-700 text-white text-xs px-2.5 py-1 rounded flex items-center gap-1"
                  title="Rotate Right"
                >
                  <span class="material-icons text-xs">rotate_right</span> Rotate 90° Right
                </button>
                <button 
                  type="button" 
                  (click)="reScanCurrentOrientation()" 
                  class="bg-blue-600 hover:bg-blue-700 text-white text-xs px-2.5 py-1 rounded flex items-center gap-1 font-bold"
                >
                  <span class="material-icons text-xs">refresh</span> Re-Scan
                </button>
              </div>
            </div>
          }

          <div class="space-y-3 max-h-80 overflow-y-auto pr-1">
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">Full Name</label>
              <input type="text" [(ngModel)]="modalData.name" class="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="e.g. Maria Olivia" />
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">Designation / Title</label>
              <input type="text" [(ngModel)]="modalData.designation" class="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="e.g. Manager / Director" />
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">Company Name</label>
              <input type="text" [(ngModel)]="modalData.company" class="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="e.g. Aurora Tech Pvt Ltd" />
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">Phone / Mobile</label>
                <input type="text" [(ngModel)]="modalData.phone" class="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="+011 123 456 789" />
              </div>

              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
                <input type="email" [(ngModel)]="modalData.email" class="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="maria.olivia@aurora.com" />
              </div>
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">Website URL</label>
              <input type="text" [(ngModel)]="modalData.website" class="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="www.aurora.com" />
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">Address / Office Location</label>
              <input type="text" [(ngModel)]="modalData.address" class="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Office location or address" />
            </div>
          </div>

          <div class="mt-6 flex items-center justify-end gap-2 border-t pt-4">
            <button type="button" (click)="closeEditModal()" class="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
            <button type="button" (click)="saveAndApplyModal()" class="px-5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-md flex items-center gap-1">
              <span class="material-icons text-xs">check</span> Confirm & Apply
            </button>
          </div>
        </div>
      </div>
    }
  `
})
export class OcrScannerComponent {
  private preprocessor = inject(OcrPreprocessorService);
  private parser = inject(CardParserService);

  @Output() cardExtracted = new EventEmitter<ExtractedCardData>();

  isProcessing = signal(false);
  progressPercent = signal(0);
  statusMessage = signal('Preparing...');
  extractedData = signal<ExtractedCardData | null>(null);
  previewDataUrl = signal<string | null>(null);
  currentRotation = 0;
  rawSelectedFile: File | null = null;

  showModal = signal(false);
  modalData: ExtractedCardData = {};

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    this.rawSelectedFile = input.files[0];
    this.currentRotation = 0;
    await this.processCardPipeline(this.rawSelectedFile, 0);
  }

  private async processCardPipeline(file: File, rotationDegrees: number): Promise<void> {
    this.isProcessing.set(true);
    this.progressPercent.set(10);
    this.statusMessage.set('Enhancing Card Image...');

    try {
      // 1. Preprocess card image cleanly with high resolution scaling
      const processed = await this.preprocessor.preprocessImage(file, {
        mode: 'natural',
        minWidth: 1600,
        rotation: rotationDegrees
      });
      this.previewDataUrl.set(processed.dataUrl);

      this.progressPercent.set(30);
      this.statusMessage.set('Initializing Offline Tesseract Wasm...');

      // 2. Perform OCR with Auto-Rotation check if initial scan produces minimal results
      let bestRawText = await this.runTesseractOcr(processed.dataUrl);
      let parsedData = this.parser.parseCardText(bestRawText);

      // Auto-Rotation check: if portrait orientation (height > width) or 0 fields matched, try 90° rotation
      const matchedFieldCount = Object.values(parsedData).filter(v => typeof v === 'string' && v.trim().length > 0).length;
      
      if (matchedFieldCount <= 1 && processed.height > processed.width && rotationDegrees === 0) {
        this.statusMessage.set('Vertical card detected, auto-rotating 90°...');
        const rotatedUrl = await this.preprocessor.rotateDataUrl(processed.dataUrl, 90);
        const rotRawText = await this.runTesseractOcr(rotatedUrl);
        const rotParsed = this.parser.parseCardText(rotRawText);

        const rotMatchCount = Object.values(rotParsed).filter(v => typeof v === 'string' && v.trim().length > 0).length;
        if (rotMatchCount > matchedFieldCount) {
          bestRawText = rotRawText;
          parsedData = rotParsed;
          this.previewDataUrl.set(rotatedUrl);
          this.currentRotation = 90;
        }
      }

      this.progressPercent.set(100);
      this.extractedData.set(parsedData);
      this.cardExtracted.emit(parsedData);
    } catch (err) {
      console.error('OCR Processing Error:', err);
      alert('OCR failed to read card image. Try rotating the card or uploading a clearer picture.');
    } finally {
      this.isProcessing.set(false);
    }
  }

  async rotateCard(degreesDelta: number): Promise<void> {
    if (!this.previewDataUrl()) return;
    this.currentRotation = (this.currentRotation + degreesDelta + 360) % 360;
    const rotatedUrl = await this.preprocessor.rotateDataUrl(this.previewDataUrl()!, degreesDelta);
    this.previewDataUrl.set(rotatedUrl);
  }

  async reScanCurrentOrientation(): Promise<void> {
    if (!this.previewDataUrl()) return;
    this.isProcessing.set(true);
    this.progressPercent.set(30);
    this.statusMessage.set('Scanning Rotated Card...');

    try {
      const rawText = await this.runTesseractOcr(this.previewDataUrl()!);
      const parsedData = this.parser.parseCardText(rawText);
      this.extractedData.set(parsedData);
      this.modalData = { ...parsedData };
      this.cardExtracted.emit(parsedData);
    } catch (err) {
      console.error('Re-scan Error:', err);
    } finally {
      this.isProcessing.set(false);
    }
  }

  private async runTesseractOcr(imageDataUrl: string): Promise<string> {
    let worker: Worker | null = null;
    try {
      worker = await createWorker('eng', 1, {
        workerPath: '/ocr/worker.min.js',
        corePath: '/ocr/tesseract-core.wasm',
        logger: (m) => {
          if (m.status === 'recognizing text' && m.progress) {
            const pct = Math.round(30 + m.progress * 65);
            this.progressPercent.set(pct);
            this.statusMessage.set(`Recognizing Card Text (${Math.round(m.progress * 100)}%)...`);
          }
        }
      });

      const ret = await worker.recognize(imageDataUrl);
      return ret.data.text;
    } catch (err) {
      console.warn('Local Wasm worker error, executing standard worker fallback...', err);
      const fallbackWorker = await createWorker('eng');
      const ret = await fallbackWorker.recognize(imageDataUrl);
      await fallbackWorker.terminate();
      return ret.data.text;
    } finally {
      if (worker) {
        await worker.terminate();
      }
    }
  }

  applyData(): void {
    const data = this.extractedData();
    if (data) {
      this.cardExtracted.emit(data);
    }
  }

  openEditModal(): void {
    const current = this.extractedData() || {};
    this.modalData = { ...current };
    this.showModal.set(true);
  }

  closeEditModal(): void {
    this.showModal.set(false);
  }

  saveAndApplyModal(): void {
    this.extractedData.set({ ...this.modalData });
    this.cardExtracted.emit({ ...this.modalData });
    this.closeEditModal();
  }
}
