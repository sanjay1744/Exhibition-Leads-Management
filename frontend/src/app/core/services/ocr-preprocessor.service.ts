import { Injectable } from '@angular/core';

export interface PreprocessOptions {
  contrast?: number; // 1.0 = normal, 1.4 = high contrast
  grayscale?: boolean;
  binarize?: boolean; // black & white threshold
  thresholdValue?: number; // 0-255 (default auto ~128)
  minWidth?: number; // scale up if smaller than this
}

@Injectable({
  providedIn: 'root'
})
export class OcrPreprocessorService {

  /**
   * Processes a card image file and returns an optimized Data URL string and dimensions
   */
  async preprocessImage(file: File, options: PreprocessOptions = {}): Promise<{ dataUrl: string; width: number; height: number }> {
    const defaultOpts: Required<PreprocessOptions> = {
      contrast: 1.4,
      grayscale: true,
      binarize: true,
      thresholdValue: 130,
      minWidth: 1200,
      ...options
    };

    const img = await this.loadImage(file);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (!ctx) {
      throw new Error('Canvas context 2D not supported');
    }

    // 1. Calculate scaling factor for high DPI / high resolution Tesseract reading
    let scale = 1;
    if (img.width < defaultOpts.minWidth) {
      scale = defaultOpts.minWidth / img.width;
    }
    canvas.width = Math.floor(img.width * scale);
    canvas.height = Math.floor(img.height * scale);

    // 2. Draw scaled original image
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // 3. Pixel manipulation for high contrast & binarization
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // First pass: compute average luminance for adaptive thresholding if needed
    let totalLuminance = 0;
    const pixelCount = data.length / 4;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      totalLuminance += lum;
    }

    const avgLuminance = totalLuminance / pixelCount;
    const dynamicThreshold = defaultOpts.thresholdValue ?? (avgLuminance * 0.95);

    // Second pass: apply grayscale, contrast, and thresholding
    const contrastFactor = (259 * (defaultOpts.contrast * 255 + 255)) / (255 * (259 - defaultOpts.contrast * 255));

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // Grayscale
      let gray = 0.299 * r + 0.587 * g + 0.114 * b;

      // Apply contrast stretch
      gray = contrastFactor * (gray - 128) + 128;
      gray = Math.min(255, Math.max(0, gray));

      if (defaultOpts.binarize) {
        // Binarize to pure black (0) or white (255)
        const bw = gray > dynamicThreshold ? 255 : 0;
        data[i] = bw;
        data[i + 1] = bw;
        data[i + 2] = bw;
      } else if (defaultOpts.grayscale) {
        data[i] = gray;
        data[i + 1] = gray;
        data[i + 2] = gray;
      }
    }

    ctx.putImageData(imageData, 0, 0);

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
}
