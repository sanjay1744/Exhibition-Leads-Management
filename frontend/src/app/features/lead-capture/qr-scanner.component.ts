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
    <div class="card-panel p-0 overflow-hidden h-full flex flex-col justify-between hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 bg-white border border-slate-200/80 rounded-2xl shadow-xs">
      <div>
        <!-- Header with Rich Navy Gradient (#1a3a5c) -->
        <div class="bg-gradient-to-r from-[#142e4a] via-[#1a3a5c] to-[#204770] text-white p-3.5 px-4 flex items-center justify-between shadow-xs border-b border-white/10">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center shrink-0 backdrop-blur-xs">
              <span class="material-icons text-blue-200 text-lg">qr_code_scanner</span>
            </div>
            <div>
              <h3 class="text-xs font-bold uppercase tracking-wider text-white">QR Code / vCard</h3>
              <p class="text-[10px] text-blue-200/80 font-medium">Badge & Contact File</p>
            </div>
          </div>
          <span class="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-400/20 text-emerald-200 border border-emerald-300/30">vCard / QR</span>
        </div>

        <div class="p-4 space-y-3">
          <p class="text-xs text-slate-500 leading-relaxed">Scan visitor badge QR code or upload vCard.</p>

          <!-- Quick Action Buttons -->
          <div class="grid grid-cols-1 gap-2.5">
            <button 
              type="button"
              (click)="openCameraModal()" 
              class="w-full justify-center text-xs py-2.5 px-4 rounded-xl font-extrabold shadow-sm hover:shadow-md flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white active:scale-[0.98] transition-all cursor-pointer"
            >
              <span class="material-icons text-base">photo_camera</span>
              <span>Scan via Camera</span>
            </button>

            <label class="cursor-pointer block border border-dashed border-blue-200/80 hover:border-blue-500 rounded-xl p-3 text-center bg-blue-50/20 hover:bg-blue-50/70 transition-all duration-200 group shadow-2xs">
              <input 
                type="file" 
                accept="image/*,.vcf,.vcard,.txt" 
                (change)="onFileSelected($event)" 
                class="hidden"
                [disabled]="isScanningFile()"
              />
              <div class="flex items-center justify-center gap-2 text-xs font-bold text-blue-700 group-hover:text-blue-900">
                @if (isScanningFile()) {
                  <span class="material-icons text-base animate-spin text-blue-600">sync</span>
                  <span>Processing file...</span>
                } @else {
                  <span class="material-icons text-base text-blue-600 group-hover:scale-110 transition-transform">upload_file</span>
                  <span>Upload File / Image</span>
                }
              </div>
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
      <div class="fixed inset-0 bg-slate-900/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-fadeIn relative">
          <div class="flex items-center justify-between border-b pb-3 mb-4">
            <div class="flex items-center gap-2">
              <span class="material-icons text-blue-600">qr_code_scanner</span>
              <div>
                <h3 class="text-base font-bold text-slate-900">Scan QR Code / vCard Badge</h3>
                <p class="text-[11px] text-slate-400">Position QR code or vCard inside the scanning reticle</p>
              </div>
            </div>
            <button (click)="closeCameraModal()" class="text-slate-400 hover:text-slate-600">
              <span class="material-icons">close</span>
            </button>
          </div>

          <!-- Camera Stream Container -->
          <div class="relative bg-slate-950 rounded-xl overflow-hidden min-h-[320px] h-[350px] w-full flex items-center justify-center border border-slate-800 shadow-inner">
            <div id="qr-scanner-viewport" class="w-full h-full min-h-[320px] [&_#qr-shaded-region]:!hidden"></div>

            <!-- Central Visual Target Reticle & Scan Laser Animation -->
            <div class="absolute inset-0 pointer-events-none flex items-center justify-center z-10">
              <div class="w-[85%] h-[85%] border-2 border-blue-400/80 border-dashed rounded-2xl shadow-[0_0_30px_rgba(59,130,246,0.5)] relative flex items-center justify-center">
                <!-- Top Corner Brackets -->
                <div class="absolute -top-1 -left-1 w-7 h-7 border-t-4 border-l-4 border-blue-400 rounded-tl-lg"></div>
                <div class="absolute -top-1 -right-1 w-7 h-7 border-t-4 border-r-4 border-blue-400 rounded-tr-lg"></div>
                <!-- Bottom Corner Brackets -->
                <div class="absolute -bottom-1 -left-1 w-7 h-7 border-b-4 border-l-4 border-blue-400 rounded-bl-lg"></div>
                <div class="absolute -bottom-1 -right-1 w-7 h-7 border-b-4 border-r-4 border-blue-400 rounded-br-lg"></div>

                <!-- Animated Scan Laser -->
                <div class="w-full h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-pulse shadow-[0_0_12px_#38bdf8]"></div>
              </div>
            </div>

            @if (isStartingCamera()) {
              <div class="absolute inset-0 bg-slate-900 flex flex-col items-center justify-center text-white text-xs gap-2 z-20">
                <span class="material-icons text-3xl animate-spin text-blue-400">sync</span>
                <span>Initializing HD Camera & Multi-Engine Decoder...</span>
              </div>
            }

            @if (cameraError()) {
              <div class="absolute inset-0 bg-slate-900/95 p-4 flex flex-col items-center justify-center text-center text-white text-xs gap-2 z-20">
                <span class="material-icons text-red-400 text-3xl">videocam_off</span>
                <span class="font-bold text-red-200">{{ cameraError() }}</span>
                <button 
                  (click)="startCameraScanner()" 
                  class="mt-2 bg-blue-600 text-white font-bold px-3 py-1.5 rounded-lg text-xs hover:bg-blue-700 transition"
                >
                  Retry Camera
                </button>
              </div>
            }
          </div>

          <div class="mt-4 flex items-center justify-between text-xs text-slate-600">
            <div class="flex items-center gap-2">
              @if (availableCameras().length > 1) {
                <span class="text-[11px] font-bold text-slate-500">Camera:</span>
                <select 
                  [ngModel]="selectedCameraId()" 
                  (ngModelChange)="onCameraSelectChange($event)"
                  class="text-xs bg-slate-100 border border-slate-300 text-slate-800 font-semibold rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-blue-500 max-w-[200px]"
                >
                  @for (cam of availableCameras(); track cam.id) {
                    <option [value]="cam.id">{{ cam.label || 'Camera ' + ($index + 1) }}</option>
                  }
                </select>
              } @else {
                <span class="flex items-center gap-1 text-[11px] text-slate-500 font-medium">
                  <span class="material-icons text-blue-500 text-sm">center_focus_strong</span>
                  Hold phone QR inside frame; system scans full video
                </span>
              }
            </div>
            <button 
              type="button" 
              (click)="closeCameraModal()" 
              class="px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition"
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

            <div>
              <div class="flex items-center justify-between mb-1">
                <label class="block text-xs font-bold text-slate-700">Phone / Mobile Numbers</label>
                @if (modalPhoneNumbers.length < 3) {
                  <button type="button" (click)="addModalPhoneInput()" class="text-[11px] text-blue-600 hover:text-blue-800 font-bold flex items-center gap-0.5 px-1.5 py-0.5 rounded hover:bg-blue-50">
                    <span class="material-icons text-xs">add</span> Add Phone
                  </button>
                }
              </div>
              <div class="space-y-1.5">
                @for (ph of modalPhoneNumbers; track $index) {
                  <div class="flex items-center gap-1.5">
                    <input 
                      type="text" 
                      [(ngModel)]="modalPhoneNumbers[$index]" 
                      class="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-medium" 
                      [placeholder]="$index === 0 ? '+91 98765 43210 (Primary Phone)' : '+91 0422 2967078 (Phone ' + ($index + 1) + ')'" 
                    />
                    @if ($index > 0) {
                      <button type="button" (click)="removeModalPhoneInput($index)" title="Remove phone" class="p-1 text-slate-400 hover:text-red-600 rounded">
                        <span class="material-icons text-base">delete_outline</span>
                      </button>
                    }
                  </div>
                }
              </div>
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
              <input type="email" [(ngModel)]="modalData.email" class="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="sarah@cyberdyne.io" />
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

  availableCameras = signal<Array<{ id: string; label: string }>>([]);
  selectedCameraId = signal<string | null>(null);

  isScanningFile = signal(false);
  lastScannedData = signal<QrParsedContact | null>(null);

  showModal = signal(false);
  modalData: QrParsedContact = {};

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

      // Enumerate camera devices
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

      // Strategy 1: Direct native BarcodeDetector scan on live HD video element
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

      // Strategy 2: High-contrast binarized canvas frame scan to eliminate phone screen glare
      if (ctx) {
        isProcessingCanvas = true;
        try {
          const w = videoEl.videoWidth || 640;
          const h = videoEl.videoHeight || 480;
          canvas.width = w;
          canvas.height = h;
          ctx.drawImage(videoEl, 0, 0, w, h);

          // Apply contrast thresholding for phone screens with reflection
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
          // Ignore frame processing errors
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

