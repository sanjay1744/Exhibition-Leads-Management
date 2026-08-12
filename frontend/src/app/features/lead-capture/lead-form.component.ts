import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { ApplicationDatabase } from '../../core/services/db.service';
import { LocalLead, CaptureMethod } from '../../core/models/lead.model';
import { StallService } from '../../core/services/stall.service';
import { ExhibitionService } from '../../core/services/exhibition.service';
import { OcrScannerComponent, ExtractedCardData } from './ocr-scanner.component';
import { QrScannerComponent, QrParsedContact } from './qr-scanner.component';
import { VoiceRecorderComponent } from './voice-recorder.component';
import { PREDEFINED_DESIGNATIONS } from '../../core/services/card-parser.service';
import { getApiUrl } from '../../core/config/api.config';

@Component({
  selector: 'app-lead-form',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, OcrScannerComponent, QrScannerComponent, VoiceRecorderComponent],
  template: `
    <div class="max-w-5xl mx-auto pb-16 md:pb-8">
      <!-- Page Header -->
      <div class="page-title-bar flex items-center justify-between mb-6">
        <div>
          <div class="text-xs font-black text-slate-900 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <span class="material-icons text-sm text-slate-900">post_add</span>
            <span>{{ isEditMode() ? 'EDIT LEAD ENTRY' : 'NEW LEADS' }}</span>
          </div>
          <h1 class="page-title text-2xl font-black text-slate-900 uppercase tracking-tight">
            @if (isEditMode()) {
              MODIFY VISITOR DETAILS (RECORD: {{ editingLeadId }})
            } @else {
              {{ activeStallSubtitle() }}
            }
          </h1>
        </div>

        <button 
          type="button"
          (click)="openTargetSelectionModal()" 
          class="text-xs bg-blue-50 hover:bg-blue-100 border border-blue-200 hover:border-blue-400 text-blue-800 px-3 py-1.5 rounded-lg font-extrabold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer group"
          title="Click to switch target Exhibition & Stall"
        >
          <span class="material-icons text-sm text-blue-600 group-hover:scale-110 transition-transform">storefront</span>
          <span>{{ stallService.activeStall()?.code || 'STALL-01' }}</span>
          <span class="material-icons text-xs text-blue-500">swap_horiz</span>
        </button>
      </div>

      <!-- Quick Acquisition Tools Grid -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <app-ocr-scanner (cardExtracted)="onCardExtracted($event)"></app-ocr-scanner>
        <app-qr-scanner (qrScanned)="onQrScanned($event)"></app-qr-scanner>
        <app-voice-recorder 
          [initialAudio]="voiceBlob" 
          [initialTranscript]="voiceNotesTranscript" 
          (voiceRecorded)="onVoiceRecorded($event)" 
          (transcriptGenerated)="onTranscriptGenerated($event)"
          (voiceCleared)="onVoiceCleared()"
        ></app-voice-recorder>
      </div>

      <!-- Visitor Information Form Card -->
      <div class="card-panel bg-white rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition-all duration-300 p-0 overflow-hidden mb-8">
        <!-- Premium Navy Gradient Header Banner -->
        <div class="bg-gradient-to-r from-[#142e4a] via-[#1a3a5c] to-[#204770] text-white p-4 px-6 flex items-center justify-between shadow-xs border-b border-white/10">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center shrink-0 backdrop-blur-xs">
              <span class="material-icons text-blue-200 text-xl">contact_page</span>
            </div>
            <div>
              <h2 class="text-sm font-extrabold text-white uppercase tracking-wider">
                {{ isEditMode() ? 'Edit Visitor Record & Requirements' : 'Visitor Information & Requirements' }}
              </h2>
              <p class="text-[11px] text-blue-200/80 font-medium">Enter contact info manually or review auto-extracted details</p>
            </div>
          </div>
          <span class="text-[11px] font-extrabold px-3 py-1 rounded-full bg-white/10 text-blue-100 border border-white/15">Lead Entry</span>
        </div>

        <form (ngSubmit)="saveLead()" class="p-6">
          @if (scannedPhotoDataUrl) {
            <div class="flex items-center justify-between bg-blue-50/80 border border-blue-200 p-3 rounded-xl text-xs mb-6 shadow-2xs">
              <div class="flex items-center gap-3">
                <img [src]="scannedPhotoDataUrl" alt="Card Preview" class="h-12 w-20 rounded-lg border border-blue-300 object-cover shadow-2xs" />
                <div>
                  <span class="font-extrabold text-blue-900 block flex items-center gap-1.5">
                    <span class="material-icons text-base text-emerald-600">check_circle</span>
                    Scanned Business Card Attached
                  </span>
                  <span class="text-[11px] text-slate-500">Saved to local storage & device folder as <strong>{{ existingLeadNumber || 'S1L...' }}.jpg</strong> upon saving</span>
                </div>
              </div>
              <button type="button" (click)="scannedPhotoDataUrl = null" class="text-xs text-rose-600 font-extrabold hover:underline cursor-pointer">Remove Photo</button>
            </div>
          }

          <div class="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
            <!-- Full Name * (Mandatory) -->
            <div>
              <label class="form-label font-bold text-xs text-slate-700 mb-1.5">Full Name *</label>
              <div class="relative flex items-center group">
                <div class="absolute left-3 w-7 h-7 rounded-lg bg-slate-100 group-focus-within:bg-blue-50 text-slate-400 group-focus-within:text-blue-600 flex items-center justify-center transition-colors">
                  <span class="material-icons text-base">person</span>
                </div>
                <input 
                  [(ngModel)]="name" 
                  name="name" 
                  required 
                  class="form-control pl-12 py-2.5 text-xs font-semibold rounded-xl border-slate-200 focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 shadow-2xs" 
                  placeholder="Visitor Name" 
                />
              </div>
            </div>

            <!-- Company Name (Optional) -->
            <div>
              <label class="form-label font-bold text-xs text-slate-700 mb-1.5">Company Name</label>
              <div class="relative flex items-center group">
                <div class="absolute left-3 w-7 h-7 rounded-lg bg-slate-100 group-focus-within:bg-blue-50 text-slate-400 group-focus-within:text-blue-600 flex items-center justify-center transition-colors">
                  <span class="material-icons text-base">business</span>
                </div>
                <input 
                  [(ngModel)]="company" 
                  name="company" 
                  class="form-control pl-12 py-2.5 text-xs font-semibold rounded-xl border-slate-200 focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 shadow-2xs" 
                  placeholder="Company Name" 
                />
              </div>
            </div>

            <!-- Mobile Phone * (Mandatory - Dynamic 1 to 3 fields) -->
            <div>
              <div class="flex items-center justify-between mb-1.5">
                <label class="form-label font-bold text-xs text-slate-700">Mobile Phone *</label>
                @if (phoneNumbers.length < 3) {
                  <button type="button" (click)="addPhoneInput()" class="text-[11px] text-blue-600 hover:text-blue-800 font-extrabold flex items-center gap-0.5 px-2.5 py-0.5 rounded-lg bg-blue-50/60 hover:bg-blue-100/80 transition-colors cursor-pointer">
                    <span class="material-icons text-xs">add</span> Add Phone
                  </button>
                }
              </div>
              <div class="space-y-2">
                @for (ph of phoneNumbers; track $index) {
                  <div class="relative flex items-center gap-2">
                    <div class="relative flex-1 flex items-center group">
                      <div class="absolute left-3 w-7 h-7 rounded-lg bg-slate-100 group-focus-within:bg-blue-50 text-slate-400 group-focus-within:text-blue-600 flex items-center justify-center transition-colors">
                        <span class="material-icons text-base">call</span>
                      </div>
                      <input 
                        [(ngModel)]="phoneNumbers[$index]" 
                        [name]="'phone_' + $index" 
                        [required]="$index === 0" 
                        class="form-control pl-12 py-2.5 text-xs font-semibold rounded-xl border-slate-200 focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 shadow-2xs" 
                        [placeholder]="$index === 0 ? '+91 98765 43210 (Primary)' : '+91 0422 2967078 (Alt Phone ' + ($index + 1) + ')'" 
                      />
                    </div>
                    @if ($index > 0) {
                      <button type="button" (click)="removePhoneInput($index)" title="Remove phone" class="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors flex items-center justify-center cursor-pointer">
                        <span class="material-icons text-base">delete_outline</span>
                      </button>
                    }
                  </div>
                }
              </div>
            </div>

            <!-- Email Address (Optional) -->
            <div>
              <label class="form-label font-bold text-xs text-slate-700 mb-1.5">Email Address</label>
              <div class="relative flex items-center group">
                <div class="absolute left-3 w-7 h-7 rounded-lg bg-slate-100 group-focus-within:bg-blue-50 text-slate-400 group-focus-within:text-blue-600 flex items-center justify-center transition-colors">
                  <span class="material-icons text-base">mail</span>
                </div>
                <input 
                  [(ngModel)]="email" 
                  name="email" 
                  class="form-control pl-12 py-2.5 text-xs font-semibold rounded-xl border-slate-200 focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 shadow-2xs" 
                  placeholder="visitor@company.com" 
                />
              </div>
            </div>

            <!-- Designation (Optional) -->
            <div>
              <label class="form-label font-bold text-xs text-slate-700 mb-1.5">Designation / Role</label>
              <div class="relative flex items-center group">
                <div class="absolute left-3 w-7 h-7 rounded-lg bg-slate-100 group-focus-within:bg-blue-50 text-slate-400 group-focus-within:text-blue-600 flex items-center justify-center transition-colors">
                  <span class="material-icons text-base">work</span>
                </div>
                <input 
                  [(ngModel)]="designation" 
                  name="designation" 
                  list="lead-designations-list" 
                  class="form-control pl-12 py-2.5 text-xs font-semibold rounded-xl border-slate-200 focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 shadow-2xs" 
                  placeholder="Business Development Head / Director" 
                />
                <datalist id="lead-designations-list">
                  @for (des of predefinedDesignations; track des) {
                    <option [value]="des"></option>
                  }
                </datalist>
              </div>
            </div>

            <!-- Website URL (Optional) -->
            <div>
              <label class="form-label font-bold text-xs text-slate-700 mb-1.5">Website URL</label>
              <div class="relative flex items-center group">
                <div class="absolute left-3 w-7 h-7 rounded-lg bg-slate-100 group-focus-within:bg-blue-50 text-slate-400 group-focus-within:text-blue-600 flex items-center justify-center transition-colors">
                  <span class="material-icons text-base">language</span>
                </div>
                <input 
                  [(ngModel)]="website" 
                  name="website" 
                  class="form-control pl-12 py-2.5 text-xs font-semibold rounded-xl border-slate-200 focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 shadow-2xs" 
                  placeholder="www.company.com" 
                />
              </div>
            </div>

            <!-- Address / Location (Optional) -->
            <div>
              <label class="form-label font-bold text-xs text-slate-700 mb-1.5">Address / Location</label>
              <div class="relative flex items-center group">
                <div class="absolute left-3 w-7 h-7 rounded-lg bg-slate-100 group-focus-within:bg-blue-50 text-slate-400 group-focus-within:text-blue-600 flex items-center justify-center transition-colors">
                  <span class="material-icons text-base">location_on</span>
                </div>
                <input 
                  [(ngModel)]="address" 
                  name="address" 
                  class="form-control pl-12 py-2.5 text-xs font-semibold rounded-xl border-slate-200 focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 shadow-2xs" 
                  placeholder="City, State or Full Address" 
                />
              </div>
            </div>

            <!-- Interest Priority Segmented Switcher -->
            <div>
              <label class="form-label font-bold text-xs text-slate-700 mb-1.5">Interest Priority</label>
              <div class="flex gap-2 pt-0.5">
                <button 
                  type="button" 
                  (click)="interestLevel = 'Hot'" 
                  class="flex-1 py-2.5 px-3 rounded-xl text-xs font-extrabold border transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer"
                  [ngClass]="interestLevel === 'Hot' ? 'bg-gradient-to-r from-rose-600 to-red-600 border-rose-600 text-white shadow-md shadow-rose-500/20 scale-[1.02]' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'"
                >
                  <span>🔥</span> Hot
                </button>

                <button 
                  type="button" 
                  (click)="interestLevel = 'Warm'" 
                  class="flex-1 py-2.5 px-3 rounded-xl text-xs font-extrabold border transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer"
                  [ngClass]="interestLevel === 'Warm' ? 'bg-gradient-to-r from-amber-500 to-amber-600 border-amber-600 text-white shadow-md shadow-amber-500/20 scale-[1.02]' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'"
                >
                  <span>☀️</span> Warm
                </button>

                <button 
                  type="button" 
                  (click)="interestLevel = 'Cold'" 
                  class="flex-1 py-2.5 px-3 rounded-xl text-xs font-extrabold border transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer"
                  [ngClass]="interestLevel === 'Cold' ? 'bg-gradient-to-r from-sky-600 to-blue-600 border-sky-600 text-white shadow-md shadow-sky-500/20 scale-[1.02]' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'"
                >
                  <span>❄️</span> Cold
                </button>
              </div>
            </div>
          </div>

          <!-- Discussion Remarks & Quick Tags -->
          <div class="mb-5">
            <div class="flex justify-between items-center mb-2">
              <label class="form-label font-bold text-xs text-slate-700 mb-0">Discussion Remarks & Requirements</label>
              <span class="text-[11px] text-slate-400 font-medium">Click chips below to add quick notes</span>
            </div>

            <div class="flex flex-wrap gap-1.5 mb-3">
              @for (chip of quickChips; track chip) {
                <button 
                  type="button" 
                  (click)="addQuickRemark(chip)" 
                  class="text-[11px] bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-800 border border-slate-200/80 hover:border-blue-300 font-semibold px-3 py-1 rounded-lg transition-all active:scale-95 cursor-pointer shadow-2xs"
                >
                  + {{ chip }}
                </button>
              }
            </div>

            <textarea 
              [(ngModel)]="remarks" 
              name="remarks" 
              rows="3" 
              class="form-control text-xs font-medium rounded-xl p-3 border-slate-200 focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 shadow-2xs" 
              placeholder="Enter key discussion notes, budget, or required follow-ups..."
            ></textarea>
          </div>

          @if (savedMessage()) {
            <div class="mb-5 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-extrabold flex items-center gap-2 shadow-2xs">
              <span class="material-icons text-base text-emerald-600">check_circle</span>
              {{ savedMessage() }}
            </div>
          }

          <div class="flex items-center justify-between border-t border-slate-100 pt-5">
            <button type="button" (click)="resetForm()" class="px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 hover:bg-slate-100 text-slate-600 transition-all cursor-pointer flex items-center gap-1.5">
              <span class="material-icons text-base">refresh</span> Reset Form
            </button>

            <button type="submit" class="px-8 py-2.5 rounded-xl text-xs font-extrabold bg-gradient-to-r from-[#142e4a] via-[#1a3a5c] to-[#204770] hover:from-[#183656] hover:to-[#255280] text-white shadow-md hover:shadow-lg active:scale-[0.98] transition-all cursor-pointer flex items-center gap-2">
              <span class="material-icons text-base">save</span>
              <span>{{ isEditMode() ? 'Update Lead Record' : 'Save Lead' }}</span>
            </button>
          </div>
        </form>
      </div>

      <!-- Captured Leads Preview Grid (Bulk Lead Entry Mode) -->
      <div class="mt-8 bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
        
        <!-- Grid Top Header -->
        <div class="p-4 px-6 bg-slate-50/80 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-xl bg-[#1a3a5c] text-white flex items-center justify-center font-bold shadow-2xs">
              <span class="material-icons text-lg">view_list</span>
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h3 class="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
                  RECENT LEADS
                </h3>
                <span class="px-2.5 py-0.5 bg-blue-50 text-blue-800 border border-blue-200/80 rounded-full text-[11px] font-extrabold">
                  {{ sessionLeads().length }} Saved
                </span>
              </div>
              <p class="text-[11px] text-slate-400 font-medium">Leads recorded during this active stall session</p>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <a 
              routerLink="/leads" 
              class="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 text-xs font-extrabold rounded-xl border border-slate-200 shadow-2xs flex items-center gap-1.5 transition cursor-pointer"
            >
              <span class="material-icons text-base text-blue-600">folder_shared</span>
              <span>Go to All Leads Directory</span>
            </a>
          </div>
        </div>

        <!-- Preview Grid Table -->
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-gradient-to-r from-[#142e4a] via-[#1a3a5c] to-[#204770] text-white text-[11px] font-extrabold uppercase tracking-wider border-b border-white/10">
                <th class="py-3.5 px-3 border-r border-white/10">LEAD NO.</th>
                <th class="py-3.5 px-3 border-r border-white/10 whitespace-nowrap">TIME</th>
                <th class="py-3.5 px-3 border-r border-white/10">VISITOR NAME</th>
                <th class="py-3.5 px-3 border-r border-white/10">COMPANY</th>
                <th class="py-3.5 px-3 border-r border-white/10">MOBILE</th>
                <th class="py-3.5 px-3 border-r border-white/10">DESIGNATION</th>
                <th class="py-3.5 px-2 border-r border-white/10 text-center w-24">INTEREST</th>
                <th class="py-3.5 px-2 border-r border-white/10 text-center w-20">MEDIA</th>
                <th class="py-3.5 px-2 border-r border-white/10 text-center w-12">VIEW</th>
                <th class="py-3.5 px-2 text-center w-12">EDIT</th>
              </tr>
            </thead>
            <tbody class="text-xs text-slate-700 font-normal">
              @for (lead of paginatedSessionLeads(); track lead.id; let idx = $index) {
                <tr 
                  class="border-b border-slate-100 transition hover:bg-blue-50/40"
                  [ngClass]="idx % 2 === 0 ? 'bg-[#f4f8fc]' : 'bg-white'"
                >
                  <!-- Lead No -->
                  <td class="py-2 px-3 font-mono font-bold text-blue-700 border-r border-slate-200/60">
                    {{ lead.leadNumber }}
                  </td>

                  <!-- Time -->
                  <td class="py-2 px-3 font-mono text-[11px] text-slate-600 border-r border-slate-200/60 whitespace-nowrap">
                    {{ formatTimeDisplay(lead.createdAt) }}
                  </td>

                  <!-- Visitor Name -->
                  <td class="py-2 px-3 font-bold text-slate-900 border-r border-slate-200/60">
                    <div class="flex items-center justify-between gap-1">
                      <span>{{ lead.name }}</span>
                      @if (lead.voiceBlob || lead.voiceNotesTranscript) {
                        <span class="material-icons text-xs text-red-600 bg-red-50 p-0.5 rounded" title="Voice Note Audio">mic</span>
                      }
                    </div>
                  </td>

                  <!-- Company -->
                  <td class="py-2 px-3 font-medium text-slate-800 border-r border-slate-200/60">
                    {{ lead.company || '-' }}
                  </td>

                  <!-- Mobile (1 number per line, no commas, min-w 170px) -->
                  <td class="py-2 px-3 border-r border-slate-200/60 min-w-[170px] whitespace-nowrap">
                    @for (num of getPhoneNumbersList(lead.phone); track num) {
                      <div class="whitespace-nowrap font-mono text-[11px] leading-snug">{{ num }}</div>
                    }
                  </td>

                  <!-- Designation -->
                  <td class="py-2 px-3 text-slate-600 border-r border-slate-200/60">
                    {{ lead.designation || '-' }}
                  </td>

                  <!-- Interest -->
                  <td class="py-2 px-2 text-center border-r border-slate-200/60">
                    <span 
                      class="px-2 py-0.5 rounded-full text-[10px] font-bold inline-block"
                      [ngClass]="{
                        'bg-red-100 text-red-700 border border-red-200': lead.interestLevel === 'Hot',
                        'bg-amber-100 text-amber-700 border border-amber-200': lead.interestLevel === 'Warm',
                        'bg-blue-100 text-blue-700 border border-blue-200': lead.interestLevel === 'Cold'
                      }"
                    >
                      {{ lead.interestLevel }}
                    </span>
                  </td>

                  <!-- Media -->
                  <td class="py-2 px-2 text-center border-r border-slate-200/60">
                    <div class="flex items-center justify-center gap-1">
                      @if (lead.photoBlob) {
                        <span class="material-icons text-sm text-blue-600" title="Scanned Card Attached">credit_card</span>
                      }
                      @if (lead.voiceBlob || lead.voiceNotesTranscript) {
                        <span class="material-icons text-sm text-red-600" title="Voice Note Attached">mic</span>
                      }
                      @if (!lead.photoBlob && !lead.voiceBlob && !lead.voiceNotesTranscript) {
                        <span class="text-slate-300">-</span>
                      }
                    </div>
                  </td>

                  <!-- View Action -->
                  <td class="py-2 px-2 text-center border-r border-slate-200/60">
                    <button (click)="selectedLeadForView.set(lead)" class="text-slate-500 hover:text-blue-600 p-0.5 transition" title="View Details">
                      <span class="material-icons text-base">visibility</span>
                    </button>
                  </td>

                  <!-- Edit Action -->
                  <td class="py-2 px-2 text-center">
                    <button (click)="loadLeadForEditFromPreview(lead)" class="text-blue-600 hover:text-blue-800 p-0.5 transition" title="Edit Lead">
                      <span class="material-icons text-base">edit</span>
                    </button>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="10" class="py-8 text-center text-slate-400 font-medium">
                    No leads captured in this session yet. Fill out the form above and click "Save Lead" to add entries here.
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <!-- Table Pagination Footer Bar -->
        <div class="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-6 text-xs text-slate-600 font-medium select-none">
          <div class="flex items-center gap-2">
            <span>Items per page:</span>
            <select [(ngModel)]="pageSizeSelect" (change)="onPageSizeChange()" class="border border-slate-300 rounded px-2.5 py-1 bg-white text-xs outline-none focus:border-blue-600 font-semibold cursor-pointer">
              <option [value]="10">10</option>
              <option [value]="20">20</option>
              <option [value]="50">50</option>
              <option [value]="100">100</option>
            </select>
          </div>

          <div>
            {{ startIndex() }} - {{ endIndex() }} of {{ sessionLeads().length }}
          </div>

          <!-- Page Navigation Buttons -->
          <div class="flex items-center gap-1">
            <button 
              [disabled]="currentPage() === 1" 
              (click)="prevPage()" 
              class="p-1 rounded hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition text-slate-600" 
              title="Previous Page"
            >
              <span class="material-icons text-base">chevron_left</span>
            </button>

            <button 
              [disabled]="endIndex() >= sessionLeads().length" 
              (click)="nextPage()" 
              class="p-1 rounded hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition text-slate-600" 
              title="Next Page"
            >
              <span class="material-icons text-base">chevron_right</span>
            </button>
          </div>
        </div>
      </div>
      <!-- Modal: Change Target Exhibition & Stall -->
      @if (isTargetModalOpen()) {
        <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
          <div class="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 my-8 animate-in zoom-in-95 duration-150">
            
            <!-- Modal Header -->
            <div class="flex items-center justify-between border-b border-slate-100 pb-3 mb-5">
              <div class="flex items-center gap-2.5">
                <div class="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center font-bold shrink-0 shadow-2xs">
                  <span class="material-icons text-xl">storefront</span>
                </div>
                <div>
                  <h2 class="text-base font-bold text-slate-900 uppercase tracking-wide">SELECT TARGET EXHIBITION & STALL</h2>
                  <p class="text-xs text-slate-500 font-medium">Select event and stall destination to capture lead</p>
                </div>
              </div>
              <button type="button" (click)="closeTargetSelectionModal()" class="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition">
                <span class="material-icons text-lg">close</span>
              </button>
            </div>

            <div class="space-y-4">
              <!-- Dropdown 1: Select Exhibition -->
              <div>
                <label class="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
                  1. Select Exhibition *
                </label>
                <select 
                  [ngModel]="targetExhibitionId()" 
                  (ngModelChange)="selectTargetExhibition($event)"
                  class="w-full text-xs font-bold p-3 border border-slate-300 rounded-xl outline-none focus:border-blue-600 bg-white shadow-2xs"
                >
                  <option value="">-- Select Exhibition Event --</option>
                  @for (exh of exhibitionService.exhibitions(); track exh.id) {
                    <option [value]="exh.id">{{ exh.name }} ({{ exh.code }})</option>
                  }
                </select>
              </div>

              <!-- Dropdown 2: Select Stall (Blocked/Disabled until Exhibition selected) -->
              <div>
                <label class="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
                  2. Select Stall *
                </label>
                <select 
                  [(ngModel)]="targetStallId" 
                  [disabled]="!targetExhibitionId()" 
                  class="w-full text-xs font-bold p-3 border border-slate-300 rounded-xl outline-none focus:border-blue-600 bg-white shadow-2xs disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed border-slate-200"
                >
                  <option value="">
                    {{ !targetExhibitionId() ? '-- Select Exhibition First --' : '-- Select Stall Project --' }}
                  </option>
                  @for (stall of targetStalls(); track stall.id) {
                    <option [value]="stall.id">{{ stall.name }} ({{ stall.code }})</option>
                  }
                </select>
                @if (!targetExhibitionId()) {
                  <p class="text-[11px] text-amber-600 font-semibold mt-1 flex items-center gap-1">
                    <span class="material-icons text-xs text-amber-500">info</span>
                    Stall selection is blocked until an exhibition is selected.
                  </p>
                }
              </div>
            </div>

            <!-- Modal Action Footer -->
            <div class="flex items-center justify-end gap-2.5 pt-4 mt-6 border-t border-slate-100">
              <button 
                type="button" 
                (click)="closeTargetSelectionModal()" 
                class="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              
              <button 
                type="button" 
                (click)="confirmTargetStallSelection()" 
                [disabled]="!targetExhibitionId() || !targetStallId()"
                class="px-5 py-2.5 text-xs font-extrabold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors"
              >
                <span>Switch Target Stall</span>
                <span class="material-icons text-sm">check_circle</span>
              </button>
            </div>

          </div>
        </div>
      }
      <!-- Modal: View Captured Lead Preview Details -->
      @if (selectedLeadForView()) {
        <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
          <div class="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-5 animate-in zoom-in-95 duration-150">
            <div class="flex items-center justify-between border-b pb-3">
              <div class="flex items-center gap-2">
                <span class="material-icons text-blue-600">contact_page</span>
                <div>
                  <h3 class="text-base font-bold text-slate-900">Lead Record Details</h3>
                  <span class="text-xs font-mono font-bold text-blue-600">{{ selectedLeadForView()?.leadNumber }}</span>
                </div>
              </div>
              <button (click)="selectedLeadForView.set(null)" class="text-slate-400 hover:text-slate-600">
                <span class="material-icons text-lg">close</span>
              </button>
            </div>

            <div class="space-y-4">
              <div class="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div class="text-sm font-extrabold text-slate-900">{{ selectedLeadForView()?.name }}</div>
                <div class="text-xs font-semibold text-slate-600">{{ selectedLeadForView()?.company }}</div>
                <div class="text-xs text-slate-500 font-mono mt-1">{{ selectedLeadForView()?.phone }}</div>
                @if (selectedLeadForView()?.email) {
                  <div class="text-xs text-slate-500">{{ selectedLeadForView()?.email }}</div>
                }
              </div>

              @if (selectedLeadForView()?.remarks) {
                <div>
                  <label class="text-xs font-bold text-slate-700 block mb-1">DISCUSSION REMARKS</label>
                  <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700">
                    {{ selectedLeadForView()?.remarks }}
                  </div>
                </div>
              }
            </div>

            <div class="flex items-center justify-end gap-2 pt-3 border-t">
              <button (click)="selectedLeadForView.set(null)" class="btn btn-outline-pill text-xs">Close</button>
            </div>
          </div>
        </div>
      }
    </div>
  `
})
export class LeadFormComponent implements OnInit {
  private db = inject(ApplicationDatabase);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  stallService = inject(StallService);

  readonly predefinedDesignations = PREDEFINED_DESIGNATIONS;

  editingLeadId: string | null = null;
  existingLeadNumber: string | null = null;
  existingCreatedAt: string | null = null;
  isEditMode = signal(false);
  activeToolTab = signal<'all' | 'ocr' | 'qr' | 'voice'>('all');

  name = '';
  company = '';
  phoneNumbers: string[] = [''];

  get phone(): string {
    return this.phoneNumbers.map(p => p.trim()).filter(p => p.length > 0).join(', ');
  }

  set phone(val: string) {
    if (!val || !val.trim()) {
      this.phoneNumbers = [''];
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
      this.phoneNumbers = uniquePhones.slice(0, 3);
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
      this.phoneNumbers = uniqueParts.length > 0 ? uniqueParts.slice(0, 3) : [''];
    }
  }

  addPhoneInput(): void {
    if (this.phoneNumbers.length < 3) {
      this.phoneNumbers.push('');
    }
  }

  removePhoneInput(index: number): void {
    if (index > 0 && index < this.phoneNumbers.length) {
      this.phoneNumbers.splice(index, 1);
    }
  }

  email = '';
  designation = '';
  website = '';
  address = '';
  interestLevel: 'Hot' | 'Warm' | 'Cold' = 'Warm';
  remarks = '';
  voiceBlob: Blob | string | null = null;
  voiceNotesTranscript: string = '';
  scannedPhotoDataUrl: string | null = null;

  captureMethod: CaptureMethod = 'manual';
  isAutoFilled = signal(false);
  exhibitionService = inject(ExhibitionService);

  sessionLeads = signal<LocalLead[]>([]);
  selectedLeadForView = signal<LocalLead | null>(null);

  activeStallSubtitle = computed(() => {
    const stall = this.stallService.activeStall();
    if (!stall) return 'Main Exhibition & Stall';
    const exh = stall.exhibitionId
      ? this.exhibitionService.exhibitions().find((e) => e.id === stall.exhibitionId)
      : null;
    if (exh) {
      return `${exh.name} - ${stall.name} (${stall.code})`;
    }
    return `${stall.name} (${stall.code})`;
  });

  currentPage = signal<number>(1);
  pageSizeSelect = 20;
  pageSize = signal<number>(20);

  paginatedSessionLeads = computed(() => {
    const list = this.sessionLeads();
    const size = this.pageSize();
    const page = this.currentPage();
    const start = (page - 1) * size;
    return list.slice(start, start + size);
  });

  startIndex = computed(() => {
    if (this.sessionLeads().length === 0) return 0;
    return (this.currentPage() - 1) * this.pageSize() + 1;
  });

  endIndex = computed(() => {
    const end = this.currentPage() * this.pageSize();
    return Math.min(end, this.sessionLeads().length);
  });

  onPageSizeChange(): void {
    this.pageSize.set(Number(this.pageSizeSelect));
    this.currentPage.set(1);
  }

  prevPage(): void {
    if (this.currentPage() > 1) {
      this.currentPage.update((p) => p - 1);
    }
  }

  nextPage(): void {
    if (this.endIndex() < this.sessionLeads().length) {
      this.currentPage.update((p) => p + 1);
    }
  }
  isTargetModalOpen = signal<boolean>(false);
  targetExhibitionId = signal<string>('');
  targetStallId = signal<string>('');

  targetStalls = computed(() => {
    const exhId = this.targetExhibitionId();
    if (!exhId) return [];
    return this.stallService.stalls().filter(
      (s) => s.exhibitionId === exhId || (!s.exhibitionId && exhId === '44444444-4444-4444-4444-444444444444')
    );
  });

  openTargetSelectionModal(): void {
    this.exhibitionService.loadExhibitions();
    this.stallService.loadStalls();
    
    const activeStall = this.stallService.activeStall();
    if (activeStall?.exhibitionId) {
      this.targetExhibitionId.set(activeStall.exhibitionId);
    } else {
      this.targetExhibitionId.set(this.exhibitionService.exhibitions()[0]?.id || '');
    }
    this.targetStallId.set(activeStall?.id || '');
    this.isTargetModalOpen.set(true);
  }

  selectTargetExhibition(exhId: string): void {
    this.targetExhibitionId.set(exhId);
    this.targetStallId.set('');
  }

  closeTargetSelectionModal(): void {
    this.isTargetModalOpen.set(false);
  }

  confirmTargetStallSelection(): void {
    const stall = this.stallService.stalls().find((s) => s.id === this.targetStallId());
    if (stall) {
      this.stallService.setActiveStall(stall);
    }
    const exh = this.exhibitionService.exhibitions().find((e) => e.id === this.targetExhibitionId());
    if (exh) {
      this.exhibitionService.setActiveExhibition(exh);
    }
    this.isTargetModalOpen.set(false);
  }
  savedMessage = signal<string | null>(null);

  quickChips = [
    'Need Urgent Quotation',
    'Schedule Demo Session',
    'High Budget Opportunity',
    'Send Product Catalog PDF',
    'Decision Maker'
  ];

  async ngOnInit(): Promise<void> {
    this.exhibitionService.loadExhibitions();
    this.stallService.loadStalls();

    const stallIdParam = this.route.snapshot.queryParamMap.get('stallId');
    if (stallIdParam) {
      const stall = this.stallService.stalls().find((s) => s.id === stallIdParam);
      if (stall) {
        this.stallService.setActiveStall(stall);
      }
    }

    const idParam = this.route.snapshot.paramMap.get('id') || this.route.snapshot.queryParamMap.get('id');
    if (idParam) {
      this.editingLeadId = idParam;
      this.isEditMode.set(true);
      await this.loadLeadForEdit(idParam);
    }

    // Temporary preview grid starts empty for each new session
    this.sessionLeads.set([]);
  }

  formatTimeDisplay(dateStr: string | undefined | null): string {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '-';
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return '-';
    }
  }

  getPhoneNumbersList(phoneStr: string | undefined | null): string[] {
    if (!phoneStr || !phoneStr.trim()) return ['-'];
    return phoneStr.split(/[,/]+/).map(p => p.trim()).filter(p => p.length > 0);
  }

  loadLeadForEditFromPreview(lead: LocalLead): void {
    this.editingLeadId = lead.id;
    this.existingLeadNumber = lead.leadNumber || null;
    this.existingCreatedAt = lead.createdAt;
    this.isEditMode.set(true);

    this.name = lead.name;
    this.company = lead.company || '';
    if (lead.phone) {
      this.phoneNumbers = lead.phone.split(/[,/]+/).map((p) => p.trim()).filter((p) => p.length > 0);
      if (this.phoneNumbers.length === 0) this.phoneNumbers = [''];
    }
    this.email = lead.email || '';
    this.designation = lead.designation || '';
    this.website = lead.website || '';
    this.address = lead.address || '';
    this.interestLevel = lead.interestLevel;
    this.remarks = lead.remarks || '';
    this.voiceBlob = lead.voiceBlob || null;
    this.voiceNotesTranscript = lead.voiceNotesTranscript || '';
    this.scannedPhotoDataUrl = typeof lead.photoBlob === 'string' ? lead.photoBlob : null;
    this.captureMethod = lead.captureMethod || 'manual';
    this.isAutoFilled.set(true);

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async loadLeadForEdit(id: string): Promise<void> {
    const lead = await this.db.getLeadById(id);
    if (lead) {
      this.name = lead.name;
      this.existingLeadNumber = lead.leadNumber || null;
      this.company = lead.company || '';
      this.phone = lead.phone;
      this.email = lead.email || '';
      this.designation = lead.designation || '';
      this.website = lead.website || '';
      this.address = lead.address || '';
      this.interestLevel = lead.interestLevel;
      this.remarks = lead.remarks || '';
      this.voiceBlob = lead.voiceBlob || null;
      this.voiceNotesTranscript = lead.voiceNotesTranscript || '';
      this.scannedPhotoDataUrl = typeof lead.photoBlob === 'string' ? lead.photoBlob : null;
      this.captureMethod = lead.captureMethod || 'manual';
      this.existingCreatedAt = lead.createdAt;
    } else {
      alert('Selected lead record not found.');
      this.router.navigate(['/leads']);
    }
  }

  async generateNextLeadNumber(): Promise<string> {
    const activeStall = this.stallService.activeStall();
    let stallNum = 1;
    if (activeStall?.code) {
      const match = activeStall.code.match(/\d+$/) || activeStall.code.match(/\d+/);
      if (match) {
        stallNum = parseInt(match[0], 10);
      }
    }
    const prefix = `S${stallNum}L`;

    const allLeads = await this.db.getAllLeads();
    let maxSeq = 0;
    for (const lead of allLeads) {
      if (lead.leadNumber) {
        const match = lead.leadNumber.match(/S\d+L(\d+)/i);
        if (match && match[1]) {
          const seq = parseInt(match[1], 10);
          if (seq > maxSeq) maxSeq = seq;
        }
      }
    }
    const nextSeq = maxSeq + 1;
    return `${prefix}${nextSeq.toString().padStart(5, '0')}`;
  }

  onCardExtracted(data: ExtractedCardData): void {
    if (data.name) this.name = data.name;
    if (data.company) this.company = data.company;
    if (data.phone) this.phone = data.phone;
    if (data.email) this.email = data.email;
    if (data.designation) this.designation = data.designation;
    if (data.website) this.website = data.website;
    if (data.address) this.address = data.address;
    if (data.photoDataUrl) this.scannedPhotoDataUrl = data.photoDataUrl;
    this.captureMethod = 'card_ocr';
    this.isAutoFilled.set(true);
  }

  onQrScanned(data: QrParsedContact): void {
    if (data.name) this.name = data.name;
    if (data.company) this.company = data.company;
    if (data.phone) this.phone = data.phone;
    if (data.email) this.email = data.email;
    if (data.designation) this.designation = data.designation;
    if (data.website) this.website = data.website;
    if (data.address) this.address = data.address;
    if (data.remarks && !this.remarks) this.remarks = data.remarks;
    this.captureMethod = 'qr_scan';
    this.isAutoFilled.set(true);
  }

  onVoiceRecorded(blob: Blob): void {
    this.voiceBlob = blob;
    if (this.captureMethod === 'manual') {
      this.captureMethod = 'voice_note';
    }
  }

  onTranscriptGenerated(transcript: string): void {
    this.voiceNotesTranscript = transcript;
    if (transcript) {
      if (!this.remarks) {
        this.remarks = transcript;
      } else if (!this.remarks.includes(transcript)) {
        // If remarks already has text, append transcript nicely
        this.remarks = `${this.remarks.trim()}\n[Voice Note]: ${transcript}`;
      }
    }
  }

  onVoiceCleared(): void {
    this.voiceBlob = null;
    this.voiceNotesTranscript = '';
  }

  addQuickRemark(chip: string): void {
    if (this.remarks) {
      this.remarks += `, ${chip}`;
    } else {
      this.remarks = chip;
    }
  }

  resetForm(): void {
    this.name = '';
    this.company = '';
    this.phone = '';
    this.email = '';
    this.designation = '';
    this.website = '';
    this.address = '';
    this.remarks = '';
    this.voiceBlob = null;
    this.voiceNotesTranscript = '';
    this.scannedPhotoDataUrl = null;
    this.interestLevel = 'Warm';
    this.captureMethod = 'manual';
    this.isAutoFilled.set(false);
  }

  private async saveImageToLocalDeviceFolder(dataUrl: string, leadNumber: string): Promise<void> {
    try {
      // Direct silent write to device folder via backend local endpoint
      const apiUrl = `${getApiUrl()}/v1/leads/save-image-local`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadNumber: leadNumber,
          photoDataUrl: dataUrl
        })
      });
      if (response.ok) {
        const res = await response.json();
        console.log(`[LeadForm] Image written directly to device folder: ${res.savedDevicePath}`);
      }
    } catch (e) {
      console.warn('[LeadForm] Backend local folder save offline/unavailable:', e);
    }
  }

  async saveLead(): Promise<void> {
    if (!this.name || !this.phone) {
      alert('Full Name and Mobile Phone are required.');
      return;
    }

    const activeStallId = this.stallService.activeStall()?.id || '33333333-3333-3333-3333-333333333333';

    let leadNumberToUse = this.existingLeadNumber;
    if (!leadNumberToUse) {
      leadNumberToUse = await this.generateNextLeadNumber();
    }

    // Save image directly to device folder Pictures/Exhibition_Card_Images/S1L09698.jpg
    if (this.scannedPhotoDataUrl) {
      await this.saveImageToLocalDeviceFolder(this.scannedPhotoDataUrl, leadNumberToUse);
    }

    const leadToSave: LocalLead = {
      id: this.editingLeadId || crypto.randomUUID(),
      leadNumber: leadNumberToUse,
      exhibitionId: activeStallId,
      repId: 'REP_001',
      name: this.name,
      company: this.company,
      phone: this.phone,
      email: this.email,
      designation: this.designation,
      website: this.website,
      address: this.address,
      captureMethod: this.captureMethod,
      photoBlob: this.scannedPhotoDataUrl || undefined,
      voiceBlob: this.voiceBlob || undefined,
      voiceNotesTranscript: this.voiceNotesTranscript || undefined,
      interestLevel: this.interestLevel,
      productCategory: ['Enterprise'],
      priority: 'High',
      remarks: this.remarks,
      status: 'New',
      syncStatus: 'Pending',
      createdAt: this.existingCreatedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await this.db.saveLead(leadToSave);
    const actionText = this.isEditMode() ? 'updated' : 'saved';
    
    // Add saved lead to session preview grid immediately
    this.sessionLeads.update(list => [leadToSave, ...list.filter(l => l.id !== leadToSave.id)]);
    this.currentPage.set(1);

    this.savedMessage.set(`Lead ${leadNumberToUse} ${actionText} successfully and added to preview grid below!`);

    // Reset form for continuous bulk lead entry without page navigation
    this.isEditMode.set(false);
    this.editingLeadId = null;
    this.existingLeadNumber = null;
    this.existingCreatedAt = null;
    this.resetForm();

    setTimeout(() => {
      this.savedMessage.set(null);
    }, 4000);
  }
}

