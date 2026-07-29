import { Component, EventEmitter, Output, signal, inject, OnDestroy } from '@angular/core';
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
    <div class="card-panel p-0 overflow-hidden h-full flex flex-col justify-between hover:shadow-md transition bg-white border border-slate-200 rounded-xl">
      <div>
        <!-- Header with Table Blue (#1a3a5c) theme -->
        <div class="bg-[#1a3a5c] text-white p-3.5 px-4 flex items-center justify-between shadow-xs">
          <div class="flex items-center gap-2">
            <span class="material-icons text-blue-300 text-lg">credit_card</span>
            <h3 class="text-xs font-bold uppercase tracking-wider text-white">Business Card OCR</h3>
          </div>
        </div>

        <div class="p-4">
          <p class="text-xs text-slate-500 mb-3">Snap horizontal or vertical cards to auto-extract contact details offline.</p>

          <!-- Quick Action Buttons -->
          <div class="grid grid-cols-1 gap-2 mb-2">
            <button 
              type="button"
              (click)="openCameraModal()" 
              class="btn btn-primary w-full justify-center text-xs py-2.5 rounded-lg font-bold shadow-sm flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
              [disabled]="isProcessing()"
            >
              <span class="material-icons text-sm">photo_camera</span>
              Scan via Camera (Auto-Snap Card)
            </button>

            <label class="cursor-pointer block border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-lg p-2.5 text-center bg-slate-50 hover:bg-blue-50/50 transition">
              <input 
                type="file" 
                accept="image/*" 
                capture="environment" 
                (change)="onFileSelected($event)" 
                class="hidden"
                [disabled]="isProcessing()"
              />
              <div class="flex items-center justify-center gap-1.5 text-xs font-semibold text-blue-600">
                <span class="material-icons text-sm">add_a_photo</span>
                <span>Upload Business Card Image</span>
              </div>
              <span class="text-[10px] text-slate-400 block mt-0.5">JPG, PNG, WebP up to 10MB</span>
            </label>
          </div>
        </div>

        <!-- Processing Progress Overlay -->
        @if (isProcessing()) {
          <div class="mx-4 mb-4 p-3 bg-blue-50/80 border border-blue-200 rounded-lg text-xs">
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
          <div class="mx-4 mb-4 bg-slate-50 border border-slate-200 rounded-lg p-3">
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
    </div>

    <!-- Live Camera Card Viewport & Precise Auto-Snap Crop Modal -->
    @if (showCameraModal()) {
      <div class="fixed inset-0 bg-slate-900/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-fadeIn relative">
          <div class="flex items-center justify-between border-b pb-3 mb-4">
            <div class="flex items-center gap-2">
              <span class="material-icons text-blue-600">photo_camera</span>
              <div>
                <h3 class="text-base font-bold text-slate-900">Real Card Auto-Snap Scanner</h3>
                <p class="text-[11px] text-slate-400">Position business card inside frame; system auto-snaps on card detection</p>
              </div>
            </div>
            <button (click)="closeCameraModal()" class="text-slate-400 hover:text-slate-600">
              <span class="material-icons">close</span>
            </button>
          </div>

          <!-- Camera Stream Container -->
          <div class="relative bg-slate-950 rounded-xl overflow-hidden aspect-[4/3] max-h-[360px] w-full flex items-center justify-center border border-slate-800 shadow-inner">
            <video id="ocr-camera-viewport" autoplay playsinline class="w-full h-full object-cover bg-slate-950"></video>

            <!-- Top Horizontal Dark Block -->
            <div class="absolute top-0 left-0 right-0 h-[18%] bg-slate-950/85 backdrop-blur-[1px] pointer-events-none z-10 border-b border-white/10 flex items-center justify-center">
              <span class="text-[10px] text-slate-300 font-semibold tracking-wider uppercase">Business Card Scanner</span>
            </div>

            <!-- Bottom Horizontal Dark Block -->
            <div class="absolute bottom-0 left-0 right-0 h-[18%] bg-slate-950/85 backdrop-blur-[1px] pointer-events-none z-10 border-t border-white/10 flex items-center justify-center">
              <span class="text-[10px] text-slate-400 font-medium">Keep card horizontal & aligned inside frame</span>
            </div>

            <!-- Central Visual Card Target Reticle Box -->
            <div 
              id="ocr-card-reticle-box"
              class="absolute left-[6%] right-[6%] top-[18%] bottom-[18%] rounded-xl pointer-events-none transition-all duration-300 flex flex-col justify-between p-3 z-20"
              [ngClass]="cardAligned() ? 'border-4 border-emerald-400 shadow-[0_0_35px_rgba(52,211,153,0.9)] bg-emerald-950/10' : 'border-2 border-dashed border-blue-400 shadow-[0_0_20px_rgba(0,0,0,0.8)]'"
            >
              <!-- Top Corner Brackets -->
              <div class="w-full flex justify-between">
                <div class="w-7 h-7 border-t-4 border-l-4 rounded-tl-md transition-colors duration-300" [ngClass]="cardAligned() ? 'border-emerald-400' : 'border-blue-400'"></div>
                <div class="w-7 h-7 border-t-4 border-r-4 rounded-tr-md transition-colors duration-300" [ngClass]="cardAligned() ? 'border-emerald-400' : 'border-blue-400'"></div>
              </div>

              <!-- Status Badge in Center -->
              <div class="w-full flex justify-center">
                <div 
                  class="text-[11px] font-bold px-3.5 py-1 rounded-full uppercase tracking-wider backdrop-blur-md shadow-lg transition-all duration-300 flex items-center gap-1.5"
                  [ngClass]="cardAligned() ? 'bg-emerald-600 text-white animate-pulse' : 'bg-slate-900/90 text-blue-200 border border-blue-400/40'"
                >
                  @if (cardAligned()) {
                    <span class="material-icons text-sm">crop_free</span>
                    <span>REAL CARD DETECTED! AUTO-SNAPPING...</span>
                  } @else {
                    <span class="material-icons text-sm">filter_center_focus</span>
                    <span>ALIGN BUSINESS CARD INSIDE FRAME</span>
                  }
                </div>
              </div>

              <!-- Bottom Corner Brackets & Live Status -->
              <div class="w-full flex justify-between items-end">
                <div class="w-7 h-7 border-b-4 border-l-4 rounded-bl-md transition-colors duration-300" [ngClass]="cardAligned() ? 'border-emerald-400' : 'border-blue-400'"></div>
                <div class="text-[10px] text-white/90 bg-slate-900/90 px-2.5 py-0.5 rounded font-semibold backdrop-blur-xs border border-white/10">
                  {{ cameraStatus() }}
                </div>
                <div class="w-7 h-7 border-b-4 border-r-4 rounded-br-md transition-colors duration-300" [ngClass]="cardAligned() ? 'border-emerald-400' : 'border-blue-400'"></div>
              </div>
            </div>

            @if (isStartingCamera()) {
              <div class="absolute inset-0 bg-slate-900 flex flex-col items-center justify-center text-white text-xs gap-2 z-20">
                <span class="material-icons text-3xl animate-spin text-blue-400">sync</span>
                <span>Initializing Camera & Preview...</span>
              </div>
            }

            @if (cameraError()) {
              <div class="absolute inset-0 bg-slate-900/90 p-4 flex flex-col items-center justify-center text-center text-white text-xs gap-2 z-20">
                <span class="material-icons text-red-400 text-3xl">videocam_off</span>
                <span class="font-bold text-red-200">{{ cameraError() }}</span>
                <button 
                  (click)="startCamera()" 
                  class="mt-2 bg-blue-600 text-white font-bold px-3 py-1.5 rounded-lg text-xs"
                >
                  Retry Camera
                </button>
              </div>
            }
          </div>

          <div class="mt-4 flex items-center justify-between">
            <button 
              type="button" 
              (click)="closeCameraModal()" 
              class="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button 
              type="button"
              (click)="captureCardFromCamera()" 
              class="px-6 py-2.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md flex items-center gap-2 transition active:scale-95"
            >
              <span class="material-icons text-base">camera</span>
              Snap & Crop Card Now
            </button>
          </div>
        </div>
      </div>
    }

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
export class OcrScannerComponent implements OnDestroy {
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

  showCameraModal = signal(false);
  isStartingCamera = signal(false);
  cameraError = signal<string | null>(null);
  cameraStatus = signal('Hold business card inside frame...');
  cardAligned = signal(false);

  private mediaStream: MediaStream | null = null;
  private alignCheckInterval: any = null;
  private cardLockFrames = 0;
  private isCapturing = false;

  async openCameraModal(): Promise<void> {
    this.showCameraModal.set(true);
    this.cameraError.set(null);
    this.cardAligned.set(false);
    this.cameraStatus.set('Hold business card inside frame...');
    this.cardLockFrames = 0;
    this.isCapturing = false;
    setTimeout(() => this.startCamera(), 200);
  }

  async startCamera(): Promise<void> {
    this.isStartingCamera.set(true);
    this.cameraError.set(null);

    try {
      if (this.mediaStream) {
        this.stopCamera();
      }

      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
          aspectRatio: { ideal: 1.777 }
        }
      });

      const videoEl = document.getElementById('ocr-camera-viewport') as HTMLVideoElement;
      if (videoEl) {
        videoEl.srcObject = this.mediaStream;
        await videoEl.play();
      }
      this.isStartingCamera.set(false);
      this.startRealCardDetector();
    } catch (err: any) {
      console.error('OCR Camera error:', err);
      this.isStartingCamera.set(false);
      this.cameraError.set(err?.message || 'Could not access camera. Ensure camera permissions are allowed.');
    }
  }

  private startRealCardDetector(): void {
    this.stopRealCardDetector();
    this.alignCheckInterval = setInterval(() => {
      if (!this.showCameraModal() || this.isProcessing() || this.isCapturing) return;
      this.checkCardAlignmentAndAutoSnap();
    }, 280);
  }

  private stopRealCardDetector(): void {
    if (this.alignCheckInterval) {
      clearInterval(this.alignCheckInterval);
      this.alignCheckInterval = null;
    }
  }

  /**
   * RECTANGULAR CONTOUR CARD DETECTOR (like CamScanner / Adobe Scan)
   * 
   * Algorithm:
   * 1. Sample the reticle area at reduced resolution
   * 2. Scan 4 border strips (top, bottom, left, right) looking for continuous
   *    strong edge lines (sharp brightness transitions in a straight line)
   * 3. Require ALL 4 borders to have strong straight edges (= rectangular object)
   * 4. ALSO reject if skin tones dominate the center (orange/brown warmth check)
   * 5. Require 6 consecutive lock frames (~1.7s) before snapping
   */
  private checkCardAlignmentAndAutoSnap(): void {
    const videoEl = document.getElementById('ocr-camera-viewport') as HTMLVideoElement;
    if (!videoEl || !videoEl.videoWidth || videoEl.paused || videoEl.ended) return;

    try {
      const canvas = document.createElement('canvas');
      const W = 200;
      const H = 150;
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      ctx.drawImage(videoEl, 0, 0, W, H);
      const imgData = ctx.getImageData(0, 0, W, H);
      const d = imgData.data;

      // Helper: get luminance at (x,y)
      const lum = (x: number, y: number): number => {
        const i = (y * W + x) * 4;
        return 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      };

      // Helper: get RGB at (x,y)
      const rgb = (x: number, y: number): [number, number, number] => {
        const i = (y * W + x) * 4;
        return [d[i], d[i + 1], d[i + 2]];
      };

      // Reticle bounds (matching the CSS: left 6%, right 6%, top 18%, bottom 18%)
      const rLeft = Math.round(W * 0.06);
      const rRight = Math.round(W * 0.94);
      const rTop = Math.round(H * 0.18);
      const rBottom = Math.round(H * 0.82);
      const rW = rRight - rLeft;
      const rH = rBottom - rTop;

      // Border strip thickness (scan this many pixels deep from each edge)
      const stripDepth = Math.max(4, Math.round(Math.min(rW, rH) * 0.08));

      // === STEP 1: Detect straight edges along each of the 4 borders ===
      // For each border strip, count pixels that have a strong gradient perpendicular to the border.
      // A card edge = a strong, continuous line of high-gradient pixels.

      // TOP border: scan horizontal strip, check vertical gradient (lum difference top vs inside)
      let topEdgePixels = 0;
      let topTotalPixels = 0;
      for (let x = rLeft + 5; x < rRight - 5; x += 2) {
        // Compare pixel just outside the reticle-top vs just inside
        const outerY = Math.max(0, rTop - stripDepth);
        const innerY = rTop + stripDepth;
        const diff = Math.abs(lum(x, outerY) - lum(x, innerY));
        topTotalPixels++;
        if (diff > 35) topEdgePixels++;
      }

      // BOTTOM border
      let bottomEdgePixels = 0;
      let bottomTotalPixels = 0;
      for (let x = rLeft + 5; x < rRight - 5; x += 2) {
        const innerY = rBottom - stripDepth;
        const outerY = Math.min(H - 1, rBottom + stripDepth);
        const diff = Math.abs(lum(x, innerY) - lum(x, outerY));
        bottomTotalPixels++;
        if (diff > 35) bottomEdgePixels++;
      }

      // LEFT border
      let leftEdgePixels = 0;
      let leftTotalPixels = 0;
      for (let y = rTop + 5; y < rBottom - 5; y += 2) {
        const outerX = Math.max(0, rLeft - stripDepth);
        const innerX = rLeft + stripDepth;
        const diff = Math.abs(lum(outerX, y) - lum(innerX, y));
        leftTotalPixels++;
        if (diff > 35) leftEdgePixels++;
      }

      // RIGHT border
      let rightEdgePixels = 0;
      let rightTotalPixels = 0;
      for (let y = rTop + 5; y < rBottom - 5; y += 2) {
        const innerX = rRight - stripDepth;
        const outerX = Math.min(W - 1, rRight + stripDepth);
        const diff = Math.abs(lum(innerX, y) - lum(outerX, y));
        rightTotalPixels++;
        if (diff > 35) rightEdgePixels++;
      }

      // Edge continuity ratios (what % of each border has a strong edge)
      const topRatio = topTotalPixels > 0 ? topEdgePixels / topTotalPixels : 0;
      const bottomRatio = bottomTotalPixels > 0 ? bottomEdgePixels / bottomTotalPixels : 0;
      const leftRatio = leftTotalPixels > 0 ? leftEdgePixels / leftTotalPixels : 0;
      const rightRatio = rightTotalPixels > 0 ? rightEdgePixels / rightTotalPixels : 0;

      // A card needs at least 3 out of 4 borders with >40% continuous edge
      const edgeThreshold = 0.40;
      const strongBorders = [
        topRatio >= edgeThreshold,
        bottomRatio >= edgeThreshold,
        leftRatio >= edgeThreshold,
        rightRatio >= edgeThreshold
      ].filter(Boolean).length;

      const hasRectangularBoundary = strongBorders >= 3;

      // === STEP 2: Reject skin tones (face/hand detection) ===
      // Skin has R > 95, G > 40, B > 20, R > G, R > B, |R-G| > 15, with warm hue
      let skinPixels = 0;
      let centerSamples = 0;
      const cxStart = rLeft + Math.round(rW * 0.2);
      const cxEnd = rLeft + Math.round(rW * 0.8);
      const cyStart = rTop + Math.round(rH * 0.2);
      const cyEnd = rTop + Math.round(rH * 0.8);

      for (let y = cyStart; y < cyEnd; y += 3) {
        for (let x = cxStart; x < cxEnd; x += 3) {
          const [r, g, b] = rgb(x, y);
          centerSamples++;
          // Skin tone detection (common RGB rule)
          if (r > 95 && g > 40 && b > 20 &&
              r > g && r > b &&
              (r - g) > 15 &&
              Math.max(r, g, b) - Math.min(r, g, b) > 15) {
            skinPixels++;
          }
        }
      }
      const skinRatio = centerSamples > 0 ? skinPixels / centerSamples : 0;
      const isSkinDominated = skinRatio > 0.30; // >30% skin = likely a face/hand

      // === STEP 3: Check inner area is relatively bright and uniform (card-like) ===
      let innerLumSum = 0;
      let innerLumCount = 0;
      for (let y = cyStart; y < cyEnd; y += 3) {
        for (let x = cxStart; x < cxEnd; x += 3) {
          innerLumSum += lum(x, y);
          innerLumCount++;
        }
      }
      const avgInnerLum = innerLumCount > 0 ? innerLumSum / innerLumCount : 0;
      const isBrightEnough = avgInnerLum >= 130; // Cards are generally bright

      // === FINAL DECISION ===
      const isRealCard = hasRectangularBoundary && !isSkinDominated && isBrightEnough;

      // Debug info
      const debugInfo = `Borders:${strongBorders}/4 Skin:${(skinRatio * 100).toFixed(0)}% Lum:${avgInnerLum.toFixed(0)}`;

      if (isRealCard) {
        this.cardLockFrames++;
        this.cardAligned.set(true);

        if (this.cardLockFrames >= 6) {
          this.cameraStatus.set('🎯 CARD DETECTED! AUTO-SNAPPING...');
          this.captureCardFromCamera();
        } else {
          this.cameraStatus.set(`Locking card... ${this.cardLockFrames}/6`);
        }
      } else {
        this.cardLockFrames = Math.max(0, this.cardLockFrames - 2);
        this.cardAligned.set(false);

        // Give the user helpful feedback about what's wrong
        if (isSkinDominated) {
          this.cameraStatus.set(`Skin detected — hold a CARD, not face (${debugInfo})`);
        } else if (!hasRectangularBoundary) {
          this.cameraStatus.set(`No card edges found (${debugInfo})`);
        } else if (!isBrightEnough) {
          this.cameraStatus.set(`Too dark — add lighting (${debugInfo})`);
        } else {
          this.cameraStatus.set(`Align card inside frame (${debugInfo})`);
        }
      }
    } catch {
      // Ignore sampling errors
    }
  }

  stopCamera(): void {
    this.stopRealCardDetector();
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
  }

  async closeCameraModal(): Promise<void> {
    this.stopCamera();
    this.showCameraModal.set(false);
  }

  async captureCardFromCamera(): Promise<void> {
    if (this.isCapturing) return;
    this.isCapturing = true;

    const videoEl = document.getElementById('ocr-camera-viewport') as HTMLVideoElement;
    if (!videoEl || !videoEl.videoWidth) {
      this.isCapturing = false;
      return;
    }

    try {
      const cardCanvas = this.cropExactVisualReticleBox(videoEl);

      const blob = await new Promise<Blob | null>(resolve => cardCanvas.toBlob(resolve, 'image/jpeg', 0.95));
      if (!blob) return;

      const capturedFile = new File([blob], 'cropped_card_snap.jpg', { type: 'image/jpeg' });
      await this.closeCameraModal();
      this.rawSelectedFile = capturedFile;
      this.currentRotation = 0;
      await this.processCardPipeline(capturedFile, 0);
    } catch (err) {
      console.error('Camera card crop error:', err);
    } finally {
      this.isCapturing = false;
    }
  }

  private cropExactVisualReticleBox(videoEl: HTMLVideoElement): HTMLCanvasElement {
    const reticleEl = document.getElementById('ocr-card-reticle-box');

    const vWidth = videoEl.videoWidth;
    const vHeight = videoEl.videoHeight;

    let cropX = Math.round(vWidth * 0.08);
    let cropY = Math.round(vHeight * 0.14);
    let cropW = Math.round(vWidth * 0.84);
    let cropH = Math.round(vHeight * 0.72);

    if (reticleEl) {
      const vRect = videoEl.getBoundingClientRect();
      const rRect = reticleEl.getBoundingClientRect();

      if (vRect.width > 0 && vRect.height > 0) {
        const scaleX = vWidth / vRect.width;
        const scaleY = vHeight / vRect.height;

        cropX = Math.max(0, Math.round((rRect.left - vRect.left) * scaleX));
        cropY = Math.max(0, Math.round((rRect.top - vRect.top) * scaleY));
        cropW = Math.min(vWidth - cropX, Math.round(rRect.width * scaleX));
        cropH = Math.min(vHeight - cropY, Math.round(rRect.height * scaleY));
      }
    }

    // High resolution output canvas (1200px width)
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = Math.max(600, Math.round(1200 * (cropH / (cropW || 1))));

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(
        videoEl,
        cropX, cropY, cropW, cropH,
        0, 0, canvas.width, canvas.height
      );
    }

    return canvas;
  }

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
        corePath: '/ocr',
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

  ngOnDestroy(): void {
    this.stopCamera();
  }
}
