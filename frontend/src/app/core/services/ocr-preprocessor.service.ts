import { Injectable } from '@angular/core';

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

