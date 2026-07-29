import { Injectable } from '@angular/core';

export interface PreprocessOptions {
  mode?: 'natural' | 'grayscale' | 'binary';
  minWidth?: number;
  rotation?: number; // 0, 90, 180, 270
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
