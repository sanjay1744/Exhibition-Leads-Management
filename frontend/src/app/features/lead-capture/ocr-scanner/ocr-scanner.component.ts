import { Component, EventEmitter, Output, signal, computed, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import type { Worker } from 'tesseract.js';
import { OcrPreprocessorService, CardCorners, Point2D } from '../../../core/services/ocr-preprocessor.service';
import { CardParserService, ExtractedCardData, PREDEFINED_DESIGNATIONS } from '../../../core/services/card-parser.service';
import { OcrService } from '../../../core/services/ocr.service';

export { ExtractedCardData };

@Component({
  selector: 'app-ocr-scanner',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ocr-scanner.component.html',
  styleUrl: './ocr-scanner.component.css'
})
export class OcrScannerComponent implements OnDestroy {
  private preprocessor = inject(OcrPreprocessorService);
  private parser = inject(CardParserService);
  private ocrService = inject(OcrService);

  readonly predefinedDesignations = PREDEFINED_DESIGNATIONS;

  @Output() cardExtracted = new EventEmitter<ExtractedCardData>();

  isProcessing = signal(false);
  progressPercent = signal(0);
  statusMessage = signal('Preparing...');
  extractedData = signal<ExtractedCardData | null>(null);
  previewDataUrl = signal<string | null>(null);
  rawSelectedFile: File | null = null;
  rawSourceDataUrl: string | null = null;

  showModal = signal(false);
  modalData: ExtractedCardData = {};

  reset(): void {
    this.extractedData.set(null);
    this.previewDataUrl.set(null);
    this.rawSelectedFile = null;
    this.rawSourceDataUrl = null;
    this.modalData = {};
  }

  showCameraModal = signal(false);
  isStartingCamera = signal(false);
  cameraError = signal<string | null>(null);
  cameraStatus = signal('Hold business card inside frame...');
  cardAligned = signal(false);

  showDocCropModal = signal(false);
  capturedDocSrc = signal<string | null>(null);
  activeDocFilter = signal<'vibrant' | 'original' | 'bw'>('vibrant');
  docCorners = signal<CardCorners>({
    topLeft: { x: 4, y: 4 },
    topRight: { x: 96, y: 4 },
    bottomRight: { x: 96, y: 96 },
    bottomLeft: { x: 4, y: 96 }
  });

  centerPoint = computed(() => {
    const c = this.docCorners();
    return {
      x: Math.round(((c.topLeft.x + c.topRight.x + c.bottomRight.x + c.bottomLeft.x) / 4) * 10) / 10,
      y: Math.round(((c.topLeft.y + c.topRight.y + c.bottomRight.y + c.bottomLeft.y) / 4) * 10) / 10
    };
  });

  isDraggingCorner = signal(false);
  dragLoupeData = signal<{ loupeLeft: number; loupeTop: number; bgPos: string; bgSize: string } | null>(null);

  private mediaStream: MediaStream | null = null;
  private alignCheckInterval: any = null;
  private cardLockFrames = 0;
  private isCapturing = false;

  quadSvgPoints = computed(() => {
    const c = this.docCorners();
    return `${c.topLeft.x},${c.topLeft.y} ${c.topRight.x},${c.topRight.y} ${c.bottomRight.x},${c.bottomRight.y} ${c.bottomLeft.x},${c.bottomLeft.y}`;
  });

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

      const lum = (x: number, y: number): number => {
        const i = (y * W + x) * 4;
        return 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      };

      const rLeft = Math.round(W * 0.06);
      const rRight = Math.round(W * 0.94);
      const rTop = Math.round(H * 0.18);
      const rBottom = Math.round(H * 0.82);
      const stripDepth = 4;

      let topEdges = 0, topTotal = 0;
      for (let x = rLeft + 5; x < rRight - 5; x += 2) {
        if (Math.abs(lum(x, rTop - stripDepth) - lum(x, rTop + stripDepth)) > 35) topEdges++;
        topTotal++;
      }

      let bottomEdges = 0, bottomTotal = 0;
      for (let x = rLeft + 5; x < rRight - 5; x += 2) {
        if (Math.abs(lum(x, rBottom - stripDepth) - lum(x, rBottom + stripDepth)) > 35) bottomEdges++;
        bottomTotal++;
      }

      let leftEdges = 0, leftTotal = 0;
      for (let y = rTop + 5; y < rBottom - 5; y += 2) {
        if (Math.abs(lum(rLeft - stripDepth, y) - lum(rLeft + stripDepth, y)) > 35) leftEdges++;
        leftTotal++;
      }

      let rightEdges = 0, rightTotal = 0;
      for (let y = rTop + 5; y < rBottom - 5; y += 2) {
        if (Math.abs(lum(rRight - stripDepth, y) - lum(rRight + stripDepth, y)) > 35) rightEdges++;
        rightTotal++;
      }

      const strongBorders = [
        topTotal > 0 && topEdges / topTotal >= 0.4,
        bottomTotal > 0 && bottomEdges / bottomTotal >= 0.4,
        leftTotal > 0 && leftEdges / leftTotal >= 0.4,
        rightTotal > 0 && rightEdges / rightTotal >= 0.4
      ].filter(Boolean).length;

      const isRealCard = strongBorders >= 3;

      if (isRealCard) {
        this.cardLockFrames++;
        this.cardAligned.set(true);
        if (this.cardLockFrames >= 5) {
          this.cameraStatus.set('CARD DETECTED! SNAPPING...');
          this.captureCardFromCamera();
        } else {
          this.cameraStatus.set(`Locking card... ${this.cardLockFrames}/5`);
        }
      } else {
        this.cardLockFrames = Math.max(0, this.cardLockFrames - 1);
        this.cardAligned.set(false);
        this.cameraStatus.set('Align business card inside frame');
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
      const canvas = document.createElement('canvas');
      canvas.width = videoEl.videoWidth;
      canvas.height = videoEl.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoEl, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
        await this.closeCameraModal();
        await this.openDocCropModal(dataUrl);
      }
    } catch (err) {
      console.error('Camera capture error:', err);
    } finally {
      this.isCapturing = false;
    }
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    this.rawSelectedFile = input.files[0];
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      await this.openDocCropModal(dataUrl);
    };
    reader.readAsDataURL(this.rawSelectedFile);
  }

  async openDocCropModal(sourceDataUrl: string): Promise<void> {
    this.capturedDocSrc.set(sourceDataUrl);
    this.showDocCropModal.set(true);
    this.resetQuadCorners();
  }

  retakeDocImage(): void {
    this.showDocCropModal.set(false);
    this.openCameraModal();
  }

  resetQuadCorners(): void {
    this.docCorners.set({
      topLeft: { x: 4, y: 4 },
      topRight: { x: 96, y: 4 },
      bottomRight: { x: 96, y: 96 },
      bottomLeft: { x: 4, y: 96 }
    });
  }

  async rotateCapturedDoc(degreesDelta: number): Promise<void> {
    const src = this.capturedDocSrc();
    if (!src) return;
    const rotatedUrl = await this.preprocessor.rotateDataUrl(src, degreesDelta);
    this.capturedDocSrc.set(rotatedUrl);
    this.resetQuadCorners();
  }

  startAreaSelection(event: MouseEvent | TouchEvent, imageWrapperEl: HTMLElement): void {
    if ('button' in event && event.button !== 0) return;

    const target = event.target as HTMLElement;
    if (target && target.closest('.interactive-handle')) {
      return;
    }

    event.preventDefault();

    const rect = imageWrapperEl.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const startClientX = 'touches' in event && event.touches.length > 0 ? event.touches[0].clientX : (event as MouseEvent).clientX;
    const startClientY = 'touches' in event && event.touches.length > 0 ? event.touches[0].clientY : (event as MouseEvent).clientY;

    const startPctX = Math.max(0, Math.min(100, ((startClientX - rect.left) / rect.width) * 100));
    const startPctY = Math.max(0, Math.min(100, ((startClientY - rect.top) / rect.height) * 100));

    let hasMoved = false;

    const updateSelection = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e && e.touches.length > 0 ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = 'touches' in e && e.touches.length > 0 ? e.touches[0].clientY : (e as MouseEvent).clientY;

      const curPctX = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
      const curPctY = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));

      const dx = Math.abs(curPctX - startPctX);
      const dy = Math.abs(curPctY - startPctY);

      if (dx > 1 || dy > 1) {
        hasMoved = true;
        const minX = Math.round(Math.min(startPctX, curPctX) * 10) / 10;
        const maxX = Math.round(Math.max(startPctX, curPctX) * 10) / 10;
        const minY = Math.round(Math.min(startPctY, curPctY) * 10) / 10;
        const maxY = Math.round(Math.max(startPctY, curPctY) * 10) / 10;

        this.docCorners.set({
          topLeft: { x: minX, y: minY },
          topRight: { x: maxX, y: minY },
          bottomRight: { x: maxX, y: maxY },
          bottomLeft: { x: minX, y: maxY }
        });
      }
    };

    const endSelection = () => {
      window.removeEventListener('mousemove', updateSelection);
      window.removeEventListener('mouseup', endSelection);
      window.removeEventListener('touchmove', updateSelection);
      window.removeEventListener('touchend', endSelection);

      if (hasMoved) {
        const c = this.docCorners();
        const w = Math.abs(c.topRight.x - c.topLeft.x);
        const h = Math.abs(c.bottomLeft.y - c.topLeft.y);
        if (w < 4 || h < 4) {
          this.resetQuadCorners();
        }
      }
    };

    window.addEventListener('mousemove', updateSelection);
    window.addEventListener('mouseup', endSelection);
    window.addEventListener('touchmove', updateSelection);
    window.addEventListener('touchend', endSelection);
  }

  startMoveBox(event: MouseEvent | TouchEvent, imageWrapperEl: HTMLElement): void {
    if ('button' in event && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();

    const rect = imageWrapperEl.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const startClientX = 'touches' in event && event.touches.length > 0 ? event.touches[0].clientX : (event as MouseEvent).clientX;
    const startClientY = 'touches' in event && event.touches.length > 0 ? event.touches[0].clientY : (event as MouseEvent).clientY;

    const startPctX = ((startClientX - rect.left) / rect.width) * 100;
    const startPctY = ((startClientY - rect.top) / rect.height) * 100;

    const initCorners = { ...this.docCorners() };

    const minX = Math.min(initCorners.topLeft.x, initCorners.bottomLeft.x);
    const maxX = Math.max(initCorners.topRight.x, initCorners.bottomRight.x);
    const minY = Math.min(initCorners.topLeft.y, initCorners.topRight.y);
    const maxY = Math.max(initCorners.bottomLeft.y, initCorners.bottomRight.y);

    const updateMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e && e.touches.length > 0 ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = 'touches' in e && e.touches.length > 0 ? e.touches[0].clientY : (e as MouseEvent).clientY;

      const curPctX = ((clientX - rect.left) / rect.width) * 100;
      const curPctY = ((clientY - rect.top) / rect.height) * 100;

      let deltaX = curPctX - startPctX;
      let deltaY = curPctY - startPctY;

      if (minX + deltaX < 0) deltaX = -minX;
      if (maxX + deltaX > 100) deltaX = 100 - maxX;
      if (minY + deltaY < 0) deltaY = -minY;
      if (maxY + deltaY > 100) deltaY = 100 - maxY;

      deltaX = Math.round(deltaX * 10) / 10;
      deltaY = Math.round(deltaY * 10) / 10;

      this.docCorners.set({
        topLeft: { x: Math.round((initCorners.topLeft.x + deltaX) * 10) / 10, y: Math.round((initCorners.topLeft.y + deltaY) * 10) / 10 },
        topRight: { x: Math.round((initCorners.topRight.x + deltaX) * 10) / 10, y: Math.round((initCorners.topRight.y + deltaY) * 10) / 10 },
        bottomRight: { x: Math.round((initCorners.bottomRight.x + deltaX) * 10) / 10, y: Math.round((initCorners.bottomRight.y + deltaY) * 10) / 10 },
        bottomLeft: { x: Math.round((initCorners.bottomLeft.x + deltaX) * 10) / 10, y: Math.round((initCorners.bottomLeft.y + deltaY) * 10) / 10 }
      });
    };

    const endMove = () => {
      window.removeEventListener('mousemove', updateMove);
      window.removeEventListener('mouseup', endMove);
      window.removeEventListener('touchmove', updateMove);
      window.removeEventListener('touchend', endMove);
    };

    window.addEventListener('mousemove', updateMove);
    window.addEventListener('mouseup', endMove);
    window.addEventListener('touchmove', updateMove);
    window.addEventListener('touchend', endMove);
  }

  startCornerDrag(event: MouseEvent | TouchEvent, target: string, imageWrapperEl: HTMLElement): void {
    event.preventDefault();
    event.stopPropagation();

    this.isDraggingCorner.set(true);

    const updatePosition = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;

      const rect = imageWrapperEl.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      const pctX = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
      const pctY = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));

      const cur = { ...this.docCorners() };

      if (target === 'topLeft') {
        cur.topLeft = { x: Math.round(pctX * 10) / 10, y: Math.round(pctY * 10) / 10 };
      } else if (target === 'topRight') {
        cur.topRight = { x: Math.round(pctX * 10) / 10, y: Math.round(pctY * 10) / 10 };
      } else if (target === 'bottomRight') {
        cur.bottomRight = { x: Math.round(pctX * 10) / 10, y: Math.round(pctY * 10) / 10 };
      } else if (target === 'bottomLeft') {
        cur.bottomLeft = { x: Math.round(pctX * 10) / 10, y: Math.round(pctY * 10) / 10 };
      } else if (target === 'topEdge') {
        const deltaY = pctY - (cur.topLeft.y + cur.topRight.y) / 2;
        cur.topLeft.y = Math.max(0, Math.min(100, cur.topLeft.y + deltaY));
        cur.topRight.y = Math.max(0, Math.min(100, cur.topRight.y + deltaY));
      } else if (target === 'bottomEdge') {
        const deltaY = pctY - (cur.bottomLeft.y + cur.bottomRight.y) / 2;
        cur.bottomLeft.y = Math.max(0, Math.min(100, cur.bottomLeft.y + deltaY));
        cur.bottomRight.y = Math.max(0, Math.min(100, cur.bottomRight.y + deltaY));
      } else if (target === 'leftEdge') {
        const deltaX = pctX - (cur.topLeft.x + cur.bottomLeft.x) / 2;
        cur.topLeft.x = Math.max(0, Math.min(100, cur.topLeft.x + deltaX));
        cur.bottomLeft.x = Math.max(0, Math.min(100, cur.bottomLeft.x + deltaX));
      } else if (target === 'rightEdge') {
        const deltaX = pctX - (cur.topRight.x + cur.bottomRight.x) / 2;
        cur.topRight.x = Math.max(0, Math.min(100, cur.topRight.x + deltaX));
        cur.bottomRight.x = Math.max(0, Math.min(100, cur.bottomRight.x + deltaX));
      }

      this.docCorners.set(cur);

      const LOUPE_SIZE = 84;
      const LOUPE_RADIUS = LOUPE_SIZE / 2;
      const ZOOM = 2.2;

      const touchX = Math.max(0, Math.min(rect.width, clientX - rect.left));
      const touchY = Math.max(0, Math.min(rect.height, clientY - rect.top));

      let loupeLeft = touchX;
      let loupeTop = touchY - LOUPE_RADIUS - 45;

      loupeLeft = Math.max(LOUPE_RADIUS + 6, Math.min(rect.width - LOUPE_RADIUS - 6, loupeLeft));

      if (touchY < LOUPE_SIZE + 20) {
        loupeTop = touchY + LOUPE_RADIUS + 35;
      } else {
        loupeTop = Math.max(LOUPE_RADIUS + 6, loupeTop);
      }

      const bgX = LOUPE_RADIUS - touchX * ZOOM;
      const bgY = LOUPE_RADIUS - touchY * ZOOM;

      const bgWidth = rect.width * ZOOM;
      const bgHeight = rect.height * ZOOM;

      this.dragLoupeData.set({
        loupeLeft,
        loupeTop,
        bgPos: `${Math.round(bgX * 10) / 10}px ${Math.round(bgY * 10) / 10}px`,
        bgSize: `${Math.round(bgWidth)}px ${Math.round(bgHeight)}px`
      });
    };

    const endDrag = () => {
      this.isDraggingCorner.set(false);
      this.dragLoupeData.set(null);
      window.removeEventListener('mousemove', updatePosition);
      window.removeEventListener('mouseup', endDrag);
      window.removeEventListener('touchmove', updatePosition);
      window.removeEventListener('touchend', endDrag);
    };

    window.addEventListener('mousemove', updatePosition);
    window.addEventListener('mouseup', endDrag);
    window.addEventListener('touchmove', updatePosition);
    window.addEventListener('touchend', endDrag);
  }

  async applyWarpAndStartOcr(): Promise<void> {
    const src = this.capturedDocSrc();
    if (!src) return;

    this.showDocCropModal.set(false);
    this.isProcessing.set(true);
    this.progressPercent.set(15);
    this.statusMessage.set('Applying 4-Point Perspective Warp...');

    try {
      const warped = await this.preprocessor.warpPerspective(
        src,
        this.docCorners(),
        this.activeDocFilter(),
        1800
      );

      this.previewDataUrl.set(warped.dataUrl);

      this.progressPercent.set(40);
      this.statusMessage.set('Extracting details with Gemini 3.8 Flash AI...');

      let parsedData1: ExtractedCardData;

      // Extract details exclusively using Gemini 3.8 Flash AI
      const geminiResult = await firstValueFrom(this.ocrService.parseCardWithGemini(warped.dataUrl));
      const hasValidFields = !!(
        geminiResult &&
        (geminiResult.name || geminiResult.company || geminiResult.phone || geminiResult.email || geminiResult.designation)
      );

      if (!hasValidFields) {
        throw new Error('Gemini OCR returned empty fields or backend returned unparsed response.');
      }

      parsedData1 = { ...geminiResult, photoDataUrl: warped.dataUrl };
      this.progressPercent.set(90);

      /* FALLBACK COMMENTED OUT - RUNNING STRICTLY ON GEMINI AI
      // Local Tesseract OCR fallback:
      try {
        // ...
      } catch (geminiErr: any) {
        const errorDetails = geminiErr?.error?.Details || geminiErr?.error?.Message || geminiErr?.message || '';
        console.warn('Gemini 3.8 Flash OCR error or empty response, falling back to local OCR...', errorDetails, geminiErr);
        this.statusMessage.set('Reading card details with local engine...');
        this.progressPercent.set(60);

        let res1 = await this.runTesseractOcr(warped.dataUrl);
        parsedData1 = this.parser.parseCardText(res1.text, res1.lineMetadata);

        const hasMissingFields = !parsedData1.name || !parsedData1.email || !parsedData1.phone || !parsedData1.company;
        if (hasMissingFields) {
          try {
            const binarizedUrl = await this.preprocessor.createContrastBinarizedDataUrl(warped.dataUrl);
            const res2 = await this.runTesseractOcr(binarizedUrl);
            const parsedData2 = this.parser.parseCardText(res2.text, res2.lineMetadata);
            parsedData1 = this.parser.mergeCardData(parsedData1, parsedData2);
          } catch {
          }
        }
      }
      */

      parsedData1.photoDataUrl = warped.dataUrl;
      this.progressPercent.set(100);
      this.extractedData.set(parsedData1);
      this.modalData = { ...parsedData1 };
      this.cardExtracted.emit(parsedData1);
      this.openEditModal();
    } catch (err: any) {
      console.error('Gemini OCR Processing Error:', err);
      const errorMsg = err?.error?.Details || err?.error?.Message || err?.message || 'Could not process card with Gemini OCR. Please try again.';
      alert(`Gemini OCR Error: ${errorMsg}`);
    } finally {
      this.isProcessing.set(false);
    }
  }

  private async runTesseractOcr(imageDataUrl: string): Promise<{ text: string; lineMetadata: any[] }> {
    const tesseractModule = await import('tesseract.js') as any;
    const createWorker = tesseractModule.createWorker || tesseractModule.default?.createWorker;
    if (!createWorker) {
      throw new Error('Failed to load tesseract.js: createWorker not found in module exports');
    }
    let worker: any = null;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const localLangPath = `${origin}/ocr`;
    const cdnLangPath = 'https://cdn.jsdelivr.net/gh/tesseract-ocr/tessdata_fast@main';

    try {
      worker = await createWorker('eng', 1, {
        workerPath: `${origin}/ocr/worker.min.js`,
        corePath: `${origin}/ocr`,
        langPath: localLangPath,
        logger: (m: any) => {
          if (m.status === 'recognizing text' && m.progress) {
            const pct = Math.round(35 + m.progress * 60);
            this.progressPercent.set(pct);
            this.statusMessage.set(`Recognizing Card Text (${Math.round(m.progress * 100)}%)...`);
          }
        }
      });

      await worker.setParameters({
        tessedit_pageseg_mode: '6' as any
      });

      const ret = await worker.recognize(imageDataUrl);
      const lineMetadata = (ret.data?.lines || []).map((l: any) => ({
        text: (l.text || '').trim(),
        fontSize: l.bbox ? (l.bbox.y1 - l.bbox.y0) : 0
      })).filter((l: any) => l.text.length > 0);

      return { text: ret.data.text, lineMetadata };
    } catch (err) {
      console.warn('Local OCR worker error, executing CDN worker fallback...', err);
      try {
        const fallbackWorker = await createWorker('eng', 1, {
          workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@v5/dist/worker.min.js',
          corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@v5',
          langPath: cdnLangPath,
          gzip: false,
          logger: (m: any) => {
            if (m.status === 'recognizing text' && m.progress) {
              const pct = Math.round(30 + m.progress * 65);
              this.progressPercent.set(pct);
              this.statusMessage.set(`Recognizing Card Text (${Math.round(m.progress * 100)}%)...`);
            }
          }
        });
        await fallbackWorker.setParameters({
          tessedit_pageseg_mode: '11' as any
        });
        const ret = await fallbackWorker.recognize(imageDataUrl);
        await fallbackWorker.terminate();
        const lineMetadata = (ret.data?.lines || []).map((l: any) => ({
          text: (l.text || '').trim(),
          fontSize: l.bbox ? (l.bbox.y1 - l.bbox.y0) : 0
        })).filter((l: any) => l.text.length > 0);

        return { text: ret.data.text, lineMetadata };
      } catch (cdnErr) {
        console.warn('CDN worker fallback error, executing default worker fallback...', cdnErr);
        const defaultWorker = await createWorker('eng', 1, {
          langPath: cdnLangPath,
          gzip: false
        });
        await defaultWorker.setParameters({
          tessedit_pageseg_mode: '11' as any
        });
        const ret = await defaultWorker.recognize(imageDataUrl);
        await defaultWorker.terminate();
        const lineMetadata = (ret.data?.lines || []).map((l: any) => ({
          text: (l.text || '').trim(),
          fontSize: l.bbox ? (l.bbox.y1 - l.bbox.y0) : 0
        })).filter((l: any) => l.text.length > 0);

        return { text: ret.data.text, lineMetadata };
      }
    } finally {
      if (worker) {
        await worker.terminate();
      }
    }
  }

  modalPhoneNumbers: string[] = [''];

  get modalPhone(): string {
    return this.modalPhoneNumbers.map(p => p.trim()).filter(p => p.length > 0).join(', ');
  }

  set modalPhone(val: string) {
    if (!val || !val.trim()) {
      this.modalPhoneNumbers = [''];
      return;
    }
    const phonePattern = /(?:\+?91[\s.-]?)?[6-9]\d{4}[\s.-]?\d{5}|\b[6-9]\d{9}\b|(?:\+?91[\s.-]?)?(?:0?\d{3,4}[\s.-]?)?[2-5]\d{6,7}/g;
    const matches = val.match(phonePattern);
    if (matches && matches.length > 0) {
      const uniquePhones: string[] = [];
      const digitsSet = new Set<string>();
      for (const ph of matches) {
        const trimmed = ph.trim();
        const digits = trimmed.replace(/\D/g, '');
        const last10 = digits.length >= 10 ? digits.slice(-10) : digits;
        if (!digitsSet.has(last10)) {
          digitsSet.add(last10);
          uniquePhones.push(trimmed);
        }
      }
      this.modalPhoneNumbers = uniquePhones.slice(0, 3);
    } else {
      const parts = val.split(/[,/]+|\s{2,}/).map(p => p.trim()).filter(p => p.length > 0);
      const uniqueParts: string[] = [];
      const digitsSet = new Set<string>();
      for (const p of parts) {
        const digits = p.replace(/\D/g, '');
        const last10 = digits.length >= 10 ? digits.slice(-10) : digits;
        if (last10.length >= 7 && !digitsSet.has(last10)) {
          digitsSet.add(last10);
          uniqueParts.push(p);
        } else if (last10.length < 7 && !uniqueParts.includes(p)) {
          uniqueParts.push(p);
        }
      }
      this.modalPhoneNumbers = uniqueParts.length > 0 ? uniqueParts.slice(0, 3) : [''];
    }
  }

  addModalPhoneInput(): void {
    if (this.modalPhoneNumbers.length < 3) {
      this.modalPhoneNumbers.push('');
    }
  }

  removeModalPhoneInput(index: number): void {
    if (index > 0 && index < this.modalPhoneNumbers.length) {
      this.modalPhoneNumbers.splice(index, 1);
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
    this.modalPhone = current.phone || '';
    this.showModal.set(true);
  }

  closeEditModal(): void {
    this.showModal.set(false);
  }

  saveAndApplyModal(): void {
    this.modalData.phone = this.modalPhone;
    this.extractedData.set({ ...this.modalData });
    this.cardExtracted.emit({ ...this.modalData });
    this.closeEditModal();
  }

  ngOnDestroy(): void {
    this.stopCamera();
  }
}
