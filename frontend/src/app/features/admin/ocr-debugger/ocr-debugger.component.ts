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
    topLeft: { x: 8, y: 12 },
    topRight: { x: 92, y: 12 },
    bottomRight: { x: 92, y: 88 },
    bottomLeft: { x: 8, y: 88 }
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
    const detected = await this.preprocessor.autoDetectCardCorners(sourceDataUrl);
    this.docCorners.set(detected);
  }

  closeDocCropModal(): void {
    this.showDocCropModal.set(false);
  }

  resetQuadCorners(): void {
    this.docCorners.set({
      topLeft: { x: 8, y: 12 },
      topRight: { x: 92, y: 12 },
      bottomRight: { x: 92, y: 88 },
      bottomLeft: { x: 8, y: 88 }
    });
  }

  async rotateCapturedDoc(degreesDelta: number): Promise<void> {
    const src = this.capturedDocSrc();
    if (!src) return;
    const rotatedUrl = await this.preprocessor.rotateDataUrl(src, degreesDelta);
    this.capturedDocSrc.set(rotatedUrl);
    const reDetected = await this.preprocessor.autoDetectCardCorners(rotatedUrl);
    this.docCorners.set(reDetected);
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
