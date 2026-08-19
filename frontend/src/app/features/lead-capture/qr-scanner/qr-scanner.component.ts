import { Component, EventEmitter, Output, signal, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Html5Qrcode } from 'html5-qrcode';
import { VCardParserService, QrParsedContact } from '../../../core/services/vcard-parser.service';

export { QrParsedContact };

@Component({
  selector: 'app-qr-scanner',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './qr-scanner.component.html',
  styleUrl: './qr-scanner.component.css'
})
export class QrScannerComponent implements OnDestroy {
  private parser = inject(VCardParserService);

  @Output() qrScanned = new EventEmitter<QrParsedContact>();

  showCameraModal = signal(false);
  isStartingCamera = signal(false);
  cameraError = signal<string | null>(null);

  availableCameras = signal<Array<{ id: string; label: string }>>([]);
  selectedCameraId = signal<string | null>(null);

  isScanningFile = signal(false);
  lastScannedData = signal<QrParsedContact | null>(null);

  showModal = signal(false);
  modalData: QrParsedContact = {};

  reset(): void {
    this.lastScannedData.set(null);
    this.modalData = {};
  }

  private html5QrCode: Html5Qrcode | null = null;
  private nativeBarcodeCheckInterval: any = null;

  async openCameraModal(): Promise<void> {
    this.showCameraModal.set(true);
    this.cameraError.set(null);
    setTimeout(() => this.startCameraScanner(), 200);
  }

  async closeCameraModal(): Promise<void> {
    this.stopNativeBarcodeDetectorLoop();
    await this.stopCameraScanner();
    this.showCameraModal.set(false);
  }

  async onCameraSelectChange(deviceId: string): Promise<void> {
    this.selectedCameraId.set(deviceId);
    await this.startCameraScanner(deviceId);
  }

  async startCameraScanner(targetDeviceId?: string): Promise<void> {
    this.isStartingCamera.set(true);
    this.cameraError.set(null);

    try {
      this.stopNativeBarcodeDetectorLoop();

      if (this.html5QrCode) {
        await this.stopCameraScanner();
      }

      try {
        const cameras = await Html5Qrcode.getCameras();
        this.availableCameras.set(cameras || []);
        if (cameras && cameras.length > 0 && !targetDeviceId && !this.selectedCameraId()) {
          const backCam = cameras.find(c => c.label.toLowerCase().includes('back') || c.label.toLowerCase().includes('environment') || c.label.toLowerCase().includes('rear'));
          const initialId = backCam ? backCam.id : cameras[0].id;
          this.selectedCameraId.set(initialId);
          targetDeviceId = initialId;
        }
      } catch (camErr) {
        console.warn("Could not query camera devices:", camErr);
      }

      const activeId = targetDeviceId || this.selectedCameraId();
      this.html5QrCode = new Html5Qrcode("qr-scanner-viewport");

      const config = {
        fps: 20,
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          const minDim = Math.min(viewfinderWidth, viewfinderHeight);
          const size = Math.max(180, Math.floor(minDim * 0.9));
          return { width: size, height: size };
        },
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true
        }
      };

      try {
        if (activeId) {
          await this.html5QrCode.start(
            activeId,
            config,
            (decodedText: string) => this.onQrCodeDecoded(decodedText),
            () => {}
          );
        } else {
          await this.html5QrCode.start(
            { facingMode: "environment" },
            config,
            (decodedText: string) => this.onQrCodeDecoded(decodedText),
            () => {}
          );
        }
      } catch (primaryErr) {
        console.warn("Camera start failed with primary constraint, attempting fallback:", primaryErr);
        try {
          await this.html5QrCode.start(
            { facingMode: "user" },
            config,
            (decodedText: string) => this.onQrCodeDecoded(decodedText),
            () => {}
          );
        } catch (userErr) {
          const cameras = await Html5Qrcode.getCameras();
          if (cameras && cameras.length > 0) {
            await this.html5QrCode.start(
              cameras[0].id,
              config,
              (decodedText: string) => this.onQrCodeDecoded(decodedText),
              () => {}
            );
          } else {
            throw userErr;
          }
        }
      }

      this.isStartingCamera.set(false);
      this.startNativeBarcodeDetectorLoop();
    } catch (err: any) {
      console.error("QR Camera error:", err);
      this.isStartingCamera.set(false);
      this.cameraError.set(err?.message || "Could not access camera. Ensure camera permissions are allowed.");
    }
  }

  private startNativeBarcodeDetectorLoop(): void {
    this.stopNativeBarcodeDetectorLoop();

    const hasBarcodeDetector = 'BarcodeDetector' in window;
    let detector: any = null;
    if (hasBarcodeDetector) {
      try {
        detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
      } catch (e) {
        console.warn("BarcodeDetector constructor error:", e);
      }
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    let isProcessingCanvas = false;

    this.nativeBarcodeCheckInterval = setInterval(async () => {
      if (!this.showCameraModal() || this.isStartingCamera() || isProcessingCanvas) return;

      const videoEl = document.querySelector('#qr-scanner-viewport video') as HTMLVideoElement;
      if (!videoEl || videoEl.paused || videoEl.ended || videoEl.readyState < 2) return;

      if (detector) {
        try {
          const barcodes = await detector.detect(videoEl);
          if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
            this.stopNativeBarcodeDetectorLoop();
            this.onQrCodeDecoded(barcodes[0].rawValue);
            return;
          }
        } catch {}
      }

      if (ctx) {
        isProcessingCanvas = true;
        try {
          const w = videoEl.videoWidth || 640;
          const h = videoEl.videoHeight || 480;
          canvas.width = w;
          canvas.height = h;
          ctx.drawImage(videoEl, 0, 0, w, h);

          const imgData = ctx.getImageData(0, 0, w, h);
          const d = imgData.data;
          for (let i = 0; i < d.length; i += 4) {
            const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
            const val = lum > 128 ? 255 : 0;
            d[i] = val;
            d[i + 1] = val;
            d[i + 2] = val;
          }
          ctx.putImageData(imgData, 0, 0);

          if (detector) {
            const binarizedBarcodes = await detector.detect(canvas);
            if (binarizedBarcodes && binarizedBarcodes.length > 0 && binarizedBarcodes[0].rawValue) {
              this.stopNativeBarcodeDetectorLoop();
              this.onQrCodeDecoded(binarizedBarcodes[0].rawValue);
              return;
            }
          }
        } catch (e) {
        } finally {
          isProcessingCanvas = false;
        }
      }
    }, 280);
  }

  private stopNativeBarcodeDetectorLoop(): void {
    if (this.nativeBarcodeCheckInterval) {
      clearInterval(this.nativeBarcodeCheckInterval);
      this.nativeBarcodeCheckInterval = null;
    }
  }

  private async stopCameraScanner(): Promise<void> {
    this.stopNativeBarcodeDetectorLoop();
    if (this.html5QrCode) {
      try {
        if (this.html5QrCode.isScanning) {
          await this.html5QrCode.stop();
        }
        this.html5QrCode.clear();
      } catch (err) {
        console.warn("Failed to stop scanner gracefully:", err);
      } finally {
        this.html5QrCode = null;
      }
    }
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    const fileName = file.name.toLowerCase();

    if (fileName.endsWith('.vcf') || fileName.endsWith('.vcard') || fileName.endsWith('.txt') || file.type.includes('vcard') || file.type.includes('text')) {
      try {
        const textContent = await file.text();
        this.onQrCodeDecoded(textContent);
        input.value = '';
        return;
      } catch (err) {
        console.error('Error reading .vcf file text:', err);
      }
    }

    this.isScanningFile.set(true);
    try {
      const decodedText = await this.scanQrImageWithFallback(file);
      this.onQrCodeDecoded(decodedText);
    } catch (err) {
      console.error('QR Image Scan Error:', err);
      alert('No QR code could be detected in this image. Please try a clearer picture, or upload the .vcf file directly.');
    } finally {
      this.isScanningFile.set(false);
      input.value = '';
    }
  }

  private async scanQrImageWithFallback(file: File): Promise<string> {
    const tryScan = async (targetFile: File, render: boolean): Promise<string | null> => {
      let qrScanner: Html5Qrcode | null = null;
      try {
        qrScanner = new Html5Qrcode("temp-qr-file-reader");
        const res = await qrScanner.scanFile(targetFile, render);
        await qrScanner.clear();
        return res;
      } catch (e) {
        if (qrScanner) {
          try { await qrScanner.clear(); } catch {}
        }
        return null;
      }
    };

    const res1 = await tryScan(file, true);
    if (res1) return res1;

    const paddedFile = await this.createPaddedQrImageFile(file, 0.25, 1200, false);
    const res2 = await tryScan(paddedFile, true);
    if (res2) return res2;

    const res3 = await tryScan(paddedFile, false);
    if (res3) return res3;

    const binarizedFile = await this.createPaddedQrImageFile(file, 0.30, 1000, true);
    const res4 = await tryScan(binarizedFile, true);
    if (res4) return res4;

    throw new Error('All QR scanning strategies failed to find a valid QR payload.');
  }

  private async createPaddedQrImageFile(file: File, paddingPct: number, maxDimension: number, binarize: boolean): Promise<File> {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = dataUrl;
    });

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas unavailable');

    let width = img.width;
    let height = img.height;
    if (width > maxDimension || height > maxDimension) {
      if (width > height) {
        height = Math.round((height * maxDimension) / width);
        width = maxDimension;
      } else {
        width = Math.round((width * maxDimension) / height);
        height = maxDimension;
      }
    }

    const padding = Math.round(Math.max(width, height) * paddingPct);
    canvas.width = width + padding * 2;
    canvas.height = height + padding * 2;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, padding, padding, width, height);

    if (binarize) {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = imageData.data;
      for (let i = 0; i < d.length; i += 4) {
        const avg = (d[i] + d[i + 1] + d[i + 2]) / 3;
        const v = avg > 140 ? 255 : 0;
        d[i] = v;
        d[i + 1] = v;
        d[i + 2] = v;
      }
      ctx.putImageData(imageData, 0, 0);
    }

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject('Blob error')), 'image/png');
    });

    return new File([blob], 'enhanced_qr.png', { type: 'image/png' });
  }

  private onQrCodeDecoded(rawPayload: string): void {
    const parsed = this.parser.parseQrPayload(rawPayload);
    this.lastScannedData.set(parsed);
    this.closeCameraModal();
    this.openReviewModal(parsed);
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

  openReviewModal(data: QrParsedContact): void {
    this.modalData = { ...data };
    this.modalPhone = data.phone || '';
    this.showModal.set(true);
  }

  closeEditModal(): void {
    this.showModal.set(false);
  }

  saveAndApplyModal(): void {
    this.modalData.phone = this.modalPhone;
    const updated = { ...this.modalData };
    this.lastScannedData.set(updated);
    this.applyData(updated);
    this.closeEditModal();
  }

  applyData(data: QrParsedContact): void {
    this.qrScanned.emit(data);
  }

  simulateScan(): void {
    const mockVCard = `BEGIN:VCARD
VERSION:3.0
FN:Sarah Connor
N:Connor;Sarah;;;
ORG:Cyberdyne Systems
TITLE:Director of Security & Operations
TEL;TYPE=CELL:+91 9876500112
EMAIL:s.connor@cyberdyne.io
URL:www.cyberdyne.io
ADR;TYPE=WORK:;;Suite 404, Tech Park;Los Angeles;CA;90001;USA
END:VCARD`;

    const parsed = this.parser.parseQrPayload(mockVCard);
    this.lastScannedData.set(parsed);
    this.openReviewModal(parsed);
  }

  ngOnDestroy(): void {
    this.stopNativeBarcodeDetectorLoop();
    this.stopCameraScanner();
  }
}
