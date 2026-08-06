import { Component, EventEmitter, Output, signal, computed, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import type { Worker } from 'tesseract.js';
import { OcrPreprocessorService, CardCorners, Point2D } from '../../core/services/ocr-preprocessor.service';
import { CardParserService, ExtractedCardData, PREDEFINED_DESIGNATIONS } from '../../core/services/card-parser.service';

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
          <p class="text-xs text-slate-500 mb-3">Snap or upload business card to detect corners, crop perspective, and extract info offline.</p>

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

    <!-- Stage 1: Live Camera Card Viewport Modal -->
    @if (showCameraModal()) {
      <div class="fixed inset-0 bg-slate-900/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-fadeIn relative">
          <div class="flex items-center justify-between border-b pb-3 mb-4">
            <div class="flex items-center gap-2">
              <span class="material-icons text-blue-600">photo_camera</span>
              <div>
                <h3 class="text-base font-bold text-slate-900">Real Card Scanner</h3>
                <p class="text-[11px] text-slate-400">Position business card inside frame; system snaps photo for edge & corner crop</p>
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
              <span class="text-[10px] text-slate-400 font-medium">Keep card visible inside viewport</span>
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
                    <span>CARD DETECTED! AUTO-SNAPPING...</span>
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
              Snap & Mark Edges
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Stage 2: Document Edge & 4-Corner Crop Modal (Exact Match to User Image 2 UI) -->
    @if (showDocCropModal()) {
      <div class="fixed inset-0 bg-slate-950 z-50 flex flex-col justify-between p-4 overflow-hidden select-none">
        
        <!-- Header / Status -->
        <div class="flex items-center justify-between z-30 mb-2">
          <button (click)="retakeDocImage()" class="text-white/80 hover:text-white p-2 rounded-full bg-slate-900/60 backdrop-blur-md border border-white/10 flex items-center gap-1 text-xs">
            <span class="material-icons text-sm">arrow_back</span>
            <span>Retake</span>
          </button>
          <span class="text-xs font-bold text-slate-200 tracking-wide uppercase bg-slate-900/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/10">
            Document Corner Scanner
          </span>
          <button (click)="resetQuadCorners()" class="text-blue-400 hover:text-blue-300 text-xs font-bold px-3 py-1 rounded-full bg-slate-900/60 backdrop-blur-md border border-white/10">
            Reset Corners
          </button>
        </div>

        <!-- Main Viewport containing Image + Interactive SVG / Quad Handles -->
        <div class="relative flex-1 bg-slate-950 rounded-2xl overflow-hidden flex items-center justify-center border border-slate-800 shadow-2xl my-2 p-2">
          <div 
            #imageWrapper
            class="relative inline-block max-h-full max-w-full overflow-hidden select-none shadow-2xl rounded"
          >
            @if (capturedDocSrc()) {
              <img 
                #docCropImg
                [src]="capturedDocSrc()" 
                alt="Captured Document" 
                class="max-h-[72vh] max-w-full object-contain pointer-events-none rounded select-none block"
              />
            }

            <!-- SVG Mask & Quadrilateral Polygon overlay -->
            <svg class="absolute inset-0 w-full h-full pointer-events-none select-none z-10" viewBox="0 0 100 100" preserveAspectRatio="none">
              <defs>
                <mask id="doc-quad-dark-mask">
                  <rect x="0" y="0" width="100" height="100" fill="white" />
                  <polygon [attr.points]="quadSvgPoints()" fill="black" />
                </mask>
              </defs>

              <!-- Outer Dark Mask -->
              <rect x="0" y="0" width="100" height="100" fill="rgba(15, 23, 42, 0.72)" mask="url(#doc-quad-dark-mask)" />

              <!-- Polygon Card Boundary Line -->
              <polygon [attr.points]="quadSvgPoints()" fill="rgba(59, 130, 246, 0.1)" stroke="#3b82f6" stroke-width="0.8" stroke-linejoin="round" />

              <!-- Outer Connecting Edge Lines -->
              <line [attr.x1]="docCorners().topLeft.x" [attr.y1]="docCorners().topLeft.y" [attr.x2]="docCorners().topRight.x" [attr.y2]="docCorners().topRight.y" stroke="#0088ff" stroke-width="0.9" />
              <line [attr.x1]="docCorners().topRight.x" [attr.y1]="docCorners().topRight.y" [attr.x2]="docCorners().bottomRight.x" [attr.y2]="docCorners().bottomRight.y" stroke="#0088ff" stroke-width="0.9" />
              <line [attr.x1]="docCorners().bottomRight.x" [attr.y1]="docCorners().bottomRight.y" [attr.x2]="docCorners().bottomLeft.x" [attr.y2]="docCorners().bottomLeft.y" stroke="#0088ff" stroke-width="0.9" />
              <line [attr.x1]="docCorners().bottomLeft.x" [attr.y1]="docCorners().bottomLeft.y" [attr.x2]="docCorners().topLeft.x" [attr.y2]="docCorners().topLeft.y" stroke="#0088ff" stroke-width="0.9" />
            </svg>

            <!-- 4 Interactive Corner Handles (Matching Image 2 blue circles with inner dots) -->
            <!-- Top Left Corner -->
            <div 
              class="absolute w-8 h-8 -ml-4 -mt-4 rounded-full border-2 border-white bg-blue-500/90 shadow-[0_0_15px_rgba(59,130,246,0.9)] cursor-pointer z-20 flex items-center justify-center hover:scale-125 transition-transform"
              [style.left.%]="docCorners().topLeft.x"
              [style.top.%]="docCorners().topLeft.y"
              (mousedown)="startCornerDrag($event, 'topLeft', imageWrapper)"
              (touchstart)="startCornerDrag($event, 'topLeft', imageWrapper)"
            >
              <div class="w-3 h-3 bg-white rounded-full shadow-inner"></div>
            </div>

            <!-- Top Right Corner -->
            <div 
              class="absolute w-8 h-8 -ml-4 -mt-4 rounded-full border-2 border-white bg-blue-500/90 shadow-[0_0_15px_rgba(59,130,246,0.9)] cursor-pointer z-20 flex items-center justify-center hover:scale-125 transition-transform"
              [style.left.%]="docCorners().topRight.x"
              [style.top.%]="docCorners().topRight.y"
              (mousedown)="startCornerDrag($event, 'topRight', imageWrapper)"
              (touchstart)="startCornerDrag($event, 'topRight', imageWrapper)"
            >
              <div class="w-3 h-3 bg-white rounded-full shadow-inner"></div>
            </div>

            <!-- Bottom Right Corner -->
            <div 
              class="absolute w-8 h-8 -ml-4 -mt-4 rounded-full border-2 border-white bg-blue-500/90 shadow-[0_0_15px_rgba(59,130,246,0.9)] cursor-pointer z-20 flex items-center justify-center hover:scale-125 transition-transform"
              [style.left.%]="docCorners().bottomRight.x"
              [style.top.%]="docCorners().bottomRight.y"
              (mousedown)="startCornerDrag($event, 'bottomRight', imageWrapper)"
              (touchstart)="startCornerDrag($event, 'bottomRight', imageWrapper)"
            >
              <div class="w-3 h-3 bg-white rounded-full shadow-inner"></div>
            </div>

            <!-- Bottom Left Corner -->
            <div 
              class="absolute w-8 h-8 -ml-4 -mt-4 rounded-full border-2 border-white bg-blue-500/90 shadow-[0_0_15px_rgba(59,130,246,0.9)] cursor-pointer z-20 flex items-center justify-center hover:scale-125 transition-transform"
              [style.left.%]="docCorners().bottomLeft.x"
              [style.top.%]="docCorners().bottomLeft.y"
              (mousedown)="startCornerDrag($event, 'bottomLeft', imageWrapper)"
              (touchstart)="startCornerDrag($event, 'bottomLeft', imageWrapper)"
            >
              <div class="w-3 h-3 bg-white rounded-full shadow-inner"></div>
            </div>

            <!-- 4 Interactive Edge Pill Handles (Matching Image 2 white pills along edges) -->
            <!-- Top Edge Pill -->
            <div 
              class="absolute w-8 h-3 -ml-4 -mt-1.5 bg-white border border-blue-400 rounded-full cursor-pointer z-20 shadow-md hover:scale-125 transition-transform flex items-center justify-center"
              [style.left.%]="(docCorners().topLeft.x + docCorners().topRight.x) / 2"
              [style.top.%]="(docCorners().topLeft.y + docCorners().topRight.y) / 2"
              (mousedown)="startCornerDrag($event, 'topEdge', imageWrapper)"
              (touchstart)="startCornerDrag($event, 'topEdge', imageWrapper)"
            ></div>

            <!-- Right Edge Pill -->
            <div 
              class="absolute w-3 h-8 -ml-1.5 -mt-4 bg-white border border-blue-400 rounded-full cursor-pointer z-20 shadow-md hover:scale-125 transition-transform flex items-center justify-center"
              [style.left.%]="(docCorners().topRight.x + docCorners().bottomRight.x) / 2"
              [style.top.%]="(docCorners().topRight.y + docCorners().bottomRight.y) / 2"
              (mousedown)="startCornerDrag($event, 'rightEdge', imageWrapper)"
              (touchstart)="startCornerDrag($event, 'rightEdge', imageWrapper)"
            ></div>

            <!-- Bottom Edge Pill -->
            <div 
              class="absolute w-8 h-3 -ml-4 -mt-1.5 bg-white border border-blue-400 rounded-full cursor-pointer z-20 shadow-md hover:scale-125 transition-transform flex items-center justify-center"
              [style.left.%]="(docCorners().bottomLeft.x + docCorners().bottomRight.x) / 2"
              [style.top.%]="(docCorners().bottomLeft.y + docCorners().bottomRight.y) / 2"
              (mousedown)="startCornerDrag($event, 'bottomEdge', imageWrapper)"
              (touchstart)="startCornerDrag($event, 'bottomEdge', imageWrapper)"
            ></div>

            <!-- Left Edge Pill -->
            <div 
              class="absolute w-3 h-8 -ml-1.5 -mt-4 bg-white border border-blue-400 rounded-full cursor-pointer z-20 shadow-md hover:scale-125 transition-transform flex items-center justify-center"
              [style.left.%]="(docCorners().topLeft.x + docCorners().bottomLeft.x) / 2"
              [style.top.%]="(docCorners().topLeft.y + docCorners().bottomLeft.y) / 2"
              (mousedown)="startCornerDrag($event, 'leftEdge', imageWrapper)"
              (touchstart)="startCornerDrag($event, 'leftEdge', imageWrapper)"
            ></div>

            <!-- Loupe Magnifier Glass when dragging corners -->
            @if (isDraggingCorner() && dragLoupeData()) {
              <div 
                class="absolute z-40 w-24 h-24 rounded-full border-4 border-blue-400 bg-slate-900 shadow-2xl overflow-hidden pointer-events-none -translate-x-1/2 -translate-y-28"
                [style.left.px]="dragLoupeData()?.posX"
                [style.top.px]="dragLoupeData()?.posY"
              >
                <div 
                  class="w-full h-full relative"
                  [style.background-image]="'url(' + capturedDocSrc() + ')'"
                  [style.background-position]="dragLoupeData()?.bgPos"
                  [style.background-size]="dragLoupeData()?.bgSize"
                >
                  <!-- Center Target Reticle -->
                  <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div class="w-2.5 h-2.5 rounded-full border-2 border-red-500 bg-red-400/40"></div>
                  </div>
                </div>
              </div>
            }
          </div>
        </div>

        <!-- Controls Toolbar & Action Buttons (Matching Image 2 Bottom Layout) -->
        <div class="z-30 space-y-3 pt-1">
          <div class="flex items-center justify-between text-xs text-slate-300">
            <!-- Filter Selection -->
            <div class="flex items-center gap-2">
              <span class="text-slate-400 text-xs">Current filter :</span>
              <select 
                [ngModel]="activeDocFilter()"
                (ngModelChange)="activeDocFilter.set($event)"
                class="bg-slate-900 border border-slate-700 text-white rounded-md px-3 py-1 text-xs font-semibold focus:ring-2 focus:ring-blue-500"
              >
                <option value="vibrant">Vibrant</option>
                <option value="original">Original</option>
                <option value="bw">B&W</option>
              </select>
            </div>

            <!-- Toolbar Quick Action Icons -->
            <div class="flex items-center gap-2 text-slate-300">
              <button (click)="rotateCapturedDoc(-90)" title="Rotate Left" class="p-1.5 hover:bg-slate-800 rounded-md">
                <span class="material-icons text-lg">rotate_left</span>
              </button>
              <button (click)="rotateCapturedDoc(90)" title="Rotate Right" class="p-1.5 hover:bg-slate-800 rounded-md">
                <span class="material-icons text-lg">rotate_right</span>
              </button>
              <button (click)="resetQuadCorners()" title="Full Card Frame" class="p-1.5 hover:bg-slate-800 rounded-md">
                <span class="material-icons text-lg">crop_free</span>
              </button>
            </div>
          </div>

          <!-- Bottom Action Buttons: RETAKE and CONTINUE (Exact Match to Image 2) -->
          <div class="grid grid-cols-2 gap-4 pt-1 border-t border-slate-800">
            <button 
              type="button" 
              (click)="retakeDocImage()"
              class="w-full py-3 text-xs font-bold tracking-wider text-slate-200 border border-slate-600 hover:bg-slate-800 rounded-lg uppercase transition text-center"
            >
              RETAKE
            </button>
            <button 
              type="button" 
              (click)="applyWarpAndStartOcr()"
              class="w-full py-3 text-xs font-bold tracking-wider text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-lg uppercase transition text-center flex items-center justify-center gap-1.5"
            >
              <span>CONTINUE</span>
              <span class="material-icons text-sm">arrow_forward</span>
            </button>
          </div>
        </div>

      </div>
    }

    <!-- Review & Edit Modal for Extracted OCR Fields -->
    @if (showModal()) {
      <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-fadeIn max-h-[95vh] flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between border-b pb-3 mb-4">
              <div class="flex items-center gap-2">
                <span class="material-icons text-blue-600">auto_fix_high</span>
                <h3 class="text-base font-bold text-slate-900">Review Extracted Business Card</h3>
              </div>
              <button (click)="closeEditModal()" class="text-slate-400 hover:text-slate-600">
                <span class="material-icons">close</span>
              </button>
            </div>

            @if (previewDataUrl()) {
              <div class="mb-4 flex flex-col items-center justify-center">
                <div class="bg-slate-900/90 rounded-xl p-2.5 border border-slate-700/80 shadow-md inline-flex flex-col items-center justify-center relative max-w-full">
                  <img [src]="previewDataUrl()" alt="Cropped Card Preview" class="max-h-48 max-w-full object-contain rounded-lg border border-slate-800" />
                </div>
              </div>
            }

            <div class="space-y-3 max-h-72 overflow-y-auto pr-1">
              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">Full Name</label>
                <input type="text" [(ngModel)]="modalData.name" class="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="e.g. Maria Olivia" />
              </div>

              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">Designation / Title</label>
                <input 
                  type="text" 
                  [(ngModel)]="modalData.designation" 
                  list="ocr-designations-list" 
                  class="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-medium" 
                  placeholder="Select or type designation e.g. Business Development Head" 
                />
                <datalist id="ocr-designations-list">
                  @for (des of predefinedDesignations; track des) {
                    <option [value]="des"></option>
                  }
                </datalist>
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
                <label class="block text-xs font-bold text-slate-700 mb-1">Address / Location</label>
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

  readonly predefinedDesignations = PREDEFINED_DESIGNATIONS;

  @Output() cardExtracted = new EventEmitter<ExtractedCardData>();

  isProcessing = signal(false);
  progressPercent = signal(0);
  statusMessage = signal('Preparing...');
  extractedData = signal<ExtractedCardData | null>(null);
  previewDataUrl = signal<string | null>(null);
  rawSelectedFile: File | null = null;
  rawSourceDataUrl: string | null = null;

  showModal = signal(false);
  modalData: ExtractedCardData = {};

  // Stage 1 Camera Modal State
  showCameraModal = signal(false);
  isStartingCamera = signal(false);
  cameraError = signal<string | null>(null);
  cameraStatus = signal('Hold business card inside frame...');
  cardAligned = signal(false);

  // Stage 2 Document Edge & Corner Crop Modal State
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
  dragLoupeData = signal<{ posX: number; posY: number; bgPos: string; bgSize: string } | null>(null);

  private mediaStream: MediaStream | null = null;
  private alignCheckInterval: any = null;
  private cardLockFrames = 0;
  private isCapturing = false;

  quadSvgPoints = computed(() => {
    const c = this.docCorners();
    return `${c.topLeft.x},${c.topLeft.y} ${c.topRight.x},${c.topRight.y} ${c.bottomRight.x},${c.bottomRight.y} ${c.bottomLeft.x},${c.bottomLeft.y}`;
  });

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

      const rLeft = Math.round(W * 0.06);
      const rRight = Math.round(W * 0.94);
      const rTop = Math.round(H * 0.18);
      const rBottom = Math.round(H * 0.82);
      const stripDepth = 4;

      let topEdges = 0, topTotal = 0;
      for (let x = rLeft + 5; x < rRight - 5; x += 2) {
        if (Math.abs(lum(x, rTop - stripDepth) - lum(x, rTop + stripDepth)) > 35) topEdges++;
        topTotal++;
      }

      let bottomEdges = 0, bottomTotal = 0;
      for (let x = rLeft + 5; x < rRight - 5; x += 2) {
        if (Math.abs(lum(x, rBottom - stripDepth) - lum(x, rBottom + stripDepth)) > 35) bottomEdges++;
        bottomTotal++;
      }

      let leftEdges = 0, leftTotal = 0;
      for (let y = rTop + 5; y < rBottom - 5; y += 2) {
        if (Math.abs(lum(rLeft - stripDepth, y) - lum(rLeft + stripDepth, y)) > 35) leftEdges++;
        leftTotal++;
      }

      let rightEdges = 0, rightTotal = 0;
      for (let y = rTop + 5; y < rBottom - 5; y += 2) {
        if (Math.abs(lum(rRight - stripDepth, y) - lum(rRight + stripDepth, y)) > 35) rightEdges++;
        rightTotal++;
      }

      const strongBorders = [
        topTotal > 0 && topEdges / topTotal >= 0.4,
        bottomTotal > 0 && bottomEdges / bottomTotal >= 0.4,
        leftTotal > 0 && leftEdges / leftTotal >= 0.4,
        rightTotal > 0 && rightEdges / rightTotal >= 0.4
      ].filter(Boolean).length;

      const isRealCard = strongBorders >= 3;

      if (isRealCard) {
        this.cardLockFrames++;
        this.cardAligned.set(true);
        if (this.cardLockFrames >= 5) {
          this.cameraStatus.set('CARD DETECTED! SNAPPING...');
          this.captureCardFromCamera();
        } else {
          this.cameraStatus.set(`Locking card... ${this.cardLockFrames}/5`);
        }
      } else {
        this.cardLockFrames = Math.max(0, this.cardLockFrames - 1);
        this.cardAligned.set(false);
        this.cameraStatus.set('Align business card inside frame');
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
      const canvas = document.createElement('canvas');
      canvas.width = videoEl.videoWidth;
      canvas.height = videoEl.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoEl, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
        await this.closeCameraModal();
        await this.openDocCropModal(dataUrl);
      }
    } catch (err) {
      console.error('Camera capture error:', err);
    } finally {
      this.isCapturing = false;
    }
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    this.rawSelectedFile = input.files[0];
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      await this.openDocCropModal(dataUrl);
    };
    reader.readAsDataURL(this.rawSelectedFile);
  }

  async openDocCropModal(sourceDataUrl: string): Promise<void> {
    this.capturedDocSrc.set(sourceDataUrl);
    this.showDocCropModal.set(true);

    // Auto-detect initial 4 card corners
    const detected = await this.preprocessor.autoDetectCardCorners(sourceDataUrl);
    this.docCorners.set(detected);
  }

  retakeDocImage(): void {
    this.showDocCropModal.set(false);
    this.openCameraModal();
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

      // Update Magnifier Glass Loupe Data
      this.dragLoupeData.set({
        posX: clientX - rect.left,
        posY: clientY - rect.top,
        bgPos: `${pctX}% ${pctY}%`,
        bgSize: `${rect.width * 2.5}px ${rect.height * 2.5}px`
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

  async applyWarpAndStartOcr(): Promise<void> {
    const src = this.capturedDocSrc();
    if (!src) return;

    this.showDocCropModal.set(false);
    this.isProcessing.set(true);
    this.progressPercent.set(15);
    this.statusMessage.set('Applying 4-Point Perspective Warp...');

    try {
      const warped = await this.preprocessor.warpPerspective(
        src,
        this.docCorners(),
        this.activeDocFilter(),
        1800
      );

      this.previewDataUrl.set(warped.dataUrl);

      this.progressPercent.set(35);
      this.statusMessage.set('Recognizing Card Text (Pass 1)...');

      let res1 = await this.runTesseractOcr(warped.dataUrl);
      let parsedData1 = this.parser.parseCardText(res1.text, res1.lineMetadata);

      // Pass 2: Adaptive Contrast Binarization Pass (extracts faint/grey ink)
      this.statusMessage.set('Adaptive Binarization Pass (Pass 2)...');
      this.progressPercent.set(70);
      try {
        const binarizedUrl = await this.preprocessor.createContrastBinarizedDataUrl(warped.dataUrl);
        const res2 = await this.runTesseractOcr(binarizedUrl);
        const parsedData2 = this.parser.parseCardText(res2.text, res2.lineMetadata);
        parsedData1 = this.parser.mergeCardData(parsedData1, parsedData2);
      } catch {
        // fallback
      }

      this.progressPercent.set(100);
      this.extractedData.set(parsedData1);
      this.modalData = { ...parsedData1 };
      this.cardExtracted.emit(parsedData1);
      this.openEditModal();
    } catch (err) {
      console.error('Perspective warp OCR Error:', err);
      alert('Could not process card perspective warp. Please try again.');
    } finally {
      this.isProcessing.set(false);
    }
  }

  private async runTesseractOcr(imageDataUrl: string): Promise<{ text: string; lineMetadata: any[] }> {
    const { createWorker } = await import('tesseract.js');
    let worker: Worker | null = null;
    try {
      worker = await createWorker('eng', 1, {
        workerPath: '/ocr/worker.min.js',
        corePath: '/ocr',
        logger: (m) => {
          if (m.status === 'recognizing text' && m.progress) {
            const pct = Math.round(35 + m.progress * 60);
            this.progressPercent.set(pct);
            this.statusMessage.set(`Recognizing Card Text (${Math.round(m.progress * 100)}%)...`);
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
    } catch (err) {
      console.warn('Local Wasm worker error, executing standard worker fallback...', err);
      const fallbackWorker = await createWorker('eng');
      await fallbackWorker.setParameters({
        tessedit_pageseg_mode: '3' as any
      });
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

  applyData(): void {
    const data = this.extractedData();
    if (data) {
      this.cardExtracted.emit(data);
    }
  }

  openEditModal(): void {
    const current = this.extractedData() || {};
    this.modalData = { ...current };
    this.showModal.set(true);
  }

  closeEditModal(): void {
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
