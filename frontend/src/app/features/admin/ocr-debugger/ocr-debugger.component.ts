import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OcrDebuggerService } from '../../../core/services/ocr-debugger.service';
import { OcrPreprocessorService, CardCorners } from '../../../core/services/ocr-preprocessor.service';
import { OcrDebugTelemetry } from '../../../core/services/card-parser.service';

@Component({
  selector: 'app-ocr-debugger',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ocr-debugger.component.html',
  styleUrl: './ocr-debugger.component.css'
})
export class OcrDebuggerComponent {
  private debuggerService = inject(OcrDebuggerService);
  private preprocessor = inject(OcrPreprocessorService);

  isProcessing = signal(false);
  progressPercent = signal(0);
  statusMessage = signal('Ready');
  activeTab = signal<'preprocessing' | 'raw-ocr' | 'heuristics' | 'scores' | 'api'>('preprocessing');
  telemetry = signal<OcrDebugTelemetry | null>(null);

  // Stage 2 Document Corner Cropper State
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

  quadSvgPoints = computed(() => {
    const c = this.docCorners();
    return `${c.topLeft.x},${c.topLeft.y} ${c.topRight.x},${c.topRight.y} ${c.bottomRight.x},${c.bottomRight.y} ${c.bottomLeft.x},${c.bottomLeft.y}`;
  });

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      await this.openDocCropModal(dataUrl);
    };
    reader.readAsDataURL(file);
  }

  async openDocCropModal(sourceDataUrl: string): Promise<void> {
    this.capturedDocSrc.set(sourceDataUrl);
    this.showDocCropModal.set(true);
    this.resetQuadCorners();
  }

  closeDocCropModal(): void {
    this.showDocCropModal.set(false);
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

  async applyWarpAndStartDebugger(): Promise<void> {
    const src = this.capturedDocSrc();
    if (!src) return;

    this.showDocCropModal.set(false);
    this.isProcessing.set(true);
    this.progressPercent.set(10);
    this.statusMessage.set('Applying 4-Point Perspective Warp & Filter...');

    try {
      const res = await this.debuggerService.runFullDebuggerPipeline(
        src,
        {
          corners: this.docCorners(),
          filter: this.activeDocFilter()
        },
        (msg, pct) => {
          this.statusMessage.set(msg);
          this.progressPercent.set(pct);
        }
      );
      this.telemetry.set(res);
    } catch (err) {
      console.error('OCR Debugger Error:', err);
      alert('Failed to execute OCR Debugger pipeline.');
    } finally {
      this.isProcessing.set(false);
    }
  }
}
