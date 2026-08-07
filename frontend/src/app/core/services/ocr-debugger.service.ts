import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';
import type { Worker } from 'tesseract.js';

import { OcrPreprocessorService } from './ocr-preprocessor.service';
import { CardParserService, OcrDebugTelemetry, OcrLineMetadata, MergeFieldScore } from './card-parser.service';
import { getApiUrl } from '../config/api.config';

@Injectable({
  providedIn: 'root'
})
export class OcrDebuggerService {
  private preprocessor = inject(OcrPreprocessorService);
  private parser = inject(CardParserService);
  private http = inject(HttpClient);

  /**
   * Calls backend API endpoint POST /api/v1/ocr/parse
   */
  callBackendOcrApi(imageDataUrl: string): Observable<any> {
    const url = `${getApiUrl()}/v1/ocr/parse`;
    return this.http.post<any>(url, { imageDataUrl });
  }

  /**
   * Runs the complete multi-pass OCR Debugger pipeline (Steps C through H)
   * capturing detailed diagnostics at every stage.
   */
  async runFullDebuggerPipeline(
    source: File | string,
    options: { corners?: any; filter?: 'vibrant' | 'original' | 'bw'; warpedDataUrl?: string } = {},
    progressCb?: (status: string, percent: number) => void
  ): Promise<OcrDebugTelemetry> {
    const reportProgress = (status: string, percent: number) => {
      if (progressCb) progressCb(status, percent);
    };

    reportProgress('Stage C: Applying 4-Point Perspective Warp & Filter...', 10);

    let pass1WarpedUrl = options.warpedDataUrl || '';

    if (!pass1WarpedUrl) {
      const filter = options.filter || 'vibrant';
      if (options.corners) {
        const warped = await this.preprocessor.warpPerspective(source, options.corners, filter, 1800);
        pass1WarpedUrl = warped.dataUrl;
      } else {
        const corners = await this.preprocessor.autoDetectCardCorners(source);
        const warped = await this.preprocessor.warpPerspective(source, corners, filter, 1800);
        pass1WarpedUrl = warped.dataUrl;
      }
    }

    reportProgress('Stage D: Preprocessing Pass 1 (Vibrant Sharpened)...', 25);

    reportProgress('Stage E & F: Executing Tesseract WASM OCR Engine (Pass 1)...', 40);
    const pass1Ocr = await this.runTesseractOcr(pass1WarpedUrl, (pct) => {
      reportProgress(`Recognizing Pass 1 text (${pct}%)...`, 40 + Math.round(pct * 0.2));
    });

    reportProgress('Stage G: Parsing Pass 1 text heuristics...', 65);
    const pass1Extracted = this.parser.parseCardText(pass1Ocr.text, pass1Ocr.lineMetadata);

    reportProgress('Stage D: Preprocessing Pass 2 (Adaptive Binarization)...', 75);
    let pass2BinarizedUrl = '';
    let pass2Ocr = { text: '', lineMetadata: [] as OcrLineMetadata[] };
    let pass2Extracted = {};

    try {
      pass2BinarizedUrl = await this.preprocessor.createContrastBinarizedDataUrl(pass1WarpedUrl);
      reportProgress('Stage E & F: Executing Tesseract WASM OCR Engine (Pass 2)...', 85);
      pass2Ocr = await this.runTesseractOcr(pass2BinarizedUrl);
      pass2Extracted = this.parser.parseCardText(pass2Ocr.text, pass2Ocr.lineMetadata);
    } catch (e) {
      console.warn('Pass 2 diagnostic binarization skipped:', e);
    }

    reportProgress('Stage H: Calculating Multi-Pass Merging & Score Diagnostics...', 95);
    const finalMerged = this.parser.mergeCardData(pass1Extracted, pass2Extracted);

    const mergeScores: MergeFieldScore[] = [];
    const fields = ['name', 'designation', 'company', 'phone', 'email', 'website', 'address'];

    for (const f of fields) {
      const v1 = (pass1Extracted as any)[f];
      const v2 = (pass2Extracted as any)[f];
      const s1 = this.parser.scoreField(v1, f);
      const s2 = this.parser.scoreField(v2, f);
      const finalVal = (finalMerged as any)[f];

      let winner: 'pass1' | 'pass2' | 'equal' | 'none' = 'none';
      if (v1 && s1 >= 0) {
        winner = 'pass1';
      } else if (v2 && (!v1 || s2 > s1)) {
        winner = 'pass2';
      } else if (v1) {
        winner = 'pass1';
      }

      mergeScores.push({
        field: f,
        pass1Val: v1,
        pass1Score: s1,
        pass2Val: v2,
        pass2Score: s2,
        winner,
        finalVal
      });
    }

    const fieldDiagnostics = this.parser.getDiagnosticBreakdown(pass1Ocr.text, pass1Ocr.lineMetadata);

    let apiResponse = null;
    try {
      apiResponse = await firstValueFrom(this.callBackendOcrApi(pass1WarpedUrl));
    } catch (err: any) {
      apiResponse = { status: 'Error/Offline', error: err?.message || 'Backend API unreachable' };
    }

    reportProgress('Completed OCR Debugger Pipeline!', 100);

    return {
      timestamp: new Date().toISOString(),
      pass1WarpedUrl,
      pass2BinarizedUrl,
      pass1RawText: pass1Ocr.text,
      pass2RawText: pass2Ocr.text,
      pass1LineMetadata: pass1Ocr.lineMetadata,
      pass2LineMetadata: pass2Ocr.lineMetadata,
      pass1Extracted,
      pass2Extracted,
      fieldDiagnostics,
      mergeScores,
      finalMerged,
      apiResponse
    };
  }

  private async runTesseractOcr(
    imageDataUrl: string,
    progressCb?: (pct: number) => void
  ): Promise<{ text: string; lineMetadata: OcrLineMetadata[] }> {
    const { createWorker } = await import('tesseract.js');
    let worker: Worker | null = null;
    try {
      worker = await createWorker('eng', 1, {
        workerPath: '/ocr/worker.min.js',
        corePath: '/ocr',
        logger: (m) => {
          if (m.status === 'recognizing text' && m.progress && progressCb) {
            progressCb(Math.round(m.progress * 100));
          }
        }
      });

      await worker.setParameters({
        tessedit_pageseg_mode: '3' as any
      });

      const ret = await worker.recognize(imageDataUrl);
      const lineMetadata = (ret.data?.lines || []).map((l: any) => ({
        text: (l.text || '').trim(),
        fontSize: l.bbox ? (l.bbox.y1 - l.bbox.y0) : 0
      })).filter((l: any) => l.text.length > 0);

      return { text: ret.data.text, lineMetadata };
    } catch {
      const fallbackWorker = await createWorker('eng');
      await fallbackWorker.setParameters({ tessedit_pageseg_mode: '3' as any });
      const ret = await fallbackWorker.recognize(imageDataUrl);
      await fallbackWorker.terminate();

      const lineMetadata = (ret.data?.lines || []).map((l: any) => ({
        text: (l.text || '').trim(),
        fontSize: l.bbox ? (l.bbox.y1 - l.bbox.y0) : 0
      })).filter((l: any) => l.text.length > 0);

      return { text: ret.data.text, lineMetadata };
    } finally {
      if (worker) {
        await worker.terminate();
      }
    }
  }
}
