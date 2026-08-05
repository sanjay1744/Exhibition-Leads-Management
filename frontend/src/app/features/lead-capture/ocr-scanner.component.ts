import { Component, EventEmitter, Output, signal, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import type { Worker } from 'tesseract.js';
import { OcrPreprocessorService } from '../../core/services/ocr-preprocessor.service';
import { CardParserService, ExtractedCardData } from '../../core/services/card-parser.service';

export { ExtractedCardData };

@Component({
  selector: 'app-ocr-scanner',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="card-panel p-0 overflow-hidden h-full flex flex-col justify-between hover:shadow-md transition bg-white border border-slate-200 rounded-xl">
      <div>
        <!-- Header with Table Blue (#1a3a5c) theme -->
        <div class="bg-[#1a3a5c] text-white p-3.5 px-4 flex items-center justify-between shadow-xs">
          <div class="flex items-center gap-2">
            <span class="material-icons text-blue-300 text-lg">credit_card</span>
            <h3 class="text-xs font-bold uppercase tracking-wider text-white">Business Card OCR</h3>
          </div>
        </div>

        <div class="p-4">
          <p class="text-xs text-slate-500 mb-3">Snap horizontal or vertical cards to auto-extract contact details offline.</p>

          <!-- Quick Action Buttons -->
          <div class="grid grid-cols-1 gap-2 mb-2">
            <button 
              type="button"
              (click)="openCameraModal()" 
              class="btn btn-primary w-full justify-center text-xs py-2.5 rounded-lg font-bold shadow-sm flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
              [disabled]="isProcessing()"
            >
              <span class="material-icons text-sm">photo_camera</span>
              Scan via Camera (Auto-Snap Card)
            </button>

            <label class="cursor-pointer block border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-lg p-2.5 text-center bg-slate-50 hover:bg-blue-50/50 transition">
              <input 
                type="file" 
                accept="image/*" 
                capture="environment" 
                (change)="onFileSelected($event)" 
                class="hidden"
                [disabled]="isProcessing()"
              />
              <div class="flex items-center justify-center gap-1.5 text-xs font-semibold text-blue-600">
                <span class="material-icons text-sm">add_a_photo</span>
                <span>Upload Business Card Image</span>
              </div>
              <span class="text-[10px] text-slate-400 block mt-0.5">JPG, PNG, WebP up to 10MB</span>
            </label>
          </div>
        </div>

        <!-- Processing Progress Overlay -->
        @if (isProcessing()) {
          <div class="mx-4 mb-4 p-3 bg-blue-50/80 border border-blue-200 rounded-lg text-xs">
            <div class="flex items-center justify-between text-blue-800 font-semibold mb-1">
              <span class="flex items-center gap-1.5">
                <span class="material-icons animate-spin text-sm">sync</span>
                {{ statusMessage() }}
              </span>
              <span>{{ progressPercent() }}%</span>
            </div>
            <div class="w-full bg-blue-200 rounded-full h-1.5 overflow-hidden">
              <div class="bg-blue-600 h-1.5 rounded-full transition-all duration-300" [style.width.%]="progressPercent()"></div>
            </div>
          </div>
        }

        <!-- Enhanced Image & Extracted Preview -->
        @if (extractedData() && !isProcessing()) {
          <div class="mx-4 mb-4 bg-slate-50 border border-slate-200 rounded-lg p-3">
            <div class="flex items-center justify-between mb-2 pb-2 border-b border-slate-200">
              <span class="text-xs font-bold text-slate-800 flex items-center gap-1">
                <span class="material-icons text-sm text-emerald-600">check_circle</span>
                Extracted Card Info
              </span>
              <button 
                type="button"
                (click)="openEditModal()"
                class="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-0.5"
              >
                <span class="material-icons text-xs">edit</span> Review & Edit
              </button>
            </div>

            <div class="space-y-1 text-xs text-slate-700">
              @if (extractedData()?.name) {
                <div class="flex items-center gap-1 font-bold text-slate-900">
                  <span class="material-icons text-slate-400 text-xs">person</span>
                  {{ extractedData()?.name }}
                </div>
              }
              @if (extractedData()?.designation) {
                <div class="flex items-center gap-1 text-slate-600">
                  <span class="material-icons text-slate-400 text-xs">badge</span>
                  {{ extractedData()?.designation }}
                </div>
              }
              @if (extractedData()?.company) {
                <div class="flex items-center gap-1 text-slate-600">
                  <span class="material-icons text-slate-400 text-xs">business</span>
                  {{ extractedData()?.company }}
                </div>
              }
              @if (extractedData()?.phone) {
                <div class="flex items-center gap-1 text-slate-600">
                  <span class="material-icons text-slate-400 text-xs">phone</span>
                  {{ extractedData()?.phone }}
                </div>
              }
              @if (extractedData()?.email) {
                <div class="flex items-center gap-1 text-slate-600">
                  <span class="material-icons text-slate-400 text-xs">email</span>
                  {{ extractedData()?.email }}
                </div>
              }
              @if (extractedData()?.website) {
                <div class="flex items-center gap-1 text-slate-600">
                  <span class="material-icons text-slate-400 text-xs">language</span>
                  {{ extractedData()?.website }}
                </div>
              }
            </div>

            <button 
              type="button" 
              (click)="applyData()"
              class="w-full mt-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-1.5 px-3 rounded-md transition shadow-xs flex items-center justify-center gap-1"
            >
              <span class="material-icons text-xs">bolt</span> Auto-Fill Lead Form
            </button>
          </div>
        }
      </div>
    </div>

    <!-- Live Camera Card Viewport Modal -->
    @if (showCameraModal()) {
      <div class="fixed inset-0 bg-slate-900/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-fadeIn relative">
          <div class="flex items-center justify-between border-b pb-3 mb-4">
            <div class="flex items-center gap-2">
              <span class="material-icons text-blue-600">photo_camera</span>
              <div>
                <h3 class="text-base font-bold text-slate-900">Real Card Auto-Snap Scanner</h3>
                <p class="text-[11px] text-slate-400">Position business card inside frame; system auto-snaps on card detection</p>
              </div>
            </div>
            <button (click)="closeCameraModal()" class="text-slate-400 hover:text-slate-600">
              <span class="material-icons">close</span>
            </button>
          </div>

          <!-- Camera Stream Container -->
          <div class="relative bg-slate-950 rounded-xl overflow-hidden aspect-[4/3] max-h-[360px] w-full flex items-center justify-center border border-slate-800 shadow-inner">
            <video id="ocr-camera-viewport" autoplay playsinline class="w-full h-full object-cover bg-slate-950"></video>

            <!-- Top Horizontal Dark Block -->
            <div class="absolute top-0 left-0 right-0 h-[18%] bg-slate-950/85 backdrop-blur-[1px] pointer-events-none z-10 border-b border-white/10 flex items-center justify-center">
              <span class="text-[10px] text-slate-300 font-semibold tracking-wider uppercase">Business Card Scanner</span>
            </div>

            <!-- Bottom Horizontal Dark Block -->
            <div class="absolute bottom-0 left-0 right-0 h-[18%] bg-slate-950/85 backdrop-blur-[1px] pointer-events-none z-10 border-t border-white/10 flex items-center justify-center">
              <span class="text-[10px] text-slate-400 font-medium">Keep card horizontal & aligned inside frame</span>
            </div>

            <!-- Central Visual Card Target Reticle Box -->
            <div 
              id="ocr-card-reticle-box"
              class="absolute left-[6%] right-[6%] top-[18%] bottom-[18%] rounded-xl pointer-events-none transition-all duration-300 flex flex-col justify-between p-3 z-20"
              [ngClass]="cardAligned() ? 'border-4 border-emerald-400 shadow-[0_0_35px_rgba(52,211,153,0.9)] bg-emerald-950/10' : 'border-2 border-dashed border-blue-400 shadow-[0_0_20px_rgba(0,0,0,0.8)]'"
            >
              <!-- Top Corner Brackets -->
              <div class="w-full flex justify-between">
                <div class="w-7 h-7 border-t-4 border-l-4 rounded-tl-md transition-colors duration-300" [ngClass]="cardAligned() ? 'border-emerald-400' : 'border-blue-400'"></div>
                <div class="w-7 h-7 border-t-4 border-r-4 rounded-tr-md transition-colors duration-300" [ngClass]="cardAligned() ? 'border-emerald-400' : 'border-blue-400'"></div>
              </div>

              <!-- Status Badge in Center -->
              <div class="w-full flex justify-center">
                <div 
                  class="text-[11px] font-bold px-3.5 py-1 rounded-full uppercase tracking-wider backdrop-blur-md shadow-lg transition-all duration-300 flex items-center gap-1.5"
                  [ngClass]="cardAligned() ? 'bg-emerald-600 text-white animate-pulse' : 'bg-slate-900/90 text-blue-200 border border-blue-400/40'"
                >
                  @if (cardAligned()) {
                    <span class="material-icons text-sm">crop_free</span>
                    <span>REAL CARD DETECTED! AUTO-SNAPPING...</span>
                  } @else {
                    <span class="material-icons text-sm">filter_center_focus</span>
                    <span>ALIGN BUSINESS CARD INSIDE FRAME</span>
                  }
                </div>
              </div>

              <!-- Bottom Corner Brackets & Live Status -->
              <div class="w-full flex justify-between items-end">
                <div class="w-7 h-7 border-b-4 border-l-4 rounded-bl-md transition-colors duration-300" [ngClass]="cardAligned() ? 'border-emerald-400' : 'border-blue-400'"></div>
                <div class="text-[10px] text-white/90 bg-slate-900/90 px-2.5 py-0.5 rounded font-semibold backdrop-blur-xs border border-white/10">
                  {{ cameraStatus() }}
                </div>
                <div class="w-7 h-7 border-b-4 border-r-4 rounded-br-md transition-colors duration-300" [ngClass]="cardAligned() ? 'border-emerald-400' : 'border-blue-400'"></div>
              </div>
            </div>

            @if (isStartingCamera()) {
              <div class="absolute inset-0 bg-slate-900 flex flex-col items-center justify-center text-white text-xs gap-2 z-20">
                <span class="material-icons text-3xl animate-spin text-blue-400">sync</span>
                <span>Initializing Camera & Preview...</span>
              </div>
            }

            @if (cameraError()) {
              <div class="absolute inset-0 bg-slate-900/90 p-4 flex flex-col items-center justify-center text-center text-white text-xs gap-2 z-20">
                <span class="material-icons text-red-400 text-3xl">videocam_off</span>
                <span class="font-bold text-red-200">{{ cameraError() }}</span>
                <button 
                  (click)="startCamera()" 
                  class="mt-2 bg-blue-600 text-white font-bold px-3 py-1.5 rounded-lg text-xs"
                >
                  Retry Camera
                </button>
              </div>
            }
          </div>

          <div class="mt-4 flex items-center justify-between">
            <button 
              type="button" 
              (click)="closeCameraModal()" 
              class="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button 
              type="button"
              (click)="captureCardFromCamera()" 
              class="px-6 py-2.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md flex items-center gap-2 transition active:scale-95"
            >
              <span class="material-icons text-base">camera</span>
              Snap & Crop Card Now
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Review & Edit Modal with Single-Screen Inline Crop & Tilt Editor -->
    @if (showModal()) {
      <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-fadeIn max-h-[95vh] flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between border-b pb-3 mb-4">
              <div class="flex items-center gap-2">
                <span class="material-icons text-blue-600">auto_fix_high</span>
                <h3 class="text-base font-bold text-slate-900">Review OCR Extracted Data</h3>
              </div>
              <button (click)="closeEditModal()" class="text-slate-400 hover:text-slate-600">
                <span class="material-icons">close</span>
              </button>
            </div>

            <!-- Single-Screen Card Preview & Inline Crop/Tilt Container -->
            @if (previewDataUrl() || rawSourceDataUrl) {
              <div class="mb-4 flex flex-col items-center justify-center">
                
                <!-- STATE A: Standard Preview View -->
                @if (!isCroppingMode()) {
                  <div class="bg-slate-900/90 rounded-xl p-2.5 border border-slate-700/80 shadow-md inline-flex flex-col items-center justify-center relative max-w-full">
                    <img [src]="previewDataUrl()" alt="Card Preview" class="max-h-48 max-w-full object-contain rounded-lg border border-slate-800" />
                    
                    <div class="flex items-center gap-1.5 mt-2.5 flex-wrap justify-center">
                      <button 
                        type="button" 
                        (click)="enableInlineCropping()" 
                        class="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 font-bold shadow-xs transition"
                        title="Crop & Tilt photo directly on screen"
                      >
                        <span class="material-icons text-xs">crop_rotate</span> Crop & Tilt
                      </button>
                      <button 
                        type="button" 
                        (click)="rotateCard(-90)" 
                        class="bg-slate-800 hover:bg-slate-700 text-white text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition"
                        title="Rotate Left"
                      >
                        <span class="material-icons text-xs">rotate_left</span> 90° Left
                      </button>
                      <button 
                        type="button" 
                        (click)="rotateCard(90)" 
                        class="bg-slate-800 hover:bg-slate-700 text-white text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition"
                        title="Rotate Right"
                      >
                        <span class="material-icons text-xs">rotate_right</span> 90° Right
                      </button>
                      <button 
                        type="button" 
                        (click)="reScanCurrentOrientation()" 
                        class="bg-blue-600 hover:bg-blue-700 text-white text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1 font-bold transition"
                      >
                        <span class="material-icons text-xs">refresh</span> Re-Scan
                      </button>
                    </div>
                  </div>
                }

                <!-- STATE B: Inline Crop & Tilt Interactive Editor (No extra pop-up window!) -->
                @if (isCroppingMode()) {
                  <div class="bg-slate-900/95 rounded-xl p-3 border border-slate-700 shadow-xl w-full flex flex-col items-center gap-3">
                    
                    <div class="w-full flex items-center justify-between text-xs text-slate-300 font-bold border-b border-slate-800 pb-2">
                      <span class="flex items-center gap-1 text-emerald-400">
                        <span class="material-icons text-sm">crop_rotate</span> Drag Handles to Crop & Straighten
                      </span>
                      <span class="text-[11px] text-emerald-300 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/40">
                        Tilt: {{ cropTiltAngle() > 0 ? '+' : '' }}{{ cropTiltAngle() }}°
                      </span>
                    </div>

                    <!-- Interactive Image Viewport with Drag Overlay -->
                    <div class="relative bg-slate-950 rounded-lg p-2 min-h-[220px] max-h-[280px] w-full flex items-center justify-center border border-slate-800 shadow-inner overflow-hidden select-none">
                      <div 
                        #imageWrapper
                        class="relative inline-block overflow-hidden shadow-2xl rounded"
                      >
                        @if (tiltedImageSrc()) {
                          <img 
                            #cropImgElement
                            [src]="tiltedImageSrc()" 
                            alt="Card for Crop" 
                            class="max-h-[260px] max-w-full object-contain block pointer-events-none rounded"
                          />
                        }

                        <!-- Interactive Crop Box Overlay -->
                        <div 
                          class="absolute border-2 border-emerald-400 shadow-[0_0_0_9999px_rgba(15,23,42,0.7)] rounded-md pointer-events-auto flex items-center justify-center z-20"
                          [style.left.%]="cropX()"
                          [style.top.%]="cropY()"
                          [style.width.%]="cropW()"
                          [style.height.%]="cropH()"
                          (mousedown)="startCropDrag($event, 'move', imageWrapper)"
                          (touchstart)="startCropDrag($event, 'move', imageWrapper)"
                        >
                          <div class="w-full h-full border border-emerald-300/40 border-dashed pointer-events-none relative flex items-center justify-center">
                            <span class="material-icons text-white/70 text-base drop-shadow-md select-none">drag_pan</span>
                          </div>

                          <!-- 4 Corner Drag Handles -->
                          <div 
                            class="absolute -top-2 -left-2 w-4 h-4 bg-emerald-400 border-2 border-white rounded-full cursor-nwse-resize shadow-md hover:scale-125 transition-transform"
                            (mousedown)="startCropDrag($event, 'top-left', imageWrapper)"
                            (touchstart)="startCropDrag($event, 'top-left', imageWrapper)"
                          ></div>
                          <div 
                            class="absolute -top-2 -right-2 w-4 h-4 bg-emerald-400 border-2 border-white rounded-full cursor-nesw-resize shadow-md hover:scale-125 transition-transform"
                            (mousedown)="startCropDrag($event, 'top-right', imageWrapper)"
                            (touchstart)="startCropDrag($event, 'top-right', imageWrapper)"
                          ></div>
                          <div 
                            class="absolute -bottom-2 -left-2 w-4 h-4 bg-emerald-400 border-2 border-white rounded-full cursor-nesw-resize shadow-md hover:scale-125 transition-transform"
                            (mousedown)="startCropDrag($event, 'bottom-left', imageWrapper)"
                            (touchstart)="startCropDrag($event, 'bottom-left', imageWrapper)"
                          ></div>
                          <div 
                            class="absolute -bottom-2 -right-2 w-4 h-4 bg-emerald-400 border-2 border-white rounded-full cursor-nwse-resize shadow-md hover:scale-125 transition-transform"
                            (mousedown)="startCropDrag($event, 'bottom-right', imageWrapper)"
                            (touchstart)="startCropDrag($event, 'bottom-right', imageWrapper)"
                          ></div>
                        </div>
                      </div>
                    </div>

                    <!-- Inline Tilt Slider & Presets Toolbar -->
                    <div class="w-full space-y-2 text-xs">
                      <div class="flex items-center gap-2">
                        <span class="text-slate-400 text-xs font-bold">Tilt:</span>
                        <input 
                          type="range" 
                          min="-45" 
                          max="45" 
                          step="0.5" 
                          [ngModel]="cropTiltAngle()" 
                          (ngModelChange)="setTiltAngle($event)"
                          class="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                        />
                        <span class="text-emerald-400 font-bold min-w-[36px] text-right">{{ cropTiltAngle() > 0 ? '+' : '' }}{{ cropTiltAngle() }}°</span>
                      </div>

                      <div class="flex items-center justify-between gap-1 text-[11px] flex-wrap">
                        <div class="flex items-center gap-1">
                          <button type="button" (click)="setCropPreset('horizontal')" class="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-semibold border border-slate-700">Horizontal</button>
                          <button type="button" (click)="setCropPreset('vertical')" class="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-semibold border border-slate-700">Vertical</button>
                          <button type="button" (click)="setCropPreset('full')" class="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-semibold border border-slate-700">Full</button>
                        </div>
                        <div class="flex items-center gap-1">
                          <button type="button" (click)="rotateTiltBy(-90)" class="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-semibold border border-slate-700">-90°</button>
                          <button type="button" (click)="rotateTiltBy(90)" class="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-semibold border border-slate-700">+90°</button>
                          <button type="button" (click)="resetTilt()" class="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-semibold border border-slate-700">Reset</button>
                        </div>
                      </div>

                      <!-- Inline Action Buttons -->
                      <div class="flex items-center justify-between pt-2 border-t border-slate-800">
                        <button type="button" (click)="cancelInlineCropping()" class="px-3 py-1 text-slate-400 hover:text-white font-bold rounded">
                          Cancel
                        </button>
                        <button 
                          type="button" 
                          (click)="applyInlineCropAndScan()" 
                          class="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-md flex items-center gap-1 text-xs"
                        >
                          <span class="material-icons text-xs">auto_fix_high</span> Apply Crop & Re-Scan OCR
                        </button>
                      </div>
                    </div>

                  </div>
                }

              </div>
            }

            <div class="space-y-3 max-h-72 overflow-y-auto pr-1">
              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">Full Name</label>
                <input type="text" [(ngModel)]="modalData.name" class="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="e.g. Maria Olivia" />
              </div>

              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">Designation / Title</label>
                <input type="text" [(ngModel)]="modalData.designation" class="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="e.g. Manager / Director" />
              </div>

              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">Company Name</label>
                <input type="text" [(ngModel)]="modalData.company" class="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="e.g. Aurora Tech Pvt Ltd" />
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs font-bold text-slate-700 mb-1">Phone / Mobile</label>
                  <input type="text" [(ngModel)]="modalData.phone" class="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="+011 123 456 789" />
                </div>

                <div>
                  <label class="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
                  <input type="email" [(ngModel)]="modalData.email" class="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="maria.olivia@aurora.com" />
                </div>
              </div>

              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">Website URL</label>
                <input type="text" [(ngModel)]="modalData.website" class="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="www.aurora.com" />
              </div>

              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">Address / Office Location</label>
                <input type="text" [(ngModel)]="modalData.address" class="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Office location or address" />
              </div>
            </div>
          </div>

          <div class="mt-4 flex items-center justify-end gap-2 border-t pt-3">
            <button type="button" (click)="closeEditModal()" class="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
            <button type="button" (click)="saveAndApplyModal()" class="px-5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-md flex items-center gap-1">
              <span class="material-icons text-xs">check</span> Confirm & Apply
            </button>
          </div>
        </div>
      </div>
    }
  `
})
export class OcrScannerComponent implements OnDestroy {
  private preprocessor = inject(OcrPreprocessorService);
  private parser = inject(CardParserService);

  @Output() cardExtracted = new EventEmitter<ExtractedCardData>();

  isProcessing = signal(false);
  progressPercent = signal(0);
  statusMessage = signal('Preparing...');
  extractedData = signal<ExtractedCardData | null>(null);
  previewDataUrl = signal<string | null>(null);
  currentRotation = 0;
  rawSelectedFile: File | null = null;
  rawSourceDataUrl: string | null = null;

  showModal = signal(false);
  modalData: ExtractedCardData = {};

  showCameraModal = signal(false);
  isStartingCamera = signal(false);
  cameraError = signal<string | null>(null);
  cameraStatus = signal('Hold business card inside frame...');
  cardAligned = signal(false);

  // Single-Screen Inline Crop & Tilt State
  isCroppingMode = signal(false);
  cropImageSrc = signal<string | null>(null);
  tiltedImageSrc = signal<string | null>(null);
  cropTiltAngle = signal<number>(0);
  cropX = signal<number>(5);     // 5%
  cropY = signal<number>(5);     // 5%
  cropW = signal<number>(90);    // 90%
  cropH = signal<number>(90);    // 90%

  private mediaStream: MediaStream | null = null;
  private alignCheckInterval: any = null;
  private cardLockFrames = 0;
  private isCapturing = false;

  // Drag state for Crop overlay box
  private activeDragHandle: string | null = null;
  private dragStartX = 0;
  private dragStartY = 0;
  private dragInitX = 0;
  private dragInitY = 0;
  private dragInitW = 0;
  private dragInitH = 0;

  async openCameraModal(): Promise<void> {
    this.showCameraModal.set(true);
    this.cameraError.set(null);
    this.cardAligned.set(false);
    this.cameraStatus.set('Hold business card inside frame...');
    this.cardLockFrames = 0;
    this.isCapturing = false;
    setTimeout(() => this.startCamera(), 200);
  }

  async startCamera(): Promise<void> {
    this.isStartingCamera.set(true);
    this.cameraError.set(null);

    try {
      if (this.mediaStream) {
        this.stopCamera();
      }

      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
          aspectRatio: { ideal: 1.777 }
        }
      });

      const videoEl = document.getElementById('ocr-camera-viewport') as HTMLVideoElement;
      if (videoEl) {
        videoEl.srcObject = this.mediaStream;
        await videoEl.play();
      }
      this.isStartingCamera.set(false);
      this.startRealCardDetector();
    } catch (err: any) {
      console.error('OCR Camera error:', err);
      this.isStartingCamera.set(false);
      this.cameraError.set(err?.message || 'Could not access camera. Ensure camera permissions are allowed.');
    }
  }

  private startRealCardDetector(): void {
    this.stopRealCardDetector();
    this.alignCheckInterval = setInterval(() => {
      if (!this.showCameraModal() || this.isProcessing() || this.isCapturing) return;
      this.checkCardAlignmentAndAutoSnap();
    }, 280);
  }

  private stopRealCardDetector(): void {
    if (this.alignCheckInterval) {
      clearInterval(this.alignCheckInterval);
      this.alignCheckInterval = null;
    }
  }

  private checkCardAlignmentAndAutoSnap(): void {
    const videoEl = document.getElementById('ocr-camera-viewport') as HTMLVideoElement;
    if (!videoEl || !videoEl.videoWidth || videoEl.paused || videoEl.ended) return;

    try {
      const canvas = document.createElement('canvas');
      const W = 200;
      const H = 150;
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      ctx.drawImage(videoEl, 0, 0, W, H);
      const imgData = ctx.getImageData(0, 0, W, H);
      const d = imgData.data;

      const lum = (x: number, y: number): number => {
        const i = (y * W + x) * 4;
        return 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      };

      const rgb = (x: number, y: number): [number, number, number] => {
        const i = (y * W + x) * 4;
        return [d[i], d[i + 1], d[i + 2]];
      };

      const rLeft = Math.round(W * 0.06);
      const rRight = Math.round(W * 0.94);
      const rTop = Math.round(H * 0.18);
      const rBottom = Math.round(H * 0.82);
      const rW = rRight - rLeft;
      const rH = rBottom - rTop;
      const stripDepth = Math.max(4, Math.round(Math.min(rW, rH) * 0.08));

      let topEdgePixels = 0, topTotalPixels = 0;
      for (let x = rLeft + 5; x < rRight - 5; x += 2) {
        const outerY = Math.max(0, rTop - stripDepth);
        const innerY = rTop + stripDepth;
        if (Math.abs(lum(x, outerY) - lum(x, innerY)) > 35) topEdgePixels++;
        topTotalPixels++;
      }

      let bottomEdgePixels = 0, bottomTotalPixels = 0;
      for (let x = rLeft + 5; x < rRight - 5; x += 2) {
        const innerY = rBottom - stripDepth;
        const outerY = Math.min(H - 1, rBottom + stripDepth);
        if (Math.abs(lum(x, innerY) - lum(x, outerY)) > 35) bottomEdgePixels++;
        bottomTotalPixels++;
      }

      let leftEdgePixels = 0, leftTotalPixels = 0;
      for (let y = rTop + 5; y < rBottom - 5; y += 2) {
        const outerX = Math.max(0, rLeft - stripDepth);
        const innerX = rLeft + stripDepth;
        if (Math.abs(lum(outerX, y) - lum(innerX, y)) > 35) leftEdgePixels++;
        leftTotalPixels++;
      }

      let rightEdgePixels = 0, rightTotalPixels = 0;
      for (let y = rTop + 5; y < rBottom - 5; y += 2) {
        const innerX = rRight - stripDepth;
        const outerX = Math.min(W - 1, rRight + stripDepth);
        if (Math.abs(lum(innerX, y) - lum(outerX, y)) > 35) rightEdgePixels++;
        rightTotalPixels++;
      }

      const topRatio = topTotalPixels > 0 ? topEdgePixels / topTotalPixels : 0;
      const bottomRatio = bottomTotalPixels > 0 ? bottomEdgePixels / bottomTotalPixels : 0;
      const leftRatio = leftTotalPixels > 0 ? leftEdgePixels / leftTotalPixels : 0;
      const rightRatio = rightTotalPixels > 0 ? rightEdgePixels / rightTotalPixels : 0;

      const edgeThreshold = 0.40;
      const strongBorders = [
        topRatio >= edgeThreshold,
        bottomRatio >= edgeThreshold,
        leftRatio >= edgeThreshold,
        rightRatio >= edgeThreshold
      ].filter(Boolean).length;

      const hasRectangularBoundary = strongBorders >= 3;

      let skinPixels = 0, centerSamples = 0;
      const cxStart = rLeft + Math.round(rW * 0.2);
      const cxEnd = rLeft + Math.round(rW * 0.8);
      const cyStart = rTop + Math.round(rH * 0.2);
      const cyEnd = rTop + Math.round(rH * 0.8);

      for (let y = cyStart; y < cyEnd; y += 3) {
        for (let x = cxStart; x < cxEnd; x += 3) {
          const [r, g, b] = rgb(x, y);
          centerSamples++;
          if (r > 95 && g > 40 && b > 20 && r > g && r > b && (r - g) > 15 && Math.max(r, g, b) - Math.min(r, g, b) > 15) {
            skinPixels++;
          }
        }
      }
      const skinRatio = centerSamples > 0 ? skinPixels / centerSamples : 0;
      const isSkinDominated = skinRatio > 0.30;

      let innerLumSum = 0, innerLumCount = 0;
      for (let y = cyStart; y < cyEnd; y += 3) {
        for (let x = cxStart; x < cxEnd; x += 3) {
          innerLumSum += lum(x, y);
          innerLumCount++;
        }
      }
      const avgInnerLum = innerLumCount > 0 ? innerLumSum / innerLumCount : 0;
      const isBrightEnough = avgInnerLum >= 130;

      // 4. Calculate image sharpness via Laplacian Variance
      let sumLap = 0;
      let sumLapSq = 0;
      let countLap = 0;

      for (let y = rTop + 5; y < rBottom - 5; y += 3) {
        for (let x = rLeft + 5; x < rRight - 5; x += 3) {
          const lCenter = lum(x, y);
          const lap = 4 * lCenter - lum(x - 1, y) - lum(x + 1, y) - lum(x, y - 1) - lum(x, y + 1);
          sumLap += lap;
          sumLapSq += lap * lap;
          countLap++;
        }
      }
      const meanLap = countLap > 0 ? sumLap / countLap : 0;
      const lapVariance = countLap > 0 ? (sumLapSq / countLap) - (meanLap * meanLap) : 0;
      const isSharpEnough = lapVariance >= 45;

      const isRealCard = hasRectangularBoundary && !isSkinDominated && isBrightEnough && isSharpEnough;
      const debugInfo = `Borders:${strongBorders}/4 Skin:${(skinRatio * 100).toFixed(0)}% Sharp:${lapVariance.toFixed(0)}`;

      if (isRealCard) {
        this.cardLockFrames++;
        this.cardAligned.set(true);

        if (this.cardLockFrames >= 6) {
          this.cameraStatus.set('🎯 CARD DETECTED! AUTO-SNAPPING...');
          this.captureCardFromCamera();
        } else {
          this.cameraStatus.set(`Locking card... ${this.cardLockFrames}/6`);
        }
      } else {
        this.cardLockFrames = Math.max(0, this.cardLockFrames - 2);
        this.cardAligned.set(false);

        if (isSkinDominated) {
          this.cameraStatus.set(`Skin detected — hold a CARD, not face (${debugInfo})`);
        } else if (!hasRectangularBoundary) {
          this.cameraStatus.set(`No card edges found (${debugInfo})`);
        } else if (!isBrightEnough) {
          this.cameraStatus.set(`Too dark — add lighting (${debugInfo})`);
        } else if (!isSharpEnough) {
          this.cameraStatus.set(`Image too blurry — hold steady (${debugInfo})`);
        } else {
          this.cameraStatus.set(`Align card inside frame (${debugInfo})`);
        }
      }
    } catch {
      // Ignore sampling errors
    }
  }

  stopCamera(): void {
    this.stopRealCardDetector();
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
  }

  async closeCameraModal(): Promise<void> {
    this.stopCamera();
    this.showCameraModal.set(false);
  }

  async captureCardFromCamera(): Promise<void> {
    if (this.isCapturing) return;
    this.isCapturing = true;

    const videoEl = document.getElementById('ocr-camera-viewport') as HTMLVideoElement;
    if (!videoEl || !videoEl.videoWidth) {
      this.isCapturing = false;
      return;
    }

    try {
      const fullCanvas = document.createElement('canvas');
      fullCanvas.width = videoEl.videoWidth;
      fullCanvas.height = videoEl.videoHeight;
      const fullCtx = fullCanvas.getContext('2d');
      if (fullCtx) {
        fullCtx.drawImage(videoEl, 0, 0);
        this.rawSourceDataUrl = fullCanvas.toDataURL('image/jpeg', 0.95);
      }

      const cardCanvas = this.cropExactVisualReticleBox(videoEl);
      const blob = await new Promise<Blob | null>(resolve => cardCanvas.toBlob(resolve, 'image/jpeg', 0.95));
      if (!blob) return;

      const capturedFile = new File([blob], 'cropped_card_snap.jpg', { type: 'image/jpeg' });
      await this.closeCameraModal();
      this.rawSelectedFile = capturedFile;
      this.currentRotation = 0;
      await this.processCardPipeline(capturedFile, 0);
    } catch (err) {
      console.error('Camera card crop error:', err);
    } finally {
      this.isCapturing = false;
    }
  }

  private cropExactVisualReticleBox(videoEl: HTMLVideoElement): HTMLCanvasElement {
    const reticleEl = document.getElementById('ocr-card-reticle-box');
    const vWidth = videoEl.videoWidth;
    const vHeight = videoEl.videoHeight;

    let cropX = Math.round(vWidth * 0.08);
    let cropY = Math.round(vHeight * 0.14);
    let cropW = Math.round(vWidth * 0.84);
    let cropH = Math.round(vHeight * 0.72);

    if (reticleEl) {
      const vRect = videoEl.getBoundingClientRect();
      const rRect = reticleEl.getBoundingClientRect();

      if (vRect.width > 0 && vRect.height > 0) {
        const scaleX = vWidth / vRect.width;
        const scaleY = vHeight / vRect.height;

        cropX = Math.max(0, Math.round((rRect.left - vRect.left) * scaleX));
        cropY = Math.max(0, Math.round((rRect.top - vRect.top) * scaleY));
        cropW = Math.min(vWidth - cropX, Math.round(rRect.width * scaleX));
        cropH = Math.min(vHeight - cropY, Math.round(rRect.height * scaleY));
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = Math.max(600, Math.round(1200 * (cropH / (cropW || 1))));

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(
        videoEl,
        cropX, cropY, cropW, cropH,
        0, 0, canvas.width, canvas.height
      );
    }

    return canvas;
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    this.rawSelectedFile = input.files[0];
    this.currentRotation = 0;

    const reader = new FileReader();
    reader.onload = (e) => {
      this.rawSourceDataUrl = e.target?.result as string;
    };
    reader.readAsDataURL(this.rawSelectedFile);

    await this.processCardPipeline(this.rawSelectedFile, 0);
  }

  private async processCardPipeline(file: File, rotationDegrees: number): Promise<void> {
    this.isProcessing.set(true);
    this.progressPercent.set(10);
    this.statusMessage.set('Enhancing Card Image (Pass 1)...');

    try {
      const processed = await this.preprocessor.preprocessImage(file, {
        mode: 'natural',
        minWidth: 1600,
        rotation: rotationDegrees
      });
      this.previewDataUrl.set(processed.dataUrl);

      this.progressPercent.set(25);
      this.statusMessage.set('Recognizing Card Text (Pass 1)...');

      let res1 = await this.runTesseractOcr(processed.dataUrl);
      let parsedData1 = this.parser.parseCardText(res1.text, res1.lineMetadata);

      const matchedFieldCount = Object.values(parsedData1).filter(v => typeof v === 'string' && v.trim().length > 0).length;
      
      if (matchedFieldCount <= 1 && processed.height > processed.width && rotationDegrees === 0) {
        this.statusMessage.set('Vertical card detected, auto-rotating 90°...');
        const rotatedUrl = await this.preprocessor.rotateDataUrl(processed.dataUrl, 90);
        const rotRes = await this.runTesseractOcr(rotatedUrl);
        const rotParsed = this.parser.parseCardText(rotRes.text, rotRes.lineMetadata);

        const rotMatchCount = Object.values(rotParsed).filter(v => typeof v === 'string' && v.trim().length > 0).length;
        if (rotMatchCount > matchedFieldCount) {
          res1 = rotRes;
          parsedData1 = rotParsed;
          this.previewDataUrl.set(rotatedUrl);
          this.currentRotation = 90;
        }
      }

      // Pass 2: Multi-Pass Adaptive Contrast Binarization if fewer than 5 fields detected
      let finalParsedData = parsedData1;
      let currentFields = Object.values(parsedData1).filter(v => typeof v === 'string' && v.trim().length > 0).length;

      if (currentFields < 5) {
        this.statusMessage.set('Adaptive Binarization Pass (Pass 2)...');
        this.progressPercent.set(55);
        try {
          const contrastDataUrl = await this.preprocessor.createContrastBinarizedDataUrl(this.previewDataUrl()!);
          const res2 = await this.runTesseractOcr(contrastDataUrl);
          const parsedData2 = this.parser.parseCardText(res2.text, res2.lineMetadata);
          finalParsedData = this.parser.mergeCardData(finalParsedData, parsedData2);
          currentFields = Object.values(finalParsedData).filter(v => typeof v === 'string' && v.trim().length > 0).length;
        } catch {
          // fallback
        }
      }

      // Pass 3: Inverted Color Pass for light text on dark backgrounds if fields still < 5
      if (currentFields < 5) {
        this.statusMessage.set('Inverted Color Pass for Dark Backgrounds (Pass 3)...');
        this.progressPercent.set(80);
        try {
          const invertedDataUrl = await this.preprocessor.createInvertedContrastDataUrl(this.previewDataUrl()!);
          const res3 = await this.runTesseractOcr(invertedDataUrl);
          const parsedData3 = this.parser.parseCardText(res3.text, res3.lineMetadata);
          finalParsedData = this.parser.mergeCardData(finalParsedData, parsedData3);
        } catch {
          // fallback
        }
      }

      this.progressPercent.set(100);
      this.extractedData.set(finalParsedData);
      this.cardExtracted.emit(finalParsedData);
    } catch (err) {
      console.error('OCR Processing Error:', err);
      alert('OCR failed to read card image. Please try adjusting crop region in Review & Edit.');
    } finally {
      this.isProcessing.set(false);
    }
  }

  // --- SINGLE-SCREEN INLINE CROP & TILT METHODS ---

  async enableInlineCropping(): Promise<void> {
    const src = this.rawSourceDataUrl || this.previewDataUrl();
    if (!src) return;

    this.cropImageSrc.set(src);
    this.cropTiltAngle.set(this.currentRotation || 0);
    this.cropX.set(5);
    this.cropY.set(5);
    this.cropW.set(90);
    this.cropH.set(90);

    await this.updateTiltedSourceImage();
    this.isCroppingMode.set(true);
  }

  cancelInlineCropping(): void {
    this.isCroppingMode.set(false);
  }

  async setTiltAngle(deg: number): Promise<void> {
    this.cropTiltAngle.set(Math.round(deg * 10) / 10);
    await this.updateTiltedSourceImage();
  }

  async rotateTiltBy(deltaDeg: number): Promise<void> {
    let next = (this.cropTiltAngle() + deltaDeg) % 360;
    if (next > 180) next -= 360;
    if (next < -180) next += 360;
    this.cropTiltAngle.set(Math.round(next * 10) / 10);
    await this.updateTiltedSourceImage();
  }

  async resetTilt(): Promise<void> {
    this.cropTiltAngle.set(0);
    await this.updateTiltedSourceImage();
  }

  private async updateTiltedSourceImage(): Promise<void> {
    const src = this.cropImageSrc();
    if (!src) return;

    try {
      const tiltedUrl = await this.preprocessor.getTiltedDataUrl(src, this.cropTiltAngle());
      this.tiltedImageSrc.set(tiltedUrl);
    } catch {
      this.tiltedImageSrc.set(src);
    }
  }

  setCropPreset(preset: 'free' | 'horizontal' | 'vertical' | 'full'): void {
    if (preset === 'full') {
      this.cropX.set(0);
      this.cropY.set(0);
      this.cropW.set(100);
      this.cropH.set(100);
    } else if (preset === 'horizontal') {
      this.cropX.set(7.5);
      this.cropY.set(25);
      this.cropW.set(85);
      this.cropH.set(48.5);
    } else if (preset === 'vertical') {
      this.cropX.set(25.75);
      this.cropY.set(7.5);
      this.cropW.set(48.5);
      this.cropH.set(85);
    } else {
      this.cropX.set(5);
      this.cropY.set(5);
      this.cropW.set(90);
      this.cropH.set(90);
    }
  }

  startCropDrag(event: MouseEvent | TouchEvent, handle: string, imageWrapperEl: HTMLElement): void {
    event.preventDefault();
    event.stopPropagation();

    const clientX = 'touches' in event ? event.touches[0].clientX : (event as MouseEvent).clientX;
    const clientY = 'touches' in event ? event.touches[0].clientY : (event as MouseEvent).clientY;

    this.activeDragHandle = handle;
    this.dragStartX = clientX;
    this.dragStartY = clientY;
    this.dragInitX = this.cropX();
    this.dragInitY = this.cropY();
    this.dragInitW = this.cropW();
    this.dragInitH = this.cropH();

    const moveHandler = (e: MouseEvent | TouchEvent) => {
      if (!this.activeDragHandle) return;
      const cX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const cY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;

      const rect = imageWrapperEl.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      const deltaX = ((cX - this.dragStartX) / rect.width) * 100;
      const deltaY = ((cY - this.dragStartY) / rect.height) * 100;

      let newX = this.dragInitX;
      let newY = this.dragInitY;
      let newW = this.dragInitW;
      let newH = this.dragInitH;

      switch (this.activeDragHandle) {
        case 'move':
          newX = Math.max(0, Math.min(100 - newW, this.dragInitX + deltaX));
          newY = Math.max(0, Math.min(100 - newH, this.dragInitY + deltaY));
          break;
        case 'top-left':
          newX = Math.max(0, Math.min(this.dragInitX + this.dragInitW - 10, this.dragInitX + deltaX));
          newW = this.dragInitW - (newX - this.dragInitX);
          newY = Math.max(0, Math.min(this.dragInitY + this.dragInitH - 10, this.dragInitY + deltaY));
          newH = this.dragInitH - (newY - this.dragInitY);
          break;
        case 'top-right':
          newW = Math.max(10, Math.min(100 - this.dragInitX, this.dragInitW + deltaX));
          newY = Math.max(0, Math.min(this.dragInitY + this.dragInitH - 10, this.dragInitY + deltaY));
          newH = this.dragInitH - (newY - this.dragInitY);
          break;
        case 'bottom-left':
          newX = Math.max(0, Math.min(this.dragInitX + this.dragInitW - 10, this.dragInitX + deltaX));
          newW = this.dragInitW - (newX - this.dragInitX);
          newH = Math.max(10, Math.min(100 - this.dragInitY, this.dragInitH + deltaY));
          break;
        case 'bottom-right':
          newW = Math.max(10, Math.min(100 - this.dragInitX, this.dragInitW + deltaX));
          newH = Math.max(10, Math.min(100 - this.dragInitY, this.dragInitH + deltaY));
          break;
      }

      this.cropX.set(Math.round(newX * 10) / 10);
      this.cropY.set(Math.round(newY * 10) / 10);
      this.cropW.set(Math.round(newW * 10) / 10);
      this.cropH.set(Math.round(newH * 10) / 10);
    };

    const endHandler = () => {
      this.activeDragHandle = null;
      window.removeEventListener('mousemove', moveHandler);
      window.removeEventListener('mouseup', endHandler);
      window.removeEventListener('touchmove', moveHandler);
      window.removeEventListener('touchend', endHandler);
    };

    window.addEventListener('mousemove', moveHandler);
    window.addEventListener('mouseup', endHandler);
    window.addEventListener('touchmove', moveHandler);
    window.addEventListener('touchend', endHandler);
  }

  async applyInlineCropAndScan(): Promise<void> {
    const src = this.tiltedImageSrc() || this.cropImageSrc();
    if (!src) return;

    this.isProcessing.set(true);
    this.progressPercent.set(15);
    this.statusMessage.set('Applying Crop Alignment...');

    try {
      const processed = await this.preprocessor.cropAndTiltImage(src, {
        cropXPercent: this.cropX(),
        cropYPercent: this.cropY(),
        cropWidthPercent: this.cropW(),
        cropHeightPercent: this.cropH(),
        tiltAngleDegrees: 0,
        minWidth: 1600
      });

      this.previewDataUrl.set(processed.dataUrl);
      this.currentRotation = Math.round(this.cropTiltAngle());

      this.progressPercent.set(30);
      this.statusMessage.set('Recognizing Card Text (Pass 1)...');

      const res1 = await this.runTesseractOcr(processed.dataUrl);
      const parsedData1 = this.parser.parseCardText(res1.text, res1.lineMetadata);

      let finalParsedData = parsedData1;
      let fieldCount = Object.values(parsedData1).filter(v => typeof v === 'string' && v.trim().length > 0).length;

      if (fieldCount < 5) {
        this.statusMessage.set('Adaptive Binarization Pass (Pass 2)...');
        this.progressPercent.set(60);
        try {
          const contrastDataUrl = await this.preprocessor.createContrastBinarizedDataUrl(processed.dataUrl);
          const res2 = await this.runTesseractOcr(contrastDataUrl);
          const parsedData2 = this.parser.parseCardText(res2.text, res2.lineMetadata);
          finalParsedData = this.parser.mergeCardData(finalParsedData, parsedData2);
          fieldCount = Object.values(finalParsedData).filter(v => typeof v === 'string' && v.trim().length > 0).length;
        } catch {
          // fallback
        }
      }

      if (fieldCount < 5) {
        this.statusMessage.set('Inverted Color Pass for Dark Backgrounds (Pass 3)...');
        this.progressPercent.set(85);
        try {
          const invertedDataUrl = await this.preprocessor.createInvertedContrastDataUrl(processed.dataUrl);
          const res3 = await this.runTesseractOcr(invertedDataUrl);
          const parsedData3 = this.parser.parseCardText(res3.text, res3.lineMetadata);
          finalParsedData = this.parser.mergeCardData(finalParsedData, parsedData3);
        } catch {
          // fallback
        }
      }

      this.progressPercent.set(100);
      this.extractedData.set(finalParsedData);
      this.modalData = { ...finalParsedData };
      this.cardExtracted.emit(finalParsedData);
      this.isCroppingMode.set(false);
    } catch (err) {
      console.error('Crop & Tilt Scan Error:', err);
      alert('Failed to process cropped image. Please try adjusting crop region.');
    } finally {
      this.isProcessing.set(false);
    }
  }

  // --- ROTATION & EDIT MODAL METHODS ---

  async rotateCard(degreesDelta: number): Promise<void> {
    if (!this.previewDataUrl()) return;
    this.currentRotation = (this.currentRotation + degreesDelta + 360) % 360;
    const rotatedUrl = await this.preprocessor.rotateDataUrl(this.previewDataUrl()!, degreesDelta);
    this.previewDataUrl.set(rotatedUrl);
  }

  async reScanCurrentOrientation(): Promise<void> {
    if (!this.previewDataUrl()) return;
    this.isProcessing.set(true);
    this.progressPercent.set(30);
    this.statusMessage.set('Scanning Rotated Card...');

    try {
      const res = await this.runTesseractOcr(this.previewDataUrl()!);
      const parsedData = this.parser.parseCardText(res.text, res.lineMetadata);
      this.extractedData.set(parsedData);
      this.modalData = { ...parsedData };
      this.cardExtracted.emit(parsedData);
    } catch (err) {
      console.error('Re-scan Error:', err);
    } finally {
      this.isProcessing.set(false);
    }
  }

  private async runTesseractOcr(imageDataUrl: string): Promise<{ text: string; lineMetadata: any[] }> {
    // Handle CommonJS/ESM interop: in production builds (esbuild), the CommonJS
    // tesseract.js module is wrapped as { default: { createWorker, ... } },
    // but in dev mode (webpack), it destructures directly. This resolves both.
    const tesseractModule = await import('tesseract.js') as any;
    const createWorker = tesseractModule.createWorker || tesseractModule.default?.createWorker;
    if (!createWorker) {
      throw new Error('Failed to load tesseract.js: createWorker not found in module exports');
    }
    let worker: any = null;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const langPath = 'https://tessdata.projectnaptha.com/4.00';

    try {
      worker = await createWorker('eng', 1, {
        workerPath: `${origin}/ocr/worker.min.js`,
        corePath: `${origin}/ocr`,
        langPath: langPath,
        logger: (m: any) => {
          if (m.status === 'recognizing text' && m.progress) {
            const pct = Math.round(30 + m.progress * 65);
            this.progressPercent.set(pct);
            this.statusMessage.set(`Recognizing Card Text (${Math.round(m.progress * 100)}%)...`);
          }
        }
      });

      await worker.setParameters({
        tessedit_pageseg_mode: '11' as any
      });

      const ret = await worker.recognize(imageDataUrl);
      const lineMetadata = (ret.data?.lines || []).map((l: any) => ({
        text: (l.text || '').trim(),
        fontSize: l.bbox ? (l.bbox.y1 - l.bbox.y0) : 0
      })).filter((l: any) => l.text.length > 0);

      return { text: ret.data.text, lineMetadata };
    } catch (err) {
      console.warn('Local Wasm worker error, executing CDN worker fallback...', err);
      try {
        const fallbackWorker = await createWorker('eng', 1, {
          workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@v5/dist/worker.min.js',
          corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@v5',
          langPath: langPath,
          logger: (m: any) => {
            if (m.status === 'recognizing text' && m.progress) {
              const pct = Math.round(30 + m.progress * 65);
              this.progressPercent.set(pct);
              this.statusMessage.set(`Recognizing Card Text (${Math.round(m.progress * 100)}%)...`);
            }
          }
        });
        await fallbackWorker.setParameters({
          tessedit_pageseg_mode: '11' as any
        });
        const ret = await fallbackWorker.recognize(imageDataUrl);
        await fallbackWorker.terminate();
        const lineMetadata = (ret.data?.lines || []).map((l: any) => ({
          text: (l.text || '').trim(),
          fontSize: l.bbox ? (l.bbox.y1 - l.bbox.y0) : 0
        })).filter((l: any) => l.text.length > 0);

        return { text: ret.data.text, lineMetadata };
      } catch (cdnErr) {
        console.warn('CDN worker fallback error, executing default worker fallback...', cdnErr);
        const defaultWorker = await createWorker('eng', 1, {
          langPath: langPath
        });
        await defaultWorker.setParameters({
          tessedit_pageseg_mode: '11' as any
        });
        const ret = await defaultWorker.recognize(imageDataUrl);
        await defaultWorker.terminate();
        const lineMetadata = (ret.data?.lines || []).map((l: any) => ({
          text: (l.text || '').trim(),
          fontSize: l.bbox ? (l.bbox.y1 - l.bbox.y0) : 0
        })).filter((l: any) => l.text.length > 0);

        return { text: ret.data.text, lineMetadata };
      }
    } finally {
      if (worker) {
        await worker.terminate();
      }
    }
  }

  applyData(): void {
    const data = this.extractedData();
    if (data) {
      this.cardExtracted.emit(data);
    }
  }

  openEditModal(): void {
    const current = this.extractedData() || {};
    this.modalData = { ...current };
    this.isCroppingMode.set(false);
    this.showModal.set(true);
  }

  closeEditModal(): void {
    this.isCroppingMode.set(false);
    this.showModal.set(false);
  }

  saveAndApplyModal(): void {
    this.extractedData.set({ ...this.modalData });
    this.cardExtracted.emit({ ...this.modalData });
    this.closeEditModal();
  }

  ngOnDestroy(): void {
    this.stopCamera();
  }
}
