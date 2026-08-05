import { Injectable } from '@angular/core';

export interface Point2D {
  x: number;
  y: number;
}

export interface CardCorners {
  topLeft: Point2D;
  topRight: Point2D;
  bottomRight: Point2D;
  bottomLeft: Point2D;
}

export interface PreprocessOptions {
  mode?: 'natural' | 'grayscale' | 'binary';
  minWidth?: number;
  rotation?: number; // 0, 90, 180, 270
}

export interface CropAndTiltParams {
  cropXPercent: number;     // 0 to 100
  cropYPercent: number;     // 0 to 100
  cropWidthPercent: number; // 0 to 100
  cropHeightPercent: number;// 0 to 100
  tiltAngleDegrees: number; // -180 to 180 (continuous angle in degrees)
  minWidth?: number;        // default 1600 for sharp OCR text
}

@Injectable({
  providedIn: 'root'
})
export class OcrPreprocessorService {

  /**
   * Preprocesses a card image file cleanly without introducing noise artifacts
   */
  async preprocessImage(file: File, options: PreprocessOptions = {}): Promise<{ dataUrl: string; width: number; height: number }> {
    const defaultOpts: Required<PreprocessOptions> = {
      mode: 'natural',
      minWidth: 1600,
      rotation: 0,
      ...options
    };

    const img = await this.loadImage(file);
    return this.processImageElement(img, defaultOpts);
  }

  /**
   * Generates a contrast-enhanced, sharpened, adaptive-binarized Data URL
   * for reading low contrast, blurry, or dual-background card text.
   */
  async createContrastBinarizedDataUrl(sourceUrlOrFile: string | File): Promise<string> {
    const img = typeof sourceUrlOrFile === 'string'
      ? await this.loadImageFromUrl(sourceUrlOrFile)
      : await this.loadImage(sourceUrlOrFile);

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1600, img.width);
    canvas.height = Math.floor(canvas.width * (img.height / (img.width || 1)));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D Canvas context unsupported');

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    let imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    imgData = this.sharpenImageData(imgData);
    imgData = this.applyAdaptiveThreshold(imgData, false);
    ctx.putImageData(imgData, 0, 0);

    return canvas.toDataURL('image/png');
  }

  /**
   * Generates an inverted, contrast-enhanced Data URL specifically targeting
   * light text on dark/colored background sections (e.g. white text on blue background).
   */
  async createInvertedContrastDataUrl(sourceUrlOrFile: string | File): Promise<string> {
    const img = typeof sourceUrlOrFile === 'string'
      ? await this.loadImageFromUrl(sourceUrlOrFile)
      : await this.loadImage(sourceUrlOrFile);

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1600, img.width);
    canvas.height = Math.floor(canvas.width * (img.height / (img.width || 1)));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D Canvas context unsupported');

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    let imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    imgData = this.sharpenImageData(imgData);
    imgData = this.applyAdaptiveThreshold(imgData, true);
    ctx.putImageData(imgData, 0, 0);

    return canvas.toDataURL('image/png');
  }

  /**
   * Spatial 3x3 convolution sharpening filter to restore blurry character boundaries
   */
  private sharpenImageData(imgData: ImageData): ImageData {
    const w = imgData.width;
    const h = imgData.height;
    const src = imgData.data;
    const output = new ImageData(w, h);
    const dst = output.data;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (x === 0 || y === 0 || x === w - 1 || y === h - 1) {
          dst[i] = src[i];
          dst[i + 1] = src[i + 1];
          dst[i + 2] = src[i + 2];
          dst[i + 3] = src[i + 3];
          continue;
        }

        const top = ((y - 1) * w + x) * 4;
        const bot = ((y + 1) * w + x) * 4;
        const left = (y * w + (x - 1)) * 4;
        const right = (y * w + (x + 1)) * 4;

        for (let c = 0; c < 3; c++) {
          const val = 5 * src[i + c] - src[top + c] - src[bot + c] - src[left + c] - src[right + c];
          dst[i + c] = Math.min(255, Math.max(0, val));
        }
        dst[i + 3] = src[i + 3];
      }
    }

    return output;
  }

  /**
   * Local Window Adaptive Thresholding using Integral Image (O(1) local mean per pixel).
   * Robust against dual-background cards with light/dark splits.
   */
  private applyAdaptiveThreshold(imgData: ImageData, invert: boolean): ImageData {
    const w = imgData.width;
    const h = imgData.height;
    const d = imgData.data;

    // 1. Calculate luminance & create 32-bit integral image
    const lum = new Uint8Array(w * h);
    const integral = new Float64Array((w + 1) * (h + 1));

    for (let y = 0; y < h; y++) {
      let rowSum = 0;
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        let l = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
        if (invert) l = 255 - l;
        lum[y * w + x] = l;

        rowSum += l;
        integral[(y + 1) * (w + 1) + (x + 1)] = integral[y * (w + 1) + (x + 1)] + rowSum;
      }
    }

    // 2. Adaptive threshold per pixel with dynamic window S
    const S = Math.max(16, Math.floor(w / 32));
    const halfS = Math.floor(S / 2);
    const C = 12; // sensitivity threshold offset

    const output = new ImageData(w, h);
    const outD = output.data;

    for (let y = 0; y < h; y++) {
      const y1 = Math.max(0, y - halfS);
      const y2 = Math.min(h, y + halfS);

      for (let x = 0; x < w; x++) {
        const x1 = Math.max(0, x - halfS);
        const x2 = Math.min(w, x + halfS);

        const count = (x2 - x1) * (y2 - y1);
        const sum = integral[y2 * (w + 1) + x2]
                  - integral[y1 * (w + 1) + x2]
                  - integral[y2 * (w + 1) + x1]
                  + integral[y1 * (w + 1) + x1];

        const localMean = sum / count;
        const l = lum[y * w + x];
        const val = l < (localMean - C) ? 0 : 255;

        const idx = (y * w + x) * 4;
        outD[idx] = val;
        outD[idx + 1] = val;
        outD[idx + 2] = val;
        outD[idx + 3] = 255;
      }
    }

    return output;
  }

  /**
   * Generates a tilted Data URL from a source image for real-time editor rendering.
   */
  async getTiltedDataUrl(sourceUrlOrFile: string | File, degrees: number): Promise<string> {
    if (degrees === 0 && typeof sourceUrlOrFile === 'string') {
      return sourceUrlOrFile;
    }
    const img = typeof sourceUrlOrFile === 'string'
      ? await this.loadImageFromUrl(sourceUrlOrFile)
      : await this.loadImage(sourceUrlOrFile);

    const rad = (degrees * Math.PI) / 180;
    const absCos = Math.abs(Math.cos(rad));
    const absSin = Math.abs(Math.sin(rad));

    const rotW = Math.round(img.width * absCos + img.height * absSin);
    const rotH = Math.round(img.width * absSin + img.height * absCos);

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, rotW);
    canvas.height = Math.max(1, rotH);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D Canvas unavailable');

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    ctx.translate(rotW / 2, rotH / 2);
    ctx.rotate(rad);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);

    return canvas.toDataURL('image/png');
  }

  /**
   * Applies fine rotation tilt and rectangular cropping to an image Data URL / File
   * returning a high-resolution processed Data URL ready for OCR.
   */
  async cropAndTiltImage(
    sourceUrlOrFile: string | File,
    params: CropAndTiltParams
  ): Promise<{ dataUrl: string; width: number; height: number }> {
    const img = typeof sourceUrlOrFile === 'string'
      ? await this.loadImageFromUrl(sourceUrlOrFile)
      : await this.loadImage(sourceUrlOrFile);

    const minWidth = params.minWidth || 1600;
    const rad = (params.tiltAngleDegrees * Math.PI) / 180;

    // 1. Calculate bounding box after continuous rotation tilt
    const absCos = Math.abs(Math.cos(rad));
    const absSin = Math.abs(Math.sin(rad));

    const rotatedWidth = Math.round(img.width * absCos + img.height * absSin);
    const rotatedHeight = Math.round(img.width * absSin + img.height * absCos);

    // 2. Render tilted source image to intermediate canvas
    const tiltCanvas = document.createElement('canvas');
    tiltCanvas.width = Math.max(1, rotatedWidth);
    tiltCanvas.height = Math.max(1, rotatedHeight);
    const tiltCtx = tiltCanvas.getContext('2d');
    if (!tiltCtx) throw new Error('2D Canvas unavailable');

    tiltCtx.imageSmoothingEnabled = true;
    tiltCtx.imageSmoothingQuality = 'high';

    tiltCtx.save();
    tiltCtx.translate(rotatedWidth / 2, rotatedHeight / 2);
    tiltCtx.rotate(rad);
    tiltCtx.drawImage(img, -img.width / 2, -img.height / 2);
    tiltCtx.restore();

    // 3. Calculate absolute pixel crop region on the tilted canvas
    const cropX = Math.max(0, Math.min(rotatedWidth - 1, Math.round((params.cropXPercent / 100) * rotatedWidth)));
    const cropY = Math.max(0, Math.min(rotatedHeight - 1, Math.round((params.cropYPercent / 100) * rotatedHeight)));
    const cropW = Math.max(20, Math.min(rotatedWidth - cropX, Math.round((params.cropWidthPercent / 100) * rotatedWidth)));
    const cropH = Math.max(20, Math.min(rotatedHeight - cropY, Math.round((params.cropHeightPercent / 100) * rotatedHeight)));

    // 4. Scale up cropped card region to target high-res width for OCR readability
    let scale = 1;
    if (cropW < minWidth) {
      scale = minWidth / cropW;
    }

    const outputWidth = Math.floor(cropW * scale);
    const outputHeight = Math.floor(cropH * scale);

    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = Math.max(1, outputWidth);
    outputCanvas.height = Math.max(1, outputHeight);
    const outCtx = outputCanvas.getContext('2d');
    if (!outCtx) throw new Error('2D Canvas unavailable');

    outCtx.imageSmoothingEnabled = true;
    outCtx.imageSmoothingQuality = 'high';

    outCtx.drawImage(
      tiltCanvas,
      cropX, cropY, cropW, cropH,
      0, 0, outputWidth, outputHeight
    );

    return {
      dataUrl: outputCanvas.toDataURL('image/png'),
      width: outputWidth,
      height: outputHeight
    };
  }

  /**
   * Rotates a Data URL image cleanly by specified degrees
   */
  async rotateDataUrl(dataUrl: string, degrees: number): Promise<string> {
    const img = await this.loadImageFromUrl(dataUrl);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D Canvas unavailable');

    const rad = (degrees * Math.PI) / 180;
    const isQuadrant = (degrees / 90) % 2 !== 0;

    canvas.width = isQuadrant ? img.height : img.width;
    canvas.height = isQuadrant ? img.width : img.height;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(rad);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);

    return canvas.toDataURL('image/png');
  }

  /**
   * Clean rendering pipeline: scales and rotates without destructive pixel noise
   */
  processImageElement(img: HTMLImageElement, opts: Required<PreprocessOptions>): { dataUrl: string; width: number; height: number } {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas context 2D not supported');

    const rotationRad = (opts.rotation * Math.PI) / 180;
    const isQuadrant = (opts.rotation / 90) % 2 !== 0;

    let srcWidth = img.width;
    let srcHeight = img.height;

    if (isQuadrant) {
      srcWidth = img.height;
      srcHeight = img.width;
    }

    // Scale up if resolution is low for optimal OCR font size
    let scale = 1;
    if (srcWidth < opts.minWidth) {
      scale = opts.minWidth / srcWidth;
    }

    const targetWidth = Math.floor(srcWidth * scale);
    const targetHeight = Math.floor(srcHeight * scale);

    canvas.width = targetWidth;
    canvas.height = targetHeight;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    ctx.save();
    ctx.translate(targetWidth / 2, targetHeight / 2);
    ctx.rotate(rotationRad);
    
    const drawW = isQuadrant ? targetHeight : targetWidth;
    const drawH = isQuadrant ? targetWidth : targetHeight;
    ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();

    // Contrast stretching to make faint/brown/grey top text (e.g., "R. SUNDARRAJ", "Managing Director") sharp for Tesseract OCR
    try {
      const imgData = ctx.getImageData(0, 0, targetWidth, targetHeight);
      const d = imgData.data;

      let minL = 255;
      let maxL = 0;
      const lums = new Uint8Array(d.length / 4);

      for (let i = 0; i < d.length; i += 4) {
        const l = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
        lums[i / 4] = l;
        if (l < minL) minL = l;
        if (l > maxL) maxL = l;
      }

      const range = Math.max(1, maxL - minL);
      for (let i = 0; i < d.length; i += 4) {
        let l = lums[i / 4];
        l = Math.round(((l - minL) / range) * 255);
        if (l < 140) {
          l = Math.max(0, l - Math.round((140 - l) * 0.45));
        } else {
          l = Math.min(255, l + Math.round((l - 140) * 0.45));
        }
        d[i] = l;
        d[i + 1] = l;
        d[i + 2] = l;
      }

      ctx.putImageData(imgData, 0, 0);
    } catch {
      // Fallback if canvas security restricts getImageData
    }

    return {
      dataUrl: canvas.toDataURL('image/png'),
      width: canvas.width,
      height: canvas.height
    };
  }

  /**
   * Scans image edge gradients to automatically detect card 4 corners (TL, TR, BR, BL)
   */
  async autoDetectCardCorners(sourceUrlOrFile: string | File): Promise<CardCorners> {
    const defaultQuad: CardCorners = {
      topLeft: { x: 8, y: 12 },
      topRight: { x: 92, y: 12 },
      bottomRight: { x: 92, y: 88 },
      bottomLeft: { x: 8, y: 88 }
    };

    try {
      const img = typeof sourceUrlOrFile === 'string'
        ? await this.loadImageFromUrl(sourceUrlOrFile)
        : await this.loadImage(sourceUrlOrFile);

      const W = 300;
      const H = 200;
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return defaultQuad;

      ctx.drawImage(img, 0, 0, W, H);
      const imgData = ctx.getImageData(0, 0, W, H);
      const d = imgData.data;

      // Sobel Gradient Magnitude Map
      const grad = new Float32Array(W * H);
      for (let y = 1; y < H - 1; y++) {
        for (let x = 1; x < W - 1; x++) {
          const getLum = (px: number, py: number) => {
            const idx = (py * W + px) * 4;
            return 0.299 * d[idx] + 0.587 * d[idx + 1] + 0.114 * d[idx + 2];
          };

          const gx = -getLum(x - 1, y - 1) + getLum(x + 1, y - 1)
                   - 2 * getLum(x - 1, y) + 2 * getLum(x + 1, y)
                   - getLum(x - 1, y + 1) + getLum(x + 1, y + 1);

          const gy = -getLum(x - 1, y - 1) - 2 * getLum(x, y - 1) - getLum(x + 1, y - 1)
                   + getLum(x - 1, y + 1) + 2 * getLum(x, y + 1) + getLum(x + 1, y + 1);

          grad[y * W + x] = Math.sqrt(gx * gx + gy * gy);
        }
      }

      let bestTL = { x: 0.08 * W, y: 0.12 * H }, maxTL = 0;
      let bestTR = { x: 0.92 * W, y: 0.12 * H }, maxTR = 0;
      let bestBR = { x: 0.92 * W, y: 0.88 * H }, maxBR = 0;
      let bestBL = { x: 0.08 * W, y: 0.88 * H }, maxBL = 0;

      for (let y = 10; y < H - 10; y++) {
        for (let x = 10; x < W - 10; x++) {
          const g = grad[y * W + x];
          if (g < 30) continue;

          const scoreTL = g / (1 + Math.hypot(x - W * 0.15, y - H * 0.18));
          if (x < W * 0.45 && y < H * 0.45 && scoreTL > maxTL) {
            maxTL = scoreTL;
            bestTL = { x, y };
          }

          const scoreTR = g / (1 + Math.hypot(x - W * 0.85, y - H * 0.18));
          if (x > W * 0.55 && y < H * 0.45 && scoreTR > maxTR) {
            maxTR = scoreTR;
            bestTR = { x, y };
          }

          const scoreBR = g / (1 + Math.hypot(x - W * 0.85, y - H * 0.82));
          if (x > W * 0.55 && y > H * 0.55 && scoreBR > maxBR) {
            maxBR = scoreBR;
            bestBR = { x, y };
          }

          const scoreBL = g / (1 + Math.hypot(x - W * 0.15, y - H * 0.82));
          if (x < W * 0.45 && y > H * 0.55 && scoreBL > maxBL) {
            maxBL = scoreBL;
            bestBL = { x, y };
          }
        }
      }

      return {
        topLeft: { x: Math.round((bestTL.x / W) * 1000) / 10, y: Math.round((bestTL.y / H) * 1000) / 10 },
        topRight: { x: Math.round((bestTR.x / W) * 1000) / 10, y: Math.round((bestTR.y / H) * 1000) / 10 },
        bottomRight: { x: Math.round((bestBR.x / W) * 1000) / 10, y: Math.round((bestBR.y / H) * 1000) / 10 },
        bottomLeft: { x: Math.round((bestBL.x / W) * 1000) / 10, y: Math.round((bestBL.y / H) * 1000) / 10 }
      };
    } catch {
      return defaultQuad;
    }
  }

  /**
   * Applies 4-Point Perspective Transformation (Homography Warping)
   * to unwarp an arbitrarily oriented quadrilateral card region into a clean flat rectangular image.
   */
  async warpPerspective(
    sourceUrlOrFile: string | File,
    corners: CardCorners,
    filter: 'original' | 'vibrant' | 'bw' = 'vibrant',
    targetWidth: number = 1600
  ): Promise<{ dataUrl: string; width: number; height: number }> {
    const img = typeof sourceUrlOrFile === 'string'
      ? await this.loadImageFromUrl(sourceUrlOrFile)
      : await this.loadImage(sourceUrlOrFile);

    const srcW = img.width;
    const srcH = img.height;

    const p0 = { x: (corners.topLeft.x / 100) * srcW, y: (corners.topLeft.y / 100) * srcH };
    const p1 = { x: (corners.topRight.x / 100) * srcW, y: (corners.topRight.y / 100) * srcH };
    const p2 = { x: (corners.bottomRight.x / 100) * srcW, y: (corners.bottomRight.y / 100) * srcH };
    const p3 = { x: (corners.bottomLeft.x / 100) * srcW, y: (corners.bottomLeft.y / 100) * srcH };

    const dist = (a: Point2D, b: Point2D) => Math.hypot(a.x - b.x, a.y - b.y);
    const topW = dist(p0, p1);
    const botW = dist(p3, p2);
    const leftH = dist(p0, p3);
    const rightH = dist(p1, p2);

    const calcW = Math.max(topW, botW);
    const calcH = Math.max(leftH, rightH);

    const scale = Math.max(1, targetWidth / (calcW || 1));
    const outW = Math.round(calcW * scale);
    const outH = Math.round(calcH * scale);

    const srcCanvas = document.createElement('canvas');
    srcCanvas.width = srcW;
    srcCanvas.height = srcH;
    const srcCtx = srcCanvas.getContext('2d');
    if (!srcCtx) throw new Error('2D Canvas unavailable');
    srcCtx.drawImage(img, 0, 0);
    const srcImgData = srcCtx.getImageData(0, 0, srcW, srcH);
    const sData = srcImgData.data;

    const outCanvas = document.createElement('canvas');
    outCanvas.width = outW;
    outCanvas.height = outH;
    const outCtx = outCanvas.getContext('2d');
    if (!outCtx) throw new Error('2D Canvas unavailable');
    const outImgData = outCtx.createImageData(outW, outH);
    const oData = outImgData.data;

    const H = this.findHomography(
      [
        { x: 0, y: 0 },
        { x: outW, y: 0 },
        { x: outW, y: outH },
        { x: 0, y: outH }
      ],
      [p0, p1, p2, p3]
    );

    for (let y = 0; y < outH; y++) {
      for (let x = 0; x < outW; x++) {
        const denom = H[6] * x + H[7] * y + 1.0;
        const srcX = (H[0] * x + H[1] * y + H[2]) / denom;
        const srcY = (H[3] * x + H[4] * y + H[5]) / denom;

        const outIdx = (y * outW + x) * 4;

        if (srcX >= 0 && srcX < srcW - 1 && srcY >= 0 && srcY < srcH - 1) {
          const x0 = Math.floor(srcX);
          const y0 = Math.floor(srcY);
          const x1 = x0 + 1;
          const y1 = y0 + 1;

          const dx = srcX - x0;
          const dy = srcY - y0;

          const i00 = (y0 * srcW + x0) * 4;
          const i10 = (y0 * srcW + x1) * 4;
          const i01 = (y1 * srcW + x0) * 4;
          const i11 = (y1 * srcW + x1) * 4;

          for (let c = 0; c < 3; c++) {
            const val =
              (1 - dx) * (1 - dy) * sData[i00 + c] +
              dx * (1 - dy) * sData[i10 + c] +
              (1 - dx) * dy * sData[i01 + c] +
              dx * dy * sData[i11 + c];
            oData[outIdx + c] = Math.round(val);
          }
          oData[outIdx + 3] = 255;
        } else {
          oData[outIdx] = 255;
          oData[outIdx + 1] = 255;
          oData[outIdx + 2] = 255;
          oData[outIdx + 3] = 255;
        }
      }
    }

    outCtx.putImageData(outImgData, 0, 0);

    if (filter === 'vibrant') {
      this.applyVibrantMagicFilter(outCtx, outW, outH);
    } else if (filter === 'bw') {
      let binarizedData = outCtx.getImageData(0, 0, outW, outH);
      binarizedData = this.sharpenImageData(binarizedData);
      binarizedData = this.applyAdaptiveThreshold(binarizedData, false);
      outCtx.putImageData(binarizedData, 0, 0);
    } else {
      this.applyContrastNormalization(outCtx, outW, outH);
    }

    return {
      dataUrl: outCanvas.toDataURL('image/png'),
      width: outW,
      height: outH
    };
  }

  private findHomography(srcPts: Point2D[], dstPts: Point2D[]): number[] {
    const A: number[][] = [];
    const B: number[] = [];

    for (let i = 0; i < 4; i++) {
      const sx = srcPts[i].x;
      const sy = srcPts[i].y;
      const dx = dstPts[i].x;
      const dy = dstPts[i].y;

      A.push([sx, sy, 1, 0, 0, 0, -sx * dx, -sy * dx]);
      B.push(dx);

      A.push([0, 0, 0, sx, sy, 1, -sx * dy, -sy * dy]);
      B.push(dy);
    }

    return this.solveLinearSystem8x8(A, B);
  }

  private solveLinearSystem8x8(A: number[][], B: number[]): number[] {
    const n = 8;
    for (let i = 0; i < n; i++) {
      let maxRow = i;
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(A[k][i]) > Math.abs(A[maxRow][i])) maxRow = k;
      }
      [A[i], A[maxRow]] = [A[maxRow], A[i]];
      [B[i], B[maxRow]] = [B[maxRow], B[i]];

      const pivot = A[i][i];
      if (Math.abs(pivot) < 1e-10) continue;

      for (let j = i; j < n; j++) A[i][j] /= pivot;
      B[i] /= pivot;

      for (let k = 0; k < n; k++) {
        if (k !== i) {
          const factor = A[k][i];
          for (let j = i; j < n; j++) A[k][j] -= factor * A[i][j];
          B[k] -= factor * B[i];
        }
      }
    }
    return B;
  }

  private applyVibrantMagicFilter(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const imgData = ctx.getImageData(0, 0, width, height);
    const d = imgData.data;

    let minL = 255;
    let maxL = 0;
    for (let i = 0; i < d.length; i += 4) {
      const l = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
      if (l < minL) minL = l;
      if (l > maxL) maxL = l;
    }

    const range = Math.max(1, maxL - minL);

    for (let i = 0; i < d.length; i += 4) {
      for (let c = 0; c < 3; c++) {
        let v = d[i + c];
        v = Math.round(((v - minL) / range) * 255);
        v = Math.min(255, Math.max(0, Math.pow(v / 255, 0.9) * 255));
        d[i + c] = Math.round(v);
      }
    }

    ctx.putImageData(imgData, 0, 0);
  }

  private applyContrastNormalization(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    try {
      const imgData = ctx.getImageData(0, 0, width, height);
      const d = imgData.data;
      let minL = 255, maxL = 0;
      const lums = new Uint8Array(d.length / 4);

      for (let i = 0; i < d.length; i += 4) {
        const l = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
        lums[i / 4] = l;
        if (l < minL) minL = l;
        if (l > maxL) maxL = l;
      }

      const range = Math.max(1, maxL - minL);
      for (let i = 0; i < d.length; i += 4) {
        let l = lums[i / 4];
        l = Math.round(((l - minL) / range) * 255);
        d[i] = l;
        d[i + 1] = l;
        d[i + 2] = l;
      }
      ctx.putImageData(imgData, 0, 0);
    } catch {
      // fallback
    }
  }

  private loadImage(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = (err) => reject(err);
        img.src = e.target?.result as string;
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  }

  private loadImageFromUrl(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = (err) => reject(err);
      img.src = url;
    });
  }
}

