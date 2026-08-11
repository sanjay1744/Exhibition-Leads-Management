import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { ApplicationDatabase } from '../../core/services/db.service';
import { LocalLead } from '../../core/models/lead.model';
import { StallService } from '../../core/services/stall.service';

@Component({
  selector: 'app-lead-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div>
    <div>
      <!-- Page Title & Top Action Bar -->
      <div class="flex items-center justify-between mb-5">
        <div>
          <div class="flex items-center gap-2.5">
            <h1 class="text-xl font-black text-slate-900 uppercase tracking-tight">LEADS DIRECTORY</h1>
          </div>
          <p class="text-xs text-slate-500 font-medium">Live Management Grid of Captured Visitor Enquiries {{ selectedStallId() === 'ALL' ? 'for All Stalls' : ('for ' + (stallService.activeStall()?.name || 'Active Stall')) }}</p>
        </div>

        <div class="flex items-center gap-2.5">
          <a routerLink="/capture" class="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs px-4 py-2.5 rounded-xl font-extrabold flex items-center gap-2 shadow-sm transition-all hover:shadow-md">
            <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"></path>
            </svg>
              New Lead
          </a>
        </div>
      </div>

      <!-- Combined Control Header: Active Stall + Multi-Column Filter Bar -->
      <div class="bg-white border border-slate-200/80 rounded-2xl mb-6 shadow-sm divide-y divide-slate-100 relative">
        
        <!-- Top Section: Active Stall Selector + Owner -->
        <div class="p-3.5 sm:p-4 bg-slate-50/60 flex flex-wrap items-center justify-between gap-3 rounded-t-2xl">
          <div class="flex flex-wrap items-center gap-3">
            <div class="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center font-bold shrink-0">
              <span class="material-icons text-lg">storefront</span>
            </div>
            <div>
              <div class="text-[10px] uppercase font-extrabold text-slate-700 tracking-wider">ACTIVE STALL</div>
              <div class="relative">
                <div 
                  (click)="openStallDropdown()" 
                  class="border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 bg-white outline-none hover:border-slate-400 transition-all cursor-pointer shadow-2xs flex items-center justify-between gap-2.5 min-w-[200px]"
                  [ngClass]="showStallDropdown() ? 'border-blue-600 ring-2 ring-blue-500/20' : ''"
                >
                  <span class="truncate text-slate-900 font-bold">{{ getSelectedStallName() }}</span>
                  <svg class="w-4 h-4 text-slate-500 shrink-0 transition-transform duration-200" [ngClass]="{'rotate-180': showStallDropdown()}" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                  </svg>
                </div>

                @if (showStallDropdown()) {
                  <div class="absolute left-0 top-full mt-1.5 z-50 w-72 bg-white border border-slate-200/90 rounded-2xl p-1.5 shadow-xl backdrop-blur-md">
                    <div class="fixed inset-0 z-[-1]" (click)="showStallDropdown.set(false)"></div>

                    <button 
                      type="button"
                      (click)="onStallFilterChange('ALL'); showStallDropdown.set(false)"
                      class="w-full text-left px-3 py-2 text-xs font-bold rounded-xl transition-colors flex items-center justify-between"
                      [ngClass]="selectedStallId() === 'ALL' ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'"
                    >
                      <span>All Stalls (All Leads)</span>
                      @if (selectedStallId() === 'ALL') {
                        <svg class="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path>
                        </svg>
                      }
                    </button>

                    @for (stall of stallService.stalls(); track stall.id) {
                      <button 
                        type="button"
                        (click)="onStallFilterChange(stall.id); showStallDropdown.set(false)"
                        class="w-full text-left px-3 py-2 text-xs font-bold rounded-xl transition-colors flex items-center justify-between"
                        [ngClass]="selectedStallId() === stall.id ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'"
                      >
                        <span class="truncate">{{ stall.name }} ({{ stall.code }})</span>
                        @if (selectedStallId() === stall.id) {
                          <svg class="w-3.5 h-3.5 text-blue-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path>
                          </svg>
                        }
                      </button>
                    }
                  </div>
                }
              </div>
            </div>
          </div>

          <div class="text-xs bg-white text-slate-700 px-3.5 py-1.5 rounded-xl font-medium border border-slate-200 shadow-2xs flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Owner: <strong class="font-extrabold text-slate-900">{{ selectedStallId() === 'ALL' ? 'All Owners' : (stallService.activeStall()?.ownerName || 'Thalaimalai') }}</strong>
          </div>
        </div>

        <!-- Middle Section: Always Visible Lead Interest Dashboard + Filters Button -->
        <div class="p-3.5 sm:p-4 bg-white flex flex-wrap items-center gap-3 sm:gap-4">
          <span class="text-[10px] font-extrabold text-slate-700 uppercase tracking-wider block shrink-0">LEAD INTEREST DASHBOARD:</span>
          
          <div class="flex flex-wrap items-center gap-2 sm:gap-3">
            <!-- Hot Leads Metric Button -->
            <button 
              type="button" 
              (click)="filterInterest.set(filterInterest() === 'Hot' ? 'ALL' : 'Hot'); currentPage.set(1)" 
              class="px-2.5 sm:px-4 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center justify-between gap-1 sm:gap-2.5 shadow-2xs active:scale-95 cursor-pointer min-w-0"
              [ngClass]="filterInterest() === 'Hot' ? 'bg-red-600 text-white border-red-600 shadow-md ring-2 ring-red-500/20' : 'bg-red-50/60 hover:bg-red-100/80 text-red-800 border-red-200/80'"
            >
              <div class="flex items-center gap-1 sm:gap-1.5 min-w-0">
                <span class="text-xs sm:text-sm shrink-0">🔥</span>
                <span class="text-[11px] sm:text-xs font-extrabold truncate">Hot<span class="hidden sm:inline"> Leads</span></span>
              </div>
              <span 
                class="w-5 h-5 sm:w-6 sm:h-6 rounded-full text-[10px] sm:text-[11px] font-black shrink-0 flex items-center justify-center text-center ml-1"
                [ngClass]="filterInterest() === 'Hot' ? 'bg-white/25 text-white' : 'bg-red-200/80 text-red-900'"
              >
                {{ hotLeadsCount() }}
              </span>
            </button>

            <!-- Warm Leads Metric Button -->
            <button 
              type="button" 
              (click)="filterInterest.set(filterInterest() === 'Warm' ? 'ALL' : 'Warm'); currentPage.set(1)" 
              class="px-2.5 sm:px-4 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center justify-between gap-1 sm:gap-2.5 shadow-2xs active:scale-95 cursor-pointer min-w-0"
              [ngClass]="filterInterest() === 'Warm' ? 'bg-amber-500 text-white border-amber-500 shadow-md ring-2 ring-amber-500/20' : 'bg-amber-50/60 hover:bg-amber-100/80 text-amber-800 border-amber-200/80'"
            >
              <div class="flex items-center gap-1 sm:gap-1.5 min-w-0">
                <span class="text-xs sm:text-sm shrink-0">⚡</span>
                <span class="text-[11px] sm:text-xs font-extrabold truncate">Warm<span class="hidden sm:inline"> Leads</span></span>
              </div>
              <span 
                class="w-5 h-5 sm:w-6 sm:h-6 rounded-full text-[10px] sm:text-[11px] font-black shrink-0 flex items-center justify-center text-center ml-1"
                [ngClass]="filterInterest() === 'Warm' ? 'bg-white/25 text-white' : 'bg-amber-200/80 text-amber-900'"
              >
                {{ warmLeadsCount() }}
              </span>
            </button>

            <!-- Cold Leads Metric Button -->
            <button 
              type="button" 
              (click)="filterInterest.set(filterInterest() === 'Cold' ? 'ALL' : 'Cold'); currentPage.set(1)" 
              class="px-2.5 sm:px-4 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center justify-between gap-1 sm:gap-2.5 shadow-2xs active:scale-95 cursor-pointer min-w-0"
              [ngClass]="filterInterest() === 'Cold' ? 'bg-blue-600 text-white border-blue-600 shadow-md ring-2 ring-blue-500/20' : 'bg-blue-50/60 hover:bg-blue-100/80 text-blue-800 border-blue-200/80'"
            >
              <div class="flex items-center gap-1 sm:gap-1.5 min-w-0">
                <span class="text-xs sm:text-sm shrink-0">❄️</span>
                <span class="text-[11px] sm:text-xs font-extrabold truncate">Cold<span class="hidden sm:inline"> Leads</span></span>
              </div>
              <span 
                class="w-5 h-5 sm:w-6 sm:h-6 rounded-full text-[10px] sm:text-[11px] font-black shrink-0 flex items-center justify-center text-center ml-1"
                [ngClass]="filterInterest() === 'Cold' ? 'bg-white/25 text-white' : 'bg-blue-200/80 text-blue-900'"
              >
                {{ coldLeadsCount() }}
              </span>
            </button>

            <!-- Filters Toggle Button Placed Next to Cold Leads -->
            <button 
              type="button" 
              (click)="toggleFilterSection()" 
              class="border border-slate-300 hover:border-blue-500 rounded-xl px-3 py-1.5 text-xs font-extrabold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer shrink-0 ml-1"
              [ngClass]="showFilterSection() ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : (hasActiveFilters() ? 'bg-blue-50 text-blue-700 border-blue-300' : 'bg-white text-slate-700 hover:bg-slate-50')"
            >
              <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"></path>
              </svg>
              <span>Filters</span>
              @if (hasActiveFilters()) {
                <span class="w-2 h-2 rounded-full" [ngClass]="showFilterSection() ? 'bg-white' : 'bg-blue-600'"></span>
              }
              <svg class="w-3.5 h-3.5 shrink-0 transition-transform duration-200" [ngClass]="{'rotate-180': showFilterSection()}" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
              </svg>
            </button>
          </div>
        </div>

        <!-- Collapsible Section: Advanced Filter & Search Grid -->
        @if (showFilterSection()) {
          <div class="p-4 space-y-4 bg-slate-50/30">
            <!-- Filter Header Bar -->
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <div class="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"></path>
                  </svg>
                </div>
                <span class="text-xs font-black text-slate-900 uppercase tracking-wide">FILTER & SEARCH LEADS</span>
              </div>

              @if (hasActiveFilters()) {
                <button 
                  type="button" 
                  (click)="resetAllFilters()" 
                  class="text-xs text-rose-600 hover:text-rose-700 font-bold flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100/80 px-3 py-1 rounded-lg border border-rose-200/80 transition-all shadow-2xs"
                >
                  <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                  </svg>
                  Reset Filters
                </button>
              }
            </div>

            <!-- Filter Controls Grid -->
            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              
              <!-- 1. Text Search Input -->
              <div class="lg:col-span-2">
                <label class="block text-[10px] font-extrabold text-slate-700 uppercase tracking-wider mb-1">SEARCH (NAME / COMPANY / PHONE / NO.)</label>
                <div class="relative flex items-center">
                  <svg class="w-4 h-4 text-slate-400 absolute left-3 shrink-0 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                  </svg>
                  <input 
                    type="text" 
                    [ngModel]="searchTerm()" 
                    (ngModelChange)="searchTerm.set($event); currentPage.set(1)" 
                    placeholder="Search by visitor name, company, phone..." 
                    class="w-full text-xs pl-9 pr-8 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 font-medium bg-slate-50/60 focus:bg-white transition-all text-slate-900 placeholder-slate-400 shadow-2xs"
                  />
                  @if (searchTerm()) {
                    <button 
                      type="button" 
                      (click)="searchTerm.set(''); currentPage.set(1)" 
                      class="absolute right-2.5 text-slate-400 hover:text-slate-600 p-0.5 rounded-md hover:bg-slate-100 transition-colors"
                    >
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                      </svg>
                    </button>
                  }
                </div>
              </div>

              <!-- 2. Date Created From -->
              <div class="relative">
                <label class="block text-[10px] font-extrabold text-slate-700 uppercase tracking-wider mb-1">From Date*</label>
                <div 
                  (click)="openDatePicker('from')" 
                  class="w-full text-xs px-3 py-2 border rounded-xl outline-none transition-all cursor-pointer shadow-2xs flex items-center justify-between gap-1.5 bg-slate-50/60 hover:bg-white"
                  [ngClass]="showDatePicker() === 'from' ? 'border-blue-600 ring-2 ring-blue-500/20 bg-white' : 'border-slate-200'"
                >
                  <span [ngClass]="filterDateFrom() ? 'font-bold text-slate-900' : 'font-medium text-slate-400'" class="truncate">
                    {{ filterDateFrom() ? formatDateDisplay(filterDateFrom()) : 'Select Date' }}
                  </span>
                  <button type="button" class="text-blue-600 hover:text-blue-800 p-0.5 shrink-0">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                    </svg>
                  </button>
                </div>

                <!-- Calendar Popover for From Date -->
                @if (showDatePicker() === 'from') {
                  <div class="absolute left-0 top-full mt-2 z-50 w-72 bg-slate-100 border border-slate-200 rounded-2xl p-3.5 shadow-2xl">
                    <!-- Backdrop click blocker -->
                    <div class="fixed inset-0 z-[-1]" (click)="closeDatePicker()"></div>

                    <!-- Calendar Header Bar -->
                    <div class="flex items-center justify-between mb-3 px-1">
                      <div class="flex items-center gap-1 text-xs font-bold uppercase text-slate-800 tracking-wider">
                        <span>{{ monthShortNames[currentPickerMonth()] }} {{ currentPickerYear() }}</span>
                        <svg class="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                        </svg>
                      </div>

                      <div class="flex items-center gap-1">
                        <button 
                          type="button" 
                          (click)="prevPickerMonth()" 
                          class="w-7 h-7 rounded-full bg-white hover:bg-slate-200 text-slate-700 border border-slate-200 flex items-center justify-center transition-all"
                          title="Previous Month"
                        >
                          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
                          </svg>
                        </button>
                        <button 
                          type="button" 
                          (click)="nextPickerMonth()" 
                          class="w-7 h-7 rounded-full bg-white hover:bg-slate-200 text-slate-700 border border-slate-200 flex items-center justify-center transition-all"
                          title="Next Month"
                        >
                          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                          </svg>
                        </button>
                      </div>
                    </div>

                    <!-- Days of Week Header -->
                    <div class="grid grid-cols-7 gap-1 text-center mb-1.5">
                      @for (wDay of weekDayNames; track $index) {
                        <div class="text-[11px] font-bold text-slate-500 py-0.5">
                          {{ wDay }}
                        </div>
                      }
                    </div>

                    <!-- Month Subtitle -->
                    <div class="text-[10px] font-bold uppercase text-slate-400 tracking-wider px-1 mb-1">
                      {{ monthShortNames[currentPickerMonth()] }}
                    </div>

                    <!-- Days Grid -->
                    <div class="grid grid-cols-7 gap-1 text-center text-xs mb-3">
                      @for (cell of pickerCalendarDays(); track cell.dateStr) {
                        <button
                          type="button"
                          (click)="selectPickerDate(cell.dateStr)"
                          [disabled]="!cell.isCurrentMonth"
                          class="w-8 h-8 rounded-full font-semibold flex items-center justify-center transition-all mx-auto text-[11px]"
                          [ngClass]="{
                            'opacity-30 cursor-not-allowed text-slate-400': !cell.isCurrentMonth,
                            'bg-[#2b6693] text-white shadow-sm font-bold': isDateSelected(cell.dateStr),
                            'ring-2 ring-[#2b6693] text-[#2b6693] font-bold bg-white': isTodayDate(cell.dateStr) && !isDateSelected(cell.dateStr),
                            'bg-blue-100/70 text-blue-900 font-bold': isInRangeDate(cell.dateStr) && !isDateSelected(cell.dateStr),
                            'hover:bg-slate-200 text-slate-700': cell.isCurrentMonth && !isDateSelected(cell.dateStr) && !isInRangeDate(cell.dateStr)
                          }"
                        >
                          {{ cell.dayNum }}
                        </button>
                      }
                    </div>

                    <!-- Quick Range Buttons Inside Popover -->
                    <div class="pt-2 border-t border-slate-200/80 flex items-center justify-between gap-1 text-[10px]">
                      <button 
                        type="button" 
                        (click)="setTodayFilter(); closeDatePicker()" 
                        class="text-blue-700 hover:text-blue-900 font-bold px-2 py-1 bg-white hover:bg-blue-50 border border-slate-200 rounded-lg transition-colors"
                      >
                        Today
                      </button>
                      <button 
                        type="button" 
                        (click)="setThisMonthFilter(); closeDatePicker()" 
                        class="text-blue-700 hover:text-blue-900 font-bold px-2 py-1 bg-white hover:bg-blue-50 border border-slate-200 rounded-lg transition-colors"
                      >
                        This Month
                      </button>
                      <button 
                        type="button" 
                        (click)="filterDateFrom.set(''); filterDateTo.set(''); closeDatePicker()" 
                        class="text-rose-600 hover:text-rose-800 font-bold px-2 py-1 bg-white hover:bg-rose-50 border border-slate-200 rounded-lg transition-colors"
                      >
                        Clear
                      </button>
                    </div>

                  </div>
                }
              </div>

              <!-- 3. Date Created To -->
              <div class="relative">
                <label class="block text-[10px] font-extrabold text-slate-700 uppercase tracking-wider mb-1">To Date*</label>
                <div 
                  (click)="openDatePicker('to')" 
                  class="w-full text-xs px-3 py-2 border rounded-xl outline-none transition-all cursor-pointer shadow-2xs flex items-center justify-between gap-1.5 bg-slate-50/60 hover:bg-white"
                  [ngClass]="showDatePicker() === 'to' ? 'border-blue-600 ring-2 ring-blue-500/20 bg-white' : 'border-slate-200'"
                >
                  <span [ngClass]="filterDateTo() ? 'font-bold text-slate-900' : 'font-medium text-slate-400'" class="truncate">
                    {{ filterDateTo() ? formatDateDisplay(filterDateTo()) : 'Select Date' }}
                  </span>
                  <button type="button" class="text-blue-600 hover:text-blue-800 p-0.5 shrink-0">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                    </svg>
                  </button>
                </div>

                <!-- Calendar Popover for To Date -->
                @if (showDatePicker() === 'to') {
                  <div class="absolute left-0 sm:right-0 sm:left-auto top-full mt-2 z-50 w-72 bg-slate-100 border border-slate-200 rounded-2xl p-3.5 shadow-2xl">
                    <!-- Backdrop click blocker -->
                    <div class="fixed inset-0 z-[-1]" (click)="closeDatePicker()"></div>

                    <!-- Calendar Header Bar -->
                    <div class="flex items-center justify-between mb-3 px-1">
                      <div class="flex items-center gap-1 text-xs font-bold uppercase text-slate-800 tracking-wider">
                        <span>{{ monthShortNames[currentPickerMonth()] }} {{ currentPickerYear() }}</span>
                        <svg class="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                        </svg>
                      </div>

                      <div class="flex items-center gap-1">
                        <button 
                          type="button" 
                          (click)="prevPickerMonth()" 
                          class="w-7 h-7 rounded-full bg-white hover:bg-slate-200 text-slate-700 border border-slate-200 flex items-center justify-center transition-all"
                          title="Previous Month"
                        >
                          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
                          </svg>
                        </button>
                        <button 
                          type="button" 
                          (click)="nextPickerMonth()" 
                          class="w-7 h-7 rounded-full bg-white hover:bg-slate-200 text-slate-700 border border-slate-200 flex items-center justify-center transition-all"
                          title="Next Month"
                        >
                          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                          </svg>
                        </button>
                      </div>
                    </div>

                    <!-- Days of Week Header -->
                    <div class="grid grid-cols-7 gap-1 text-center mb-1.5">
                      @for (wDay of weekDayNames; track $index) {
                        <div class="text-[11px] font-bold text-slate-500 py-0.5">
                          {{ wDay }}
                        </div>
                      }
                    </div>

                    <!-- Month Subtitle -->
                    <div class="text-[10px] font-bold uppercase text-slate-400 tracking-wider px-1 mb-1">
                      {{ monthShortNames[currentPickerMonth()] }}
                    </div>

                    <!-- Days Grid -->
                    <div class="grid grid-cols-7 gap-1 text-center text-xs mb-3">
                      @for (cell of pickerCalendarDays(); track cell.dateStr) {
                        <button
                          type="button"
                          (click)="selectPickerDate(cell.dateStr)"
                          [disabled]="!cell.isCurrentMonth"
                          class="w-8 h-8 rounded-full font-semibold flex items-center justify-center transition-all mx-auto text-[11px]"
                          [ngClass]="{
                            'opacity-30 cursor-not-allowed text-slate-400': !cell.isCurrentMonth,
                            'bg-[#2b6693] text-white shadow-sm font-bold': isDateSelected(cell.dateStr),
                            'ring-2 ring-[#2b6693] text-[#2b6693] font-bold bg-white': isTodayDate(cell.dateStr) && !isDateSelected(cell.dateStr),
                            'bg-blue-100/70 text-blue-900 font-bold': isInRangeDate(cell.dateStr) && !isDateSelected(cell.dateStr),
                            'hover:bg-slate-200 text-slate-700': cell.isCurrentMonth && !isDateSelected(cell.dateStr) && !isInRangeDate(cell.dateStr)
                          }"
                        >
                          {{ cell.dayNum }}
                        </button>
                      }
                    </div>

                    <!-- Quick Range Buttons Inside Popover -->
                    <div class="pt-2 border-t border-slate-200/80 flex items-center justify-between gap-1 text-[10px]">
                      <button 
                        type="button" 
                        (click)="setTodayFilter(); closeDatePicker()" 
                        class="text-blue-700 hover:text-blue-900 font-bold px-2 py-1 bg-white hover:bg-blue-50 border border-slate-200 rounded-lg transition-colors"
                      >
                        Today
                      </button>
                      <button 
                        type="button" 
                        (click)="setThisMonthFilter(); closeDatePicker()" 
                        class="text-blue-700 hover:text-blue-900 font-bold px-2 py-1 bg-white hover:bg-blue-50 border border-slate-200 rounded-lg transition-colors"
                      >
                        This Month
                      </button>
                      <button 
                        type="button" 
                        (click)="filterDateFrom.set(''); filterDateTo.set(''); closeDatePicker()" 
                        class="text-rose-600 hover:text-rose-800 font-bold px-2 py-1 bg-white hover:bg-rose-50 border border-slate-200 rounded-lg transition-colors"
                      >
                        Clear
                      </button>
                    </div>

                  </div>
                }
              </div>

              <!-- 4. Interest Level Custom Dropdown -->
              <div class="relative">
                <label class="block text-[10px] font-extrabold text-slate-700 uppercase tracking-wider mb-1">INTEREST LEVEL</label>
                <div 
                  (click)="openInterestDropdown()" 
                  class="w-full text-xs px-3 py-2 border rounded-xl outline-none transition-all cursor-pointer shadow-2xs flex items-center justify-between gap-1.5 bg-slate-50/60 hover:bg-white"
                  [ngClass]="showInterestDropdown() ? 'border-blue-600 ring-2 ring-blue-500/20 bg-white' : 'border-slate-200'"
                >
                  <span [ngClass]="filterInterest() !== 'ALL' ? 'font-bold text-slate-900' : 'font-medium text-slate-400'" class="truncate">
                    {{ filterInterest() === 'ALL' ? 'All Levels' : filterInterest() }}
                  </span>
                  <svg class="w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200" [ngClass]="{'rotate-180': showInterestDropdown()}" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                  </svg>
                </div>

                <!-- Custom Rounded Dropdown Menu -->
                @if (showInterestDropdown()) {
                  <div class="absolute left-0 top-full mt-1.5 z-50 w-full min-w-[140px] bg-white border border-slate-200/90 rounded-2xl p-1.5 shadow-xl backdrop-blur-md">
                    <div class="fixed inset-0 z-[-1]" (click)="showInterestDropdown.set(false)"></div>

                    <button 
                      type="button"
                      (click)="filterInterest.set('ALL'); currentPage.set(1); showInterestDropdown.set(false)"
                      class="w-full text-left px-3 py-2 text-xs font-semibold rounded-xl transition-colors flex items-center justify-between"
                      [ngClass]="filterInterest() === 'ALL' ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-700 hover:bg-slate-50'"
                    >
                      <span>All Levels</span>
                      @if (filterInterest() === 'ALL') {
                        <svg class="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path>
                        </svg>
                      }
                    </button>

                    <button 
                      type="button"
                      (click)="filterInterest.set('Hot'); currentPage.set(1); showInterestDropdown.set(false)"
                      class="w-full text-left px-3 py-2 text-xs font-semibold rounded-xl transition-colors flex items-center justify-between"
                      [ngClass]="filterInterest() === 'Hot' ? 'bg-red-50 text-red-700 font-bold' : 'text-slate-700 hover:bg-slate-50'"
                    >
                      <span>Hot</span>
                      @if (filterInterest() === 'Hot') {
                        <svg class="w-3.5 h-3.5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path>
                        </svg>
                      }
                    </button>

                    <button 
                      type="button"
                      (click)="filterInterest.set('Warm'); currentPage.set(1); showInterestDropdown.set(false)"
                      class="w-full text-left px-3 py-2 text-xs font-semibold rounded-xl transition-colors flex items-center justify-between"
                      [ngClass]="filterInterest() === 'Warm' ? 'bg-amber-50 text-amber-700 font-bold' : 'text-slate-700 hover:bg-slate-50'"
                    >
                      <span>Warm</span>
                      @if (filterInterest() === 'Warm') {
                        <svg class="w-3.5 h-3.5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path>
                        </svg>
                      }
                    </button>

                    <button 
                      type="button"
                      (click)="filterInterest.set('Cold'); currentPage.set(1); showInterestDropdown.set(false)"
                      class="w-full text-left px-3 py-2 text-xs font-semibold rounded-xl transition-colors flex items-center justify-between"
                      [ngClass]="filterInterest() === 'Cold' ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-700 hover:bg-slate-50'"
                    >
                      <span>Cold</span>
                      @if (filterInterest() === 'Cold') {
                        <svg class="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path>
                        </svg>
                      }
                    </button>

                  </div>
                }
              </div>

              <!-- 5. Sync Status Custom Dropdown -->
              <div class="relative">
                <label class="block text-[10px] font-extrabold text-slate-700 uppercase tracking-wider mb-1">SYNC STATUS</label>
                <div 
                  (click)="openSyncDropdown()" 
                  class="w-full text-xs px-3 py-2 border rounded-xl outline-none transition-all cursor-pointer shadow-2xs flex items-center justify-between gap-1.5 bg-slate-50/60 hover:bg-white"
                  [ngClass]="showSyncDropdown() ? 'border-blue-600 ring-2 ring-blue-500/20 bg-white' : 'border-slate-200'"
                >
                  <span [ngClass]="filterSyncStatus() !== 'ALL' ? 'font-bold text-slate-900' : 'font-medium text-slate-400'" class="truncate">
                    {{ filterSyncStatus() === 'ALL' ? 'All Statuses' : filterSyncStatus() }}
                  </span>
                  <svg class="w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200" [ngClass]="{'rotate-180': showSyncDropdown()}" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                  </svg>
                </div>

                <!-- Custom Rounded Dropdown Menu -->
                @if (showSyncDropdown()) {
                  <div class="absolute right-0 sm:left-0 sm:right-auto top-full mt-1.5 z-50 w-full min-w-[140px] bg-white border border-slate-200/90 rounded-2xl p-1.5 shadow-xl backdrop-blur-md">
                    <div class="fixed inset-0 z-[-1]" (click)="showSyncDropdown.set(false)"></div>

                    <button 
                      type="button"
                      (click)="filterSyncStatus.set('ALL'); currentPage.set(1); showSyncDropdown.set(false)"
                      class="w-full text-left px-3 py-2 text-xs font-semibold rounded-xl transition-colors flex items-center justify-between"
                      [ngClass]="filterSyncStatus() === 'ALL' ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-700 hover:bg-slate-50'"
                    >
                      <span>All Statuses</span>
                      @if (filterSyncStatus() === 'ALL') {
                        <svg class="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path>
                        </svg>
                      }
                    </button>

                    <button 
                      type="button"
                      (click)="filterSyncStatus.set('Pending'); currentPage.set(1); showSyncDropdown.set(false)"
                      class="w-full text-left px-3 py-2 text-xs font-semibold rounded-xl transition-colors flex items-center justify-between"
                      [ngClass]="filterSyncStatus() === 'Pending' ? 'bg-amber-50 text-amber-700 font-bold' : 'text-slate-700 hover:bg-slate-50'"
                    >
                      <span>Pending Sync</span>
                      @if (filterSyncStatus() === 'Pending') {
                        <svg class="w-3.5 h-3.5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path>
                        </svg>
                      }
                    </button>

                    <button 
                      type="button"
                      (click)="filterSyncStatus.set('Synced'); currentPage.set(1); showSyncDropdown.set(false)"
                      class="w-full text-left px-3 py-2 text-xs font-semibold rounded-xl transition-colors flex items-center justify-between"
                      [ngClass]="filterSyncStatus() === 'Synced' ? 'bg-emerald-50 text-emerald-700 font-bold' : 'text-slate-700 hover:bg-slate-50'"
                    >
                      <span>Synced</span>
                      @if (filterSyncStatus() === 'Synced') {
                        <svg class="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path>
                        </svg>
                      }
                    </button>

                  </div>
                }
              </div>

            </div>
          </div>
        }
      </div>

      <!-- Main Data Table Container -->
      <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-6">
        
        <!-- Table Header Title Row -->
        <div class="p-4 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <h2 class="text-sm font-bold text-slate-900">
            {{ selectedStallId() === 'ALL' ? 'All Captured Leads (All Stalls)' : ('Stall Leads (Isolated to ' + (stallService.activeStall()?.code || 'STL-2026-001') + ')') }}
          </h2>
          <span class="text-xs text-slate-400 font-medium">
            Showing {{ filteredLeads().length }} total visitor leads
          </span>
        </div>

        <!-- Rich ERP Data Grid with Separated Actions Columns -->
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-[#1a3a5c] text-white text-[11px] font-bold uppercase tracking-wider">
                <th class="py-1.5 px-4 border-r border-white/20">LEAD NO.</th>
                <th class="py-1.5 px-4 border-r border-white/20 whitespace-nowrap min-w-[120px]">DATE OF CREATION</th>
                <th class="py-1.5 px-4 border-r border-white/20">VISITOR NAME</th>
                <th class="py-1.5 px-4 border-r border-white/20">STALL NAME</th>
                <th class="py-1.5 px-4 border-r border-white/20">COMPANY</th>
                <th class="py-1.5 px-3 border-r border-white/20 min-w-[170px]">MOBILE</th>
                <th class="py-1.5 px-3 border-r border-white/20">DESIGNATION</th>
                <th class="py-1.5 px-2 border-r border-white/20 text-center w-24">INTEREST LEVEL</th>
                <th class="py-1.5 px-2 border-r border-white/20 text-center w-24">SYNC STATUS</th>
                <th class="py-1.5 px-1 border-r border-white/20 text-center w-12 uppercase">View</th>
                <th class="py-1.5 px-1 border-r border-white/20 text-center w-12 uppercase">Edit</th>
                <th class="py-1.5 px-1 text-center w-12 uppercase">Delete</th>
              </tr>
            </thead>
            <tbody class="text-xs text-slate-700 font-normal">
              @for (lead of paginatedLeads(); track lead.id; let idx = $index) {
                <tr 
                  class="border-b border-slate-100 transition"
                  [ngClass]="idx % 2 === 0 ? 'bg-[#f4f8fc]' : 'bg-white'"
                >
                  <!-- Lead Number -->
                  <td class="py-1.5 px-4 text-xs font-normal text-slate-700 border-r border-slate-200/60">
                    {{ lead.leadNumber }}
                  </td>

                  <!-- Date of Creation -->
                  <td class="py-1.5 px-4 text-xs font-normal text-slate-700 border-r border-slate-200/60 whitespace-nowrap font-mono text-[11px]">
                    {{ formatCreatedDate(lead.createdAt) }}
                  </td>

                  <!-- Visitor Name -->
                  <td class="py-1.5 px-4 text-xs font-normal text-slate-700 border-r border-slate-200/60">
                    <div class="flex items-center justify-between gap-1">
                      <span>{{ lead.name }}</span>
                      @if (lead.voiceBlob || lead.voiceNotesTranscript) {
                        <span class="material-icons text-sm text-red-600 bg-red-50 p-0.5 rounded" title="Voice Note Audio Attached">mic</span>
                      }
                    </div>
                  </td>

                  <!-- Stall Name -->
                  <td class="py-1.5 px-4 text-xs font-normal text-slate-700 border-r border-slate-200/60">
                    {{ getStallName(lead.exhibitionId) }}
                  </td>

                  <!-- Company -->
                  <td class="py-1.5 px-4 text-xs font-normal text-slate-700 border-r border-slate-200/60">
                    {{ lead.company }}
                  </td>

                  <!-- Mobile (1 number per line, whitespace-nowrap, min-w 170px) -->
                  <td class="py-1.5 px-3 text-xs font-normal text-slate-700 border-r border-slate-200/60 min-w-[170px] whitespace-nowrap">
                    @for (num of getPhoneNumbersList(lead.phone); track num) {
                      <div class="whitespace-nowrap font-mono text-[11px] leading-snug">{{ num }}</div>
                    }
                  </td>

                  <!-- Designation -->
                  <td class="py-1.5 px-4 text-xs font-normal text-slate-700 border-r border-slate-200/60">
                    {{ lead.designation || '-' }}
                  </td>

                  <!-- Interest Level (Compact w-24) -->
                  <td class="py-1.5 px-2 text-xs font-normal text-center border-r border-slate-200/60 w-24">
                    <span 
                      class="px-2 py-0.5 rounded-full text-[11px] font-medium inline-block"
                      [ngClass]="{
                        'bg-red-100 text-red-700 border border-red-200': lead.interestLevel === 'Hot',
                        'bg-amber-100 text-amber-700 border border-amber-200': lead.interestLevel === 'Warm',
                        'bg-blue-100 text-blue-700 border border-blue-200': lead.interestLevel === 'Cold'
                      }"
                    >
                      {{ lead.interestLevel }}
                    </span>
                  </td>

                  <!-- Sync Status Pill (Compact w-24) -->
                  <td class="py-1.5 px-2 text-xs font-normal text-center border-r border-slate-200/60 w-24">
                    <span 
                      class="px-2 py-0.5 rounded text-[11px] font-medium inline-block"
                      [ngClass]="lead.syncStatus === 'Synced' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-orange-50 text-orange-600 border border-orange-200'"
                    >
                      {{ lead.syncStatus === 'Synced' ? 'Synced' : 'Pending' }}
                    </span>
                  </td>

                  <!-- Action Column 1: View Modal Trigger (Compact w-12) -->
                  <td class="py-1.5 px-1 text-center border-r border-slate-200/60 w-12">
                    <button (click)="openViewModal(lead)" class="text-slate-500 hover:text-blue-600 p-0.5 transition" title="View Details">
                      <span class="material-icons text-base">visibility</span>
                    </button>
                  </td>

                  <!-- Action Column 2: Edit (Compact w-12) -->
                  <td class="py-1.5 px-1 text-center border-r border-slate-200/60 w-12">
                    <button (click)="editLead(lead)" class="text-blue-600 hover:text-blue-800 p-0.5 transition" title="Edit Record">
                      <span class="material-icons text-base">edit</span>
                    </button>
                  </td>

                  <!-- Action Column 3: Delete (Compact w-12) -->
                  <td class="py-1.5 px-1 text-center w-12">
                    <button (click)="deleteLead(lead)" class="text-rose-600 hover:text-rose-800 p-0.5 transition" title="Delete Record">
                      <span class="material-icons text-base">delete</span>
                    </button>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="12" class="py-12 text-center text-slate-400">
                    No visitor lead records found.
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
            {{ startIndex() }} - {{ endIndex() }} of {{ filteredLeads().length }}
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
              [disabled]="endIndex() >= filteredLeads().length" 
              (click)="nextPage()" 
              class="p-1 rounded hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition text-slate-600" 
              title="Next Page"
            >
              <span class="material-icons text-base">chevron_right</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Premium View Visitor Lead Details Modal -->
      @if (selectedLeadForView()) {
        <div class="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-hidden">
          <div class="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg max-h-[85vh] sm:max-h-[88vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            
            <!-- Fixed Modal Header -->
            <div class="bg-[#1a3a5c] text-white px-5 py-3.5 flex items-center justify-between shrink-0 border-b border-slate-700/50">
              <div class="flex items-center gap-2.5">
                <span class="material-icons text-blue-200">contact_page</span>
                <div>
                  <h3 class="text-sm font-bold uppercase tracking-wider">VISITOR LEAD DETAILS</h3>
                  <p class="text-[11px] text-blue-200 font-mono">LEAD NO: {{ selectedLeadForView()?.leadNumber || ('ENQ-' + selectedLeadForView()?.id?.substring(0, 8)?.toUpperCase()) }}</p>
                </div>
              </div>
              <button (click)="closeViewModal()" class="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors" title="Close">
                <span class="material-icons text-base">close</span>
              </button>
            </div>

            <!-- Scrollable Modal Content Body -->
            <div class="p-5 space-y-4 flex-1 overflow-y-auto min-h-0">
              <!-- Primary Visitor Info -->
              <div class="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <div class="text-base font-extrabold text-slate-900 mb-1">
                  {{ selectedLeadForView()?.name }}
                </div>
                <div class="text-xs font-semibold text-slate-600 mb-3 flex items-center gap-1.5">
                  <span class="material-icons text-sm text-slate-400">business</span>
                  {{ selectedLeadForView()?.company }}
                </div>

                <div class="grid grid-cols-2 gap-3 text-xs border-t pt-3">
                  <div>
                    <span class="text-[10px] text-slate-400 font-bold uppercase block">MOBILE PHONE</span>
                    <span class="font-semibold text-slate-800">{{ selectedLeadForView()?.phone }}</span>
                  </div>
                  <div>
                    <span class="text-[10px] text-slate-400 font-bold uppercase block">EMAIL ADDRESS</span>
                    <span class="font-semibold text-slate-800">{{ selectedLeadForView()?.email || 'N/A' }}</span>
                  </div>
                  <div>
                    <span class="text-[10px] text-slate-400 font-bold uppercase block">DESIGNATION</span>
                    <span class="font-semibold text-slate-800">{{ selectedLeadForView()?.designation || 'Visitor' }}</span>
                  </div>
                  <div>
                    <span class="text-[10px] text-slate-400 font-bold uppercase block">WEBSITE URL</span>
                    <span class="font-semibold text-slate-800">{{ selectedLeadForView()?.website || 'N/A' }}</span>
                  </div>
                  <div>
                    <span class="text-[10px] text-slate-400 font-bold uppercase block">ADDRESS / LOCATION</span>
                    <span class="font-semibold text-slate-800">{{ selectedLeadForView()?.address || 'N/A' }}</span>
                  </div>
                </div>
              </div>

              <!-- Metadata & Priority Pills -->
              <div class="flex items-center justify-between bg-blue-50/60 rounded-xl p-4 border border-blue-100">
                <div>
                  <span class="text-[10px] text-slate-500 font-bold uppercase block mb-1">INTEREST PRIORITY</span>
                  <span 
                    class="px-3 py-1 rounded-full text-xs font-extrabold inline-block"
                    [ngClass]="{
                      'bg-red-100 text-red-700 border border-red-200': selectedLeadForView()?.interestLevel === 'Hot',
                      'bg-amber-100 text-amber-700 border border-amber-200': selectedLeadForView()?.interestLevel === 'Warm',
                      'bg-blue-100 text-blue-700 border border-blue-200': selectedLeadForView()?.interestLevel === 'Cold'
                    }"
                  >
                    {{ selectedLeadForView()?.interestLevel }}
                  </span>
                </div>

                <div class="text-right">
                  <span class="text-[10px] text-slate-500 font-bold uppercase block mb-1">CRM SYNC STATUS</span>
                  <span 
                    class="px-3 py-1 rounded text-xs font-bold inline-block"
                    [ngClass]="selectedLeadForView()?.syncStatus === 'Synced' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-orange-100 text-orange-700 border border-orange-200'"
                  >
                    {{ selectedLeadForView()?.syncStatus === 'Synced' ? 'Synced' : 'Pending Sync' }}
                  </span>
                </div>
              </div>

              <!-- Discussion Remarks & Requirements -->
              <div>
                <label class="text-xs font-bold text-slate-700 block mb-1.5 uppercase tracking-wide">
                  DISCUSSION REMARKS & REQUIREMENTS
                </label>
                <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium leading-relaxed max-h-36 overflow-y-auto">
                  {{ selectedLeadForView()?.remarks || 'No discussion remarks recorded.' }}
                </div>
              </div>

              <!-- Business Card Image Section -->
              @if (selectedLeadForView()?.photoBlob) {
                <div class="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
                  <div class="flex items-center justify-between text-xs font-bold text-[#1a3a5c] uppercase tracking-wide">
                    <span class="flex items-center gap-1.5">
                      <span class="material-icons text-sm text-blue-600">credit_card</span>
                      Scanned Business Card Image
                    </span>
                    <button 
                      type="button" 
                      (click)="downloadLeadCardImage(selectedLeadForView())" 
                      class="text-[11px] text-blue-700 hover:text-blue-900 font-bold flex items-center gap-1 bg-blue-100/80 px-2.5 py-1 rounded border border-blue-200 transition shadow-2xs"
                    >
                      <span class="material-icons text-xs">download</span>
                      Download {{ selectedLeadForView()?.leadNumber }}.jpg
                    </button>
                  </div>
                  <div class="flex justify-center bg-slate-900/90 p-2 rounded-lg border border-slate-700">
                    <img [src]="getCardImageUrl(selectedLeadForView())" alt="Business Card" class="max-h-40 max-w-full object-contain rounded" />
                  </div>
                </div>
              }

              <!-- Voice Note Audio & Transcript Section -->
              @if (selectedLeadForView()?.voiceBlob || selectedLeadForView()?.voiceNotesTranscript) {
                <div class="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
                  <div class="flex items-center justify-between text-xs font-bold text-[#1a3a5c] uppercase tracking-wide">
                    <span class="flex items-center gap-1.5">
                      <span class="material-icons text-sm text-red-600">mic</span>
                      Voice Note Audio
                    </span>
                    <span class="text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      Attached
                    </span>
                  </div>
                  @if (getVoiceAudioUrl(selectedLeadForView())) {
                    <audio [src]="getVoiceAudioUrl(selectedLeadForView())" controls class="w-full h-8 rounded focus:outline-none"></audio>
                  }
                  @if (selectedLeadForView()?.voiceNotesTranscript) {
                    <div class="text-[11px] text-slate-600 bg-white p-2 rounded border border-slate-200 italic">
                      <span class="font-semibold text-blue-700 not-italic block mb-0.5">Live Transcript:</span>
                      "{{ selectedLeadForView()?.voiceNotesTranscript }}"
                    </div>
                  }
                </div>
              }
            </div>

            <!-- Fixed Modal Footer Action Bar -->
            <div class="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
              <button (click)="closeViewModal()" class="btn btn-outline-pill text-xs">
                Close
              </button>

              <button (click)="editFromViewModal()" class="btn btn-primary text-xs px-5 py-2 rounded-lg font-bold flex items-center gap-1.5 shadow-md">
                <span class="material-icons text-sm">edit</span>
                Edit Lead Record
              </button>
            </div>
          </div>
        </div>
      }

      <!-- Custom Delete Visitor Lead Confirmation Modal -->
      @if (selectedLeadForDelete()) {
        <div class="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div class="bg-white rounded-2xl shadow-2xl border border-red-100 max-w-md w-full p-6 space-y-5 animate-in zoom-in-95 duration-150 relative">
            
            <!-- Warning Header Icon -->
            <div class="flex items-center gap-3.5">
              <div class="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0 ring-8 ring-red-50">
                <span class="material-icons text-2xl">warning_amber</span>
              </div>
              <div>
                <h3 class="text-base font-bold text-slate-900">Delete Visitor Enquiry?</h3>
                <p class="text-xs text-slate-500 font-medium">Permanent action cannot be undone</p>
              </div>
            </div>

            <!-- Lead Summary Box -->
            <div class="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1">
              <div class="text-xs font-mono text-blue-600 font-bold">
                {{ selectedLeadForDelete()?.leadNumber || ('ENQ-' + selectedLeadForDelete()?.id?.substring(0, 8)?.toUpperCase()) }}
              </div>
              <div class="text-sm font-extrabold text-slate-900">
                {{ selectedLeadForDelete()?.name }}
              </div>
              @if (selectedLeadForDelete()?.company) {
                <div class="text-xs font-semibold text-slate-600 flex items-center gap-1">
                  <span class="material-icons text-xs text-slate-400">business</span>
                  {{ selectedLeadForDelete()?.company }}
                </div>
              }
            </div>

            <!-- Caution Message -->
            <p class="text-xs text-red-700 bg-red-50/80 border border-red-100 rounded-xl p-3 font-medium flex items-center gap-2">
              <span class="material-icons text-sm text-red-500 shrink-0">info</span>
              <span>This lead record and all attached media will be permanently deleted.</span>
            </p>

            <!-- Modal Action Buttons -->
            <div class="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button 
                type="button" 
                (click)="cancelDelete()" 
                class="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button 
                type="button" 
                (click)="confirmDeleteLead()" 
                class="px-5 py-2.5 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-md flex items-center gap-1.5 transition-colors"
              >
                <span class="material-icons text-sm">delete_forever</span>
                Delete Permanently
              </button>
            </div>

          </div>
        </div>
      }
    </div>
  `
})
export class LeadListComponent implements OnInit {
  private db = inject(ApplicationDatabase);
  private router = inject(Router);
  stallService = inject(StallService);

  allLeads = signal<LocalLead[]>([]);
  selectedLeadForView = signal<LocalLead | null>(null);
  selectedStallId = signal<string>('ALL');

  searchTerm = signal<string>('');
  filterDateFrom = signal<string>('');
  filterDateTo = signal<string>('');
  filterInterest = signal<string>('ALL');
  filterSyncStatus = signal<string>('ALL');
  filterHasMedia = signal<string>('ALL');
  showFilterSection = signal<boolean>(false);

  toggleFilterSection(): void {
    this.showFilterSection.update((v) => !v);
  }

  pageSize = signal(20);
  pageSizeSelect = 20;
  currentPage = signal(1);

  hasActiveFilters = computed(() => {
    return !!(
      this.searchTerm().trim() ||
      this.filterDateFrom() ||
      this.filterDateTo() ||
      this.filterInterest() !== 'ALL' ||
      this.filterSyncStatus() !== 'ALL' ||
      this.filterHasMedia() !== 'ALL'
    );
  });

  resetAllFilters(): void {
    this.searchTerm.set('');
    this.filterDateFrom.set('');
    this.filterDateTo.set('');
    this.filterInterest.set('ALL');
    this.filterSyncStatus.set('ALL');
    this.filterHasMedia.set('ALL');
    this.currentPage.set(1);
  }

  setTodayFilter(): void {
    const todayStr = new Date().toISOString().split('T')[0];
    if (this.isTodayActive()) {
      this.filterDateFrom.set('');
      this.filterDateTo.set('');
    } else {
      this.filterDateFrom.set(todayStr);
      this.filterDateTo.set(todayStr);
    }
    this.currentPage.set(1);
  }

  isTodayActive(): boolean {
    const todayStr = new Date().toISOString().split('T')[0];
    return this.filterDateFrom() === todayStr && this.filterDateTo() === todayStr;
  }

  setHotLeadsFilter(): void {
    this.filterInterest.set(this.filterInterest() === 'Hot' ? 'ALL' : 'Hot');
    this.currentPage.set(1);
  }

  setPendingSyncFilter(): void {
    this.filterSyncStatus.set(this.filterSyncStatus() === 'Pending' ? 'ALL' : 'Pending');
    this.currentPage.set(1);
  }

  setMediaOnlyFilter(): void {
    this.filterHasMedia.set(this.filterHasMedia() === 'ANY_MEDIA' ? 'ALL' : 'ANY_MEDIA');
    this.currentPage.set(1);
  }

  // Custom Rounded Dropdown Signals & Methods
  showInterestDropdown = signal(false);
  showSyncDropdown = signal(false);
  showStallDropdown = signal(false);

  openInterestDropdown(): void {
    this.closeDatePicker();
    this.showSyncDropdown.set(false);
    this.showStallDropdown.set(false);
    this.showInterestDropdown.update((v) => !v);
  }

  openSyncDropdown(): void {
    this.closeDatePicker();
    this.showInterestDropdown.set(false);
    this.showStallDropdown.set(false);
    this.showSyncDropdown.update((v) => !v);
  }

  openStallDropdown(): void {
    this.closeDatePicker();
    this.showInterestDropdown.set(false);
    this.showSyncDropdown.set(false);
    this.showStallDropdown.update((v) => !v);
  }

  getSelectedStallName(): string {
    if (this.selectedStallId() === 'ALL') return 'All Stalls (All Leads)';
    const found = this.stallService.stalls().find((s) => s.id === this.selectedStallId());
    return found ? `${found.name} (${found.code})` : 'All Stalls (All Leads)';
  }

  // Premium Custom Date Picker Popover Signals & Methods
  showDatePicker = signal<'from' | 'to' | null>(null);
  currentPickerYear = signal<number>(new Date().getFullYear());
  currentPickerMonth = signal<number>(new Date().getMonth());

  monthShortNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  weekDayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  openDatePicker(mode: 'from' | 'to'): void {
    this.showInterestDropdown.set(false);
    this.showSyncDropdown.set(false);
    this.showStallDropdown.set(false);

    if (this.showDatePicker() === mode) {
      this.showDatePicker.set(null);
      return;
    }

    let targetDateStr = mode === 'from' ? this.filterDateFrom() : this.filterDateTo();
    if (!targetDateStr && mode === 'to' && this.filterDateFrom()) {
      targetDateStr = this.filterDateFrom();
    }

    if (targetDateStr) {
      const parts = targetDateStr.split('-');
      if (parts.length === 3) {
        this.currentPickerYear.set(parseInt(parts[0], 10));
        this.currentPickerMonth.set(parseInt(parts[1], 10) - 1);
      }
    } else {
      this.currentPickerYear.set(new Date().getFullYear());
      this.currentPickerMonth.set(new Date().getMonth());
    }

    this.showDatePicker.set(mode);
  }

  closeDatePicker(): void {
    this.showDatePicker.set(null);
  }

  prevPickerMonth(): void {
    if (this.currentPickerMonth() === 0) {
      this.currentPickerMonth.set(11);
      this.currentPickerYear.update((y) => y - 1);
    } else {
      this.currentPickerMonth.update((m) => m - 1);
    }
  }

  nextPickerMonth(): void {
    if (this.currentPickerMonth() === 11) {
      this.currentPickerMonth.set(0);
      this.currentPickerYear.update((y) => y + 1);
    } else {
      this.currentPickerMonth.update((m) => m + 1);
    }
  }

  pickerCalendarDays = computed(() => {
    const year = this.currentPickerYear();
    const month = this.currentPickerMonth();

    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevDaysInMonth = new Date(year, month, 0).getDate();

    const result: { dateStr: string; dayNum: number; isCurrentMonth: boolean }[] = [];

    // Previous month padding
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = prevDaysInMonth - i;
      const prevM = month === 0 ? 11 : month - 1;
      const prevY = month === 0 ? year - 1 : year;
      const mStr = String(prevM + 1).padStart(2, '0');
      const dStr = String(dayNum).padStart(2, '0');
      result.push({
        dateStr: `${prevY}-${mStr}-${dStr}`,
        dayNum,
        isCurrentMonth: false
      });
    }

    // Current month days
    const mStr = String(month + 1).padStart(2, '0');
    for (let d = 1; d <= daysInMonth; d++) {
      const dStr = String(d).padStart(2, '0');
      result.push({
        dateStr: `${year}-${mStr}-${dStr}`,
        dayNum: d,
        isCurrentMonth: true
      });
    }

    // Next month padding
    const totalCells = Math.ceil(result.length / 7) * 7;
    const nextCount = totalCells - result.length;
    const nextM = month === 11 ? 0 : month + 1;
    const nextY = month === 11 ? year + 1 : year;
    const nextMStr = String(nextM + 1).padStart(2, '0');
    for (let d = 1; d <= nextCount; d++) {
      const dStr = String(d).padStart(2, '0');
      result.push({
        dateStr: `${nextY}-${nextMStr}-${dStr}`,
        dayNum: d,
        isCurrentMonth: false
      });
    }

    return result;
  });

  selectPickerDate(dateStr: string): void {
    const mode = this.showDatePicker();
    if (mode === 'from') {
      this.filterDateFrom.set(dateStr);
      if (this.filterDateTo() && this.filterDateTo() < dateStr) {
        this.filterDateTo.set('');
      }
      this.currentPage.set(1);
      this.showDatePicker.set('to');
    } else if (mode === 'to') {
      if (this.filterDateFrom() && dateStr < this.filterDateFrom()) {
        this.filterDateTo.set(this.filterDateFrom());
        this.filterDateFrom.set(dateStr);
      } else {
        this.filterDateTo.set(dateStr);
      }
      this.currentPage.set(1);
      this.showDatePicker.set(null);
    }
  }

  isDateSelected(dateStr: string): boolean {
    const mode = this.showDatePicker();
    if (mode === 'from') {
      return this.filterDateFrom() === dateStr;
    } else if (mode === 'to') {
      return this.filterDateTo() === dateStr;
    }
    return this.filterDateFrom() === dateStr || this.filterDateTo() === dateStr;
  }

  isTodayDate(dateStr: string): boolean {
    const today = new Date().toISOString().split('T')[0];
    return dateStr === today;
  }

  isInRangeDate(dateStr: string): boolean {
    const from = this.filterDateFrom();
    const to = this.filterDateTo();
    if (!from || !to) return false;
    return dateStr >= from && dateStr <= to;
  }

  formatDateDisplay(dateStr: string): string {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const y = parts[0];
    const mIdx = parseInt(parts[1], 10) - 1;
    const d = parts[2];
    const mName = this.monthShortNames[mIdx] || parts[1];
    return `${d}/${mName}/${y}`;
  }

  setThisMonthFilter(): void {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    this.filterDateFrom.set(this.formatYYYYMMDD(firstDay));
    this.filterDateTo.set(this.formatYYYYMMDD(now));
    this.currentPage.set(1);
  }

  formatYYYYMMDD(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  async ngOnInit(): Promise<void> {
    await this.loadLeads();
  }

  async loadLeads(): Promise<void> {
    const list = await this.db.getAllLeads();
    let updated = false;
    for (let i = 0; i < list.length; i++) {
      if (!list[i].leadNumber) {
        list[i].leadNumber = `S1L${(list.length - i).toString().padStart(5, '0')}`;
        await this.db.saveLead(list[i]);
        updated = true;
      }
    }
    this.allLeads.set(list);
  }

  getPhoneNumbersList(phoneStr: string | undefined | null): string[] {
    if (!phoneStr || !phoneStr.trim()) return ['-'];
    return phoneStr.split(/[,/]+/).map(p => p.trim()).filter(p => p.length > 0);
  }

  formatCreatedDate(dateStr: string | undefined | null): string {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '-';
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return '-';
    }
  }

  onStallFilterChange(stallId: string): void {
    this.selectedStallId.set(stallId);
    if (stallId !== 'ALL') {
      const found = this.stallService.stalls().find((s) => s.id === stallId);
      if (found) {
        this.stallService.setActiveStall(found);
      }
    }
    this.currentPage.set(1);
  }

  getStallName(exhibitionId?: string): string {
    if (!exhibitionId) return 'Stall 01 - Main Exhibition';
    const stall = this.stallService.stalls().find((s) => s.id === exhibitionId);
    return stall ? stall.name : 'Stall 01 - Main Exhibition';
  }

  dateAndStallFilteredLeads = computed(() => {
    let list = this.allLeads();

    // 1. Stall Filter
    const stallId = this.selectedStallId();
    if (stallId && stallId !== 'ALL') {
      list = list.filter((l) => l.exhibitionId === stallId || (!l.exhibitionId && stallId === '33333333-3333-3333-3333-333333333333'));
    }

    // 2. Text Search (Name, Lead No, Company, Phone, Designation, Address, Email, Remarks)
    const q = this.searchTerm().trim().toLowerCase();
    if (q) {
      list = list.filter((l) =>
        (l.name && l.name.toLowerCase().includes(q)) ||
        (l.leadNumber && l.leadNumber.toLowerCase().includes(q)) ||
        (l.company && l.company.toLowerCase().includes(q)) ||
        (l.phone && l.phone.toLowerCase().includes(q)) ||
        (l.designation && l.designation.toLowerCase().includes(q)) ||
        (l.email && l.email.toLowerCase().includes(q)) ||
        (l.address && l.address.toLowerCase().includes(q)) ||
        (l.remarks && l.remarks.toLowerCase().includes(q))
      );
    }

    // 3. Date From Filter
    const fromStr = this.filterDateFrom();
    if (fromStr) {
      const fromTime = new Date(fromStr + 'T00:00:00').getTime();
      list = list.filter((l) => {
        if (!l.createdAt) return false;
        return new Date(l.createdAt).getTime() >= fromTime;
      });
    }

    // 4. Date To Filter
    const toStr = this.filterDateTo();
    if (toStr) {
      const toTime = new Date(toStr + 'T23:59:59').getTime();
      list = list.filter((l) => {
        if (!l.createdAt) return false;
        return new Date(l.createdAt).getTime() <= toTime;
      });
    }

    // 5. Sync Status Filter
    const sync = this.filterSyncStatus();
    if (sync && sync !== 'ALL') {
      list = list.filter((l) => l.syncStatus === sync);
    }

    // 6. Media Filter
    const media = this.filterHasMedia();
    if (media === 'CARD_ONLY') {
      list = list.filter((l) => !!l.photoBlob);
    } else if (media === 'VOICE_ONLY') {
      list = list.filter((l) => !!l.voiceBlob || !!l.voiceNotesTranscript);
    } else if (media === 'ANY_MEDIA') {
      list = list.filter((l) => !!l.photoBlob || !!l.voiceBlob || !!l.voiceNotesTranscript);
    }

    return list;
  });

  hotLeadsCount = computed(() => this.dateAndStallFilteredLeads().filter((l) => l.interestLevel === 'Hot').length);
  warmLeadsCount = computed(() => this.dateAndStallFilteredLeads().filter((l) => l.interestLevel === 'Warm').length);
  coldLeadsCount = computed(() => this.dateAndStallFilteredLeads().filter((l) => l.interestLevel === 'Cold').length);

  filteredLeads = computed(() => {
    let list = this.dateAndStallFilteredLeads();

    // Interest Level Filter
    const interest = this.filterInterest();
    if (interest && interest !== 'ALL') {
      list = list.filter((l) => l.interestLevel === interest);
    }

    return list;
  });

  paginatedLeads = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize();
    return this.filteredLeads().slice(start, start + this.pageSize());
  });

  startIndex = computed(() => {
    if (this.filteredLeads().length === 0) return 0;
    return (this.currentPage() - 1) * this.pageSize() + 1;
  });

  endIndex = computed(() => Math.min(this.currentPage() * this.pageSize(), this.filteredLeads().length));

  onPageSizeChange(): void {
    this.pageSize.set(Number(this.pageSizeSelect));
    this.currentPage.set(1);
  }

  prevPage(): void {
    if (this.currentPage() > 1) this.currentPage.update((p) => p - 1);
  }

  nextPage(): void {
    if (this.endIndex() < this.filteredLeads().length) this.currentPage.update((p) => p + 1);
  }

  goToFirstPage(): void {
    this.currentPage.set(1);
  }

  goToLastPage(): void {
    const totalPages = Math.ceil(this.filteredLeads().length / this.pageSize());
    this.currentPage.set(Math.max(1, totalPages));
  }

  openViewModal(lead: LocalLead): void {
    this.selectedLeadForView.set(lead);
  }

  closeViewModal(): void {
    this.selectedLeadForView.set(null);
  }

  editFromViewModal(): void {
    const lead = this.selectedLeadForView();
    if (lead) {
      this.closeViewModal();
      this.editLead(lead);
    }
  }

  editLead(lead: LocalLead): void {
    this.router.navigate(['/capture', lead.id]);
  }

  getVoiceAudioUrl(lead: LocalLead | null): string | null {
    if (!lead || !lead.voiceBlob) return null;
    if (lead.voiceBlob instanceof Blob) {
      return URL.createObjectURL(lead.voiceBlob);
    }
    if (typeof lead.voiceBlob === 'string') {
      return lead.voiceBlob;
    }
    return null;
  }

  getCardImageUrl(lead: LocalLead | null): string | null {
    if (!lead || !lead.photoBlob) return null;
    if (typeof lead.photoBlob === 'string') return lead.photoBlob;
    if (lead.photoBlob instanceof Blob) return URL.createObjectURL(lead.photoBlob);
    return null;
  }

  downloadLeadCardImage(lead: LocalLead | null): void {
    if (!lead) return;
    const url = this.getCardImageUrl(lead);
    if (!url) return;
    const fileName = `${lead.leadNumber || 'S1L00001'}.jpg`;
    try {
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      console.warn('[LeadList] Image download failed:', e);
    }
  }

  selectedLeadForDelete = signal<LocalLead | null>(null);

  deleteLead(lead: LocalLead): void {
    this.selectedLeadForDelete.set(lead);
  }

  cancelDelete(): void {
    this.selectedLeadForDelete.set(null);
  }

  async confirmDeleteLead(): Promise<void> {
    const lead = this.selectedLeadForDelete();
    if (lead) {
      await this.db.deleteLead(lead.id);
      this.selectedLeadForDelete.set(null);
      await this.loadLeads();
    }
  }
}
