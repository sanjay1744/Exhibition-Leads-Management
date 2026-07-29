import { Component, EventEmitter, Output, signal, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Html5Qrcode } from 'html5-qrcode';
import { VCardParserService, QrParsedContact } from '../../core/services/vcard-parser.service';

export { QrParsedContact };

@Component({
  selector: 'app-qr-scanner',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="card-panel p-0 overflow-hidden h-full flex flex-col justify-between hover:shadow-md transition bg-white border border-slate-200 rounded-xl">
      <div>
        <!-- Header with Table Blue (#1a3a5c) theme -->
        <div class="bg-[#1a3a5c] text-white p-3.5 px-4 flex items-center justify-between shadow-xs">
          <div class="flex items-center gap-2">
            <span class="material-icons text-blue-300 text-lg">qr_code_scanner</span>
            <h3 class="text-xs font-bold uppercase tracking-wider text-white">QR Code / vCard</h3>
          </div>
        </div>

        <div class="p-4">
          <p class="text-xs text-slate-500 mb-3">Scan visitor badge QR, vCard image, or upload .vcf contact files.</p>

          <!-- Quick Action Buttons -->
          <div class="grid grid-cols-1 gap-2 mb-2">
            <button 
              type="button"
              (click)="openCameraModal()" 
              class="btn btn-primary w-full justify-center text-xs py-2.5 rounded-lg font-bold shadow-sm flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
            >
              <span class="material-icons text-sm">photo_camera</span>
              Scan via Camera
            </button>

            <label class="cursor-pointer block border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-lg p-2.5 text-center bg-slate-50 hover:bg-blue-50/50 transition">
              <input 
                type="file" 
                accept="image/*,.vcf,.vcard,.txt" 
                (change)="onFileSelected($event)" 
                class="hidden"
                [disabled]="isScanningFile()"
              />
              <div class="flex items-center justify-center gap-1.5 text-xs font-semibold text-blue-600">
                @if (isScanningFile()) {
                  <span class="material-icons text-sm animate-spin text-blue-600">sync</span>
                  <span>Processing QR / .vcf file...</span>
                } @else {
                  <span class="material-icons text-sm">upload_file</span>
                  <span>Upload QR Image or .vcf File</span>
                }
              </div>
              <span class="text-[10px] text-slate-400 block mt-0.5">JPG, PNG, WebP, or .VCF / .VCARD file</span>
            </label>
          </div>
        </div>
      </div>

      <!-- Hidden container required for Html5Qrcode file decoding engine -->
      <div id="temp-qr-file-reader" class="hidden"></div>

      <!-- Scanned Success Preview Pill -->
      @if (lastScannedData() && !showModal() && !showCameraModal()) {
        <div class="mt-3 bg-blue-50/60 border border-blue-200 rounded-lg p-3">
          <div class="flex items-center justify-between mb-1 pb-1 border-b border-blue-100">
            <span class="text-xs font-bold text-blue-900 flex items-center gap-1">
              <span class="material-icons text-sm text-blue-600">verified</span>
              Scanned {{ lastScannedData()?.format || 'vCard' }} Info
            </span>
            <button 
              type="button"
              (click)="openReviewModal(lastScannedData()!)"
              class="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-0.5"
            >
              <span class="material-icons text-xs">edit</span> Review
            </button>
          </div>

          <div class="space-y-0.5 text-xs text-slate-700">
            @if (lastScannedData()?.name) {
              <div class="font-bold text-slate-900 flex items-center gap-1">
                <span class="material-icons text-slate-400 text-xs">person</span>
                {{ lastScannedData()?.name }}
              </div>
            }
            @if (lastScannedData()?.company) {
              <div class="text-slate-600 flex items-center gap-1">
                <span class="material-icons text-slate-400 text-xs">business</span>
                {{ lastScannedData()?.company }}
              </div>
            }
            @if (lastScannedData()?.phone) {
              <div class="text-slate-600 flex items-center gap-1">
                <span class="material-icons text-slate-400 text-xs">call</span>
                {{ lastScannedData()?.phone }}
              </div>
            }
          </div>

          <button 
            type="button" 
            (click)="applyData(lastScannedData()!)"
            class="w-full mt-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-1.5 px-3 rounded-md transition shadow-xs flex items-center justify-center gap-1"
          >
            <span class="material-icons text-xs">bolt</span> Auto-Fill Lead Form
          </button>
        </div>
      }
    </div>

    <!-- Live Camera Scanner Modal -->
    @if (showCameraModal()) {
      <div class="fixed inset-0 bg-slate-900/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-fadeIn relative">
          <div class="flex items-center justify-between border-b pb-3 mb-4">
            <div class="flex items-center gap-2">
              <span class="material-icons text-blue-600">qr_code_scanner</span>
              <h3 class="text-base font-bold text-slate-900">Scan QR Code / vCard Badge</h3>
            </div>
            <button (click)="closeCameraModal()" class="text-slate-400 hover:text-slate-600">
              <span class="material-icons">close</span>
            </button>
          </div>

          <!-- Camera Stream Container -->
          <div class="relative bg-slate-900 rounded-xl overflow-hidden min-h-[260px] flex items-center justify-center border border-slate-800">
            <div id="qr-scanner-viewport" class="w-full h-full"></div>

            @if (isStartingCamera()) {
              <div class="absolute inset-0 bg-slate-900 flex flex-col items-center justify-center text-white text-xs gap-2">
                <span class="material-icons text-3xl animate-spin text-blue-400">sync</span>
                <span>Initializing Camera...</span>
              </div>
            }

            @if (cameraError()) {
              <div class="absolute inset-0 bg-slate-900/90 p-4 flex flex-col items-center justify-center text-center text-white text-xs gap-2">
                <span class="material-icons text-red-400 text-3xl">videocam_off</span>
                <span class="font-bold text-red-200">{{ cameraError() }}</span>
                <button 
                  (click)="startCameraScanner()" 
                  class="mt-2 bg-blue-600 text-white font-bold px-3 py-1.5 rounded-lg text-xs"
                >
                  Retry Camera
                </button>
              </div>
            }
          </div>

          <div class="mt-4 flex items-center justify-between text-xs text-slate-500">
            <span class="flex items-center gap-1">
              <span class="material-icons text-blue-500 text-sm">center_focus_strong</span>
              Align QR Code within the frame
            </span>
            <button 
              type="button" 
              (click)="closeCameraModal()" 
              class="px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Review & Edit Scanned Data Modal -->
    @if (showModal()) {
      <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-fadeIn">
          <div class="flex items-center justify-between border-b pb-3 mb-4">
            <div class="flex items-center gap-2">
              <span class="material-icons text-blue-600">verified</span>
              <h3 class="text-base font-bold text-slate-900">Review Scanned Details</h3>
            </div>
            <button (click)="closeEditModal()" class="text-slate-400 hover:text-slate-600">
              <span class="material-icons">close</span>
            </button>
          </div>

          <div class="space-y-3 max-h-80 overflow-y-auto pr-1">
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">Full Name</label>
              <input type="text" [(ngModel)]="modalData.name" class="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="e.g. Sarah Connor" />
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">Designation / Role</label>
              <input type="text" [(ngModel)]="modalData.designation" class="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="e.g. Operations Director" />
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">Company Name</label>
              <input type="text" [(ngModel)]="modalData.company" class="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="e.g. Cyberdyne Systems" />
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">Mobile / Phone</label>
                <input type="text" [(ngModel)]="modalData.phone" class="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="+91 9876543210" />
              </div>

              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
                <input type="email" [(ngModel)]="modalData.email" class="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="sarah@cyberdyne.io" />
              </div>
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">Website URL</label>
              <input type="text" [(ngModel)]="modalData.website" class="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="www.cyberdyne.io" />
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">Address / Location</label>
              <input type="text" [(ngModel)]="modalData.address" class="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="City, State, Country" />
            </div>
          </div>

          <div class="mt-6 flex items-center justify-end gap-2 border-t pt-4">
            <button type="button" (click)="closeEditModal()" class="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
            <button type="button" (click)="saveAndApplyModal()" class="px-5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-md flex items-center gap-1">
              <span class="material-icons text-xs">check</span> Confirm & Auto-Fill Form
            </button>
          </div>
        </div>
      </div>
    }
  `
})
export class QrScannerComponent implements OnDestroy {
  private parser = inject(VCardParserService);

  @Output() qrScanned = new EventEmitter<QrParsedContact>();

  showCameraModal = signal(false);
  isStartingCamera = signal(false);
  cameraError = signal<string | null>(null);

  isScanningFile = signal(false);
  lastScannedData = signal<QrParsedContact | null>(null);

  showModal = signal(false);
  modalData: QrParsedContact = {};

  private html5QrCode: Html5Qrcode | null = null;

  async openCameraModal(): Promise<void> {
    this.showCameraModal.set(true);
    this.cameraError.set(null);
    setTimeout(() => this.startCameraScanner(), 200);
  }

  async closeCameraModal(): Promise<void> {
    await this.stopCameraScanner();
    this.showCameraModal.set(false);
  }

  async startCameraScanner(): Promise<void> {
    this.isStartingCamera.set(true);
    this.cameraError.set(null);

    try {
      if (this.html5QrCode) {
        await this.stopCameraScanner();
      }

      this.html5QrCode = new Html5Qrcode("qr-scanner-viewport");

      const config = {
        fps: 10,
        qrbox: { width: 220, height: 220 },
        aspectRatio: 1.0
      };

      await this.html5QrCode.start(
        { facingMode: "environment" },
        config,
        (decodedText: string) => {
          this.onQrCodeDecoded(decodedText);
        },
        () => {}
      );
      this.isStartingCamera.set(false);
    } catch (err: any) {
      console.error("QR Camera error:", err);
      this.isStartingCamera.set(false);
      this.cameraError.set(err?.message || "Could not access camera. Ensure camera permissions are allowed.");
    }
  }

  private async stopCameraScanner(): Promise<void> {
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

    // 1. Direct .vcf / .vcard / .txt contact file support
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

    // 2. Multi-Strategy Image QR scanner
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

    // Strategy 1: Direct raw file scan
    const res1 = await tryScan(file, true);
    if (res1) return res1;

    // Strategy 2: Canvas quiet-zone padding (25% white border margin around image + scaling)
    const paddedFile = await this.createPaddedQrImageFile(file, 0.25, 1200, false);
    const res2 = await tryScan(paddedFile, true);
    if (res2) return res2;

    // Strategy 3: Non-rendered padded scan
    const res3 = await tryScan(paddedFile, false);
    if (res3) return res3;

    // Strategy 4: Binarized high-contrast canvas with quiet-zone padding
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

  openReviewModal(data: QrParsedContact): void {
    this.modalData = { ...data };
    this.showModal.set(true);
  }

  closeEditModal(): void {
    this.showModal.set(false);
  }

  saveAndApplyModal(): void {
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
    this.stopCameraScanner();
  }
}
