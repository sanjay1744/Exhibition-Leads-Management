import { Component, inject, signal, HostListener, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { NetworkService } from './core/services/network.service';
import { SyncService } from './core/services/sync.service';
import { AuthService } from './core/services/auth.service';
import { ToastService } from './core/services/toast.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    @if (auth.isAuthenticated()) {
      <div class="app-container relative">
        <!-- Floating Enterprise Toast Container -->
        <div class="fixed top-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm pointer-events-none">
          @for (toast of toastService.toasts(); track toast.id) {
            <div 
              class="pointer-events-auto bg-white border border-slate-200 rounded-xl shadow-xl p-3.5 flex items-start gap-3 animate-in fade-in slide-in-from-top-3 duration-200"
              [ngClass]="{
                'border-l-4 border-l-emerald-500': toast.type === 'success',
                'border-l-4 border-l-red-500': toast.type === 'error',
                'border-l-4 border-l-blue-500': toast.type === 'info'
              }"
            >
              <span 
                class="material-icons text-lg mt-0.5"
                [ngClass]="{
                  'text-emerald-600': toast.type === 'success',
                  'text-red-600': toast.type === 'error',
                  'text-blue-600': toast.type === 'info'
                }"
              >
                {{ toast.type === 'success' ? 'check_circle' : toast.type === 'error' ? 'error' : 'info' }}
              </span>

              <div class="flex-1">
                <div class="font-bold text-xs text-slate-900 leading-tight">{{ toast.title }}</div>
                <div class="text-xs text-slate-600 font-medium mt-0.5">{{ toast.message }}</div>
              </div>

              <button (click)="toastService.removeToast(toast.id)" class="text-slate-400 hover:text-slate-600 p-0.5">
                <span class="material-icons text-sm">close</span>
              </button>
            </div>
          }
        </div>

        <!-- Mobile Dimmed Backdrop Overlay -->
        <div 
          class="sidebar-backdrop" 
          [class.active]="!isSidebarCollapsed()" 
          (click)="toggleSidebar()"
        ></div>

        <!-- Exact AriyAI Sidebar -->
        <aside class="sidebar" [class.collapsed]="isSidebarCollapsed()">
          <!-- Fixed Sidebar Header / Logo Box (Does not scroll, separation line beneath) -->
          <div class="sidebar-logo shrink-0">
            <a routerLink="/dashboard" (click)="closeSidebarOnMobile()" class="logo-box cursor-pointer hover:opacity-90 transition block">
              <img src="ariyai-logo.png" alt="AriyAI" style="height: 28px; width: auto;" />
            </a>
          </div>

          <!-- Scrollable Menu Section with Confined Scrollbar -->
          <div class="sidebar-body-wrapper">
            <div 
              #sidebarScrollContainer
              class="sidebar-scrollable" 
              (scroll)="onSidebarScroll()"
            >
              <!-- Sidebar Navigation Menu -->
              <nav class="sidebar-nav">
            <!-- 1. Dashboard -->
            <a routerLink="/dashboard" (click)="closeSidebarOnMobile()" routerLinkActive="active" class="nav-item-link">
              <span class="material-icons nav-chevron">chevron_right</span>
              <span class="material-icons nav-icon">dashboard</span>
              <span class="nav-text">Dashboard</span>
            </a>

            <!-- 1.5 OCR Debugger (Hidden from UI as requested) -->
            <!-- 
            <a routerLink="/ocr-debugger" (click)="closeSidebarOnMobile()" routerLinkActive="active" class="nav-item-link font-bold text-amber-300">
              <span class="material-icons nav-chevron">chevron_right</span>
              <span class="material-icons nav-icon text-amber-400">bug_report</span>
              <span class="nav-text">OCR Debugger</span>
            </a>
            -->

            <!-- 2. Expandable Admin Folder -->
            <div>
              <div (click)="toggleAdminMenu()" class="nav-item-link cursor-pointer hover:bg-white/10 flex items-center justify-between">
                <div class="flex items-center">
                  <span class="material-icons nav-chevron">
                    {{ isAdminExpanded() ? 'expand_more' : 'chevron_right' }}
                  </span>
                  <span class="material-icons nav-icon">admin_panel_settings</span>
                  <span class="nav-text font-semibold">Admin</span>
                </div>
              </div>

              @if (isAdminExpanded()) {
                <div class="pl-6 bg-black/10">
                  <a routerLink="/admin/notification-config" (click)="closeSidebarOnMobile()" routerLinkActive="active" class="nav-item-link py-2 text-xs">
                    <span class="material-icons nav-icon text-sm">notifications</span>
                    <span class="nav-text">Notification Config</span>
                  </a>
                  <a routerLink="/admin/smtp-config" (click)="closeSidebarOnMobile()" routerLinkActive="active" class="nav-item-link py-2 text-xs">
                    <span class="material-icons nav-icon text-sm">mail</span>
                    <span class="nav-text">SMTP Config</span>
                  </a>
                  <a routerLink="/admin/notification-logs" (click)="closeSidebarOnMobile()" routerLinkActive="active" class="nav-item-link py-2 text-xs">
                    <span class="material-icons nav-icon text-sm">history</span>
                    <span class="nav-text">Notification Logs</span>
                  </a>
                  <!--
                  <a routerLink="/ocr-debugger" (click)="closeSidebarOnMobile()" routerLinkActive="active" class="nav-item-link py-2 text-xs">
                    <span class="material-icons nav-icon text-sm text-blue-400">bug_report</span>
                    <span class="nav-text font-bold text-blue-300">OCR Debugger</span>
                  </a>
                  -->
                </div>
              }
            </div>

            <!-- 3. Expandable Master Folder (User Master first, then Stalls) -->
            <div>
              <div (click)="toggleMasterMenu()" class="nav-item-link cursor-pointer hover:bg-white/10 flex items-center justify-between">
                <div class="flex items-center">
                  <span class="material-icons nav-chevron">
                    {{ isMasterExpanded() ? 'expand_more' : 'chevron_right' }}
                  </span>
                  <span class="material-icons nav-icon">dataset</span>
                  <span class="nav-text font-semibold">Master</span>
                </div>
              </div>

              @if (isMasterExpanded()) {
                <div class="pl-6 bg-black/10">
                  <a routerLink="/exhibitions" (click)="closeSidebarOnMobile()" routerLinkActive="active" class="nav-item-link py-2 text-xs">
                    <span class="material-icons nav-icon text-sm">event_available</span>
                    <span class="nav-text">Exhibition Master</span>
                  </a>
                  <a routerLink="/ums/user" (click)="closeSidebarOnMobile()" routerLinkActive="active" class="nav-item-link py-2 text-xs">
                    <span class="material-icons nav-icon text-sm">group</span>
                    <span class="nav-text">User Master</span>
                  </a>
                  <a routerLink="/stalls" (click)="closeSidebarOnMobile()" routerLinkActive="active" class="nav-item-link py-2 text-xs">
                    <span class="material-icons nav-icon text-sm">storefront</span>
                    <span class="nav-text">Stalls</span>
                  </a>
                </div>
              }
            </div>

            <!-- 4. Expandable Lead Folder -->
            <div>
              <div (click)="toggleLeadMenu()" class="nav-item-link cursor-pointer hover:bg-white/10 flex items-center justify-between">
                <div class="flex items-center">
                  <span class="material-icons nav-chevron">
                    {{ isLeadExpanded() ? 'expand_more' : 'chevron_right' }}
                  </span>
                  <span class="material-icons nav-icon">person_add</span>
                  <span class="nav-text font-semibold">Lead</span>
                </div>
              </div>

              @if (isLeadExpanded()) {
                <div class="pl-6 bg-black/10">
                  <a routerLink="/leads" (click)="closeSidebarOnMobile()" routerLinkActive="active" class="nav-item-link py-2 text-xs">
                    <span class="material-icons nav-icon text-sm">list_alt</span>
                    <span class="nav-text">Lead</span>
                  </a>
                  <a routerLink="/capture" (click)="closeSidebarOnMobile()" routerLinkActive="active" class="nav-item-link py-2 text-xs">
                    <span class="material-icons nav-icon text-sm">add_circle_outline</span>
                    <span class="nav-text">New Lead</span>
                  </a>
                </div>
              }
            </div>

            <!-- 5. vCard Exchange -->
            <a routerLink="/exchange" (click)="closeSidebarOnMobile()" routerLinkActive="active" class="nav-item-link">
              <span class="material-icons nav-chevron">chevron_right</span>
              <span class="material-icons nav-icon">qr_code_2</span>
              <span class="nav-text">vCard Exchange</span>
            </a>
          </nav>
        </div>

          <!-- AriyAI Auto-Hiding Scrollbar Indicator with Top & Bottom Stepper Arrows -->
          @if (hasSidebarScroll()) {
            <div 
              class="sidebar-scrollbar-track" 
              [class.visible]="isSidebarScrolling()"
            >
              <!-- Top Stepper Arrow -->
              <button 
                type="button" 
                class="sidebar-scroll-btn top" 
                (click)="scrollSidebarStep('up', $event)"
                title="Scroll Up"
              >
                <svg viewBox="0 0 8 5" class="sidebar-arrow-svg">
                  <polygon points="4,0 0,5 8,5" />
                </svg>
              </button>

              <!-- Track Rail where thumb slides -->
              <div class="sidebar-thumb-rail">
                <div 
                  class="sidebar-scrollbar-thumb"
                  [style.height.px]="sidebarThumbHeight()"
                  [style.transform]="'translateY(' + sidebarThumbTop() + 'px)'"
                  (mousedown)="onThumbMouseDown($event)"
                ></div>
              </div>

              <!-- Bottom Stepper Arrow -->
              <button 
                type="button" 
                class="sidebar-scroll-btn bottom" 
                (click)="scrollSidebarStep('down', $event)"
                title="Scroll Down"
              >
                <svg viewBox="0 0 8 5" class="sidebar-arrow-svg">
                  <polygon points="4,5 0,0 8,0" />
                </svg>
              </button>
            </div>
          }
        </div>
      </aside>

        <!-- Main App Content Area -->
        <div class="main-content">
          <!-- Top Navigation Header Bar -->
          <header class="top-header">
            <!-- Left: Hamburger Toggle -->
            <div class="header-left">
              <button class="menu-toggle-btn" (click)="toggleSidebar()" title="Toggle Menu">
                <span class="material-icons">menu</span>
              </button>
            </div>

            <!-- Center: Search Input -->
            <div class="header-center">
              <div class="search-wrapper">
                <span class="material-icons search-icon">search</span>
                <input type="text" class="search-input" placeholder="Search menus..." />
              </div>
            </div>

            <!-- Right: Notifications & User Profile Menu Dropdown -->
            <div class="header-right relative">
              <!-- Notifications Icon -->
              <button class="header-icon-btn mr-2" title="Notifications">
                <span class="material-icons">notifications_none</span>
              </button>

              <!-- Profile Dropdown Trigger -->
              <div 
                (click)="toggleProfileMenu($event)" 
                class="user-profile hover:bg-slate-100 p-1.5 rounded-lg transition cursor-pointer select-none"
              >
                <div class="user-avatar">
                  {{ (auth.currentUser()?.fullName || auth.currentUser()?.username || 'U')[0].toUpperCase() }}
                </div>
                <div class="user-info">
                  <span class="user-name">{{ auth.currentUser()?.fullName || auth.currentUser()?.username || 'User' }}</span>
                  <span class="user-role">{{ auth.currentUser()?.userGroup || auth.currentUser()?.role || 'Sales Team' }}</span>
                </div>
                <span class="material-icons text-slate-500 text-base">keyboard_arrow_down</span>
              </div>

              <!-- Interactive Profile Dropdown Popover -->
              @if (isProfileMenuOpen()) {
                <div 
                  (click)="$event.stopPropagation()"
                  class="absolute right-0 top-12 w-56 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
                >
                  <!-- Header Info -->
                  <div class="px-4 py-2 border-b border-slate-100">
                    <div class="font-bold text-slate-900 text-sm leading-tight">
                      {{ auth.currentUser()?.fullName || auth.currentUser()?.username || 'User' }}
                    </div>
                    <div class="text-xs text-slate-400 font-medium mt-0.5">
                      {{ auth.currentUser()?.userGroup || auth.currentUser()?.role || 'Sales Team' }}
                    </div>
                  </div>

                  <!-- Menu Links -->
                  <div class="py-1">
                    <a 
                      routerLink="/stalls" 
                      (click)="closeProfileMenu()" 
                      class="flex items-center gap-3 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                    >
                      <span class="material-icons text-slate-500 text-base">storefront</span>
                      Stalls
                    </a>

                    <a 
                      routerLink="/profile" 
                      (click)="closeProfileMenu()" 
                      class="flex items-center gap-3 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                    >
                      <span class="material-icons text-slate-500 text-base">person_outline</span>
                      My Profile
                    </a>

                    <a 
                      routerLink="/admin/smtp-config" 
                      (click)="closeProfileMenu()" 
                      class="flex items-center gap-3 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                    >
                      <span class="material-icons text-slate-500 text-base">settings</span>
                      SMTP Settings
                    </a>
                  </div>

                  <div class="border-t border-slate-100 my-1"></div>

                  <!-- Logout Action -->
                  <button 
                    (click)="auth.logout(); closeProfileMenu()" 
                    class="w-full flex items-center gap-3 px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-50 transition text-left"
                  >
                    <span class="material-icons text-red-600 text-base">logout</span>
                    Logout
                  </button>
                </div>
              }
            </div>
          </header>

          <!-- Dynamic Routed Feature Views Container -->
          <main class="content-body">
            <router-outlet></router-outlet>
          </main>
        </div>
      </div>
    } @else {
      <!-- Unauthenticated View (Login Form) -->
      <router-outlet></router-outlet>
    }
  `
})
export class AppComponent implements AfterViewInit {
  network = inject(NetworkService);
  auth = inject(AuthService);
  toastService = inject(ToastService);
  private sync = inject(SyncService);
  private router = inject(Router);

  @ViewChild('sidebarScrollContainer') sidebarScrollContainer?: ElementRef<HTMLDivElement>;

  isSidebarCollapsed = signal(false);
  isLeadExpanded = signal(false);
  isMasterExpanded = signal(false);
  isAdminExpanded = signal(false);
  isProfileMenuOpen = signal(false);

  // Custom Auto-Hiding Scrollbar state
  hasSidebarScroll = signal(false);
  isSidebarScrolling = signal(false);
  sidebarThumbHeight = signal(40);
  sidebarThumbTop = signal(0);
  private sidebarScrollTimeout: any = null;
  private isDraggingThumb = false;
  private dragStartY = 0;
  private dragStartScrollTop = 0;

  constructor() {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      this.isSidebarCollapsed.set(true);
    }
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.updateSidebarMetrics(), 150);
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    if (window.innerWidth < 768) {
      this.isSidebarCollapsed.set(true);
    }
    setTimeout(() => this.updateSidebarMetrics(), 100);
  }

  toggleSidebar(): void {
    this.isSidebarCollapsed.update((val) => !val);
    setTimeout(() => this.updateSidebarMetrics(), 150);
  }

  closeSidebarOnMobile(): void {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      this.isSidebarCollapsed.set(true);
    }
  }

  toggleLeadMenu(): void {
    this.isLeadExpanded.update((val) => !val);
    setTimeout(() => this.updateSidebarMetrics(), 100);
  }

  toggleMasterMenu(): void {
    this.isMasterExpanded.update((val) => !val);
    setTimeout(() => this.updateSidebarMetrics(), 100);
  }

  toggleAdminMenu(): void {
    this.isAdminExpanded.update((val) => !val);
    setTimeout(() => this.updateSidebarMetrics(), 100);
  }

  onSidebarScroll(): void {
    this.updateSidebarMetrics();
    this.isSidebarScrolling.set(true);

    if (this.sidebarScrollTimeout) {
      clearTimeout(this.sidebarScrollTimeout);
    }

    // Wait for 1 sec, then slowly disappear
    this.sidebarScrollTimeout = setTimeout(() => {
      if (!this.isDraggingThumb) {
        this.isSidebarScrolling.set(false);
      }
    }, 1000);
  }

  scrollSidebarStep(direction: 'up' | 'down', event?: MouseEvent): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    const el = this.sidebarScrollContainer?.nativeElement;
    if (!el) return;
    const delta = direction === 'up' ? -80 : 80;
    el.scrollBy({ top: delta, behavior: 'smooth' });
    this.isSidebarScrolling.set(true);

    if (this.sidebarScrollTimeout) {
      clearTimeout(this.sidebarScrollTimeout);
    }
    this.sidebarScrollTimeout = setTimeout(() => {
      if (!this.isDraggingThumb) {
        this.isSidebarScrolling.set(false);
      }
    }, 1000);
  }

  updateSidebarMetrics(): void {
    const el = this.sidebarScrollContainer?.nativeElement;
    if (!el) return;

    const clientH = el.clientHeight;
    const scrollH = el.scrollHeight;
    const scrollT = el.scrollTop;

    const canScroll = scrollH > clientH;
    this.hasSidebarScroll.set(canScroll);

    if (canScroll) {
      const railH = Math.max(40, clientH - 24);
      const ratio = clientH / scrollH;
      const thumbH = Math.max(24, Math.round(ratio * railH));
      const maxScroll = scrollH - clientH;
      const maxThumb = railH - thumbH;
      const thumbT = maxScroll > 0 ? (scrollT / maxScroll) * maxThumb : 0;

      this.sidebarThumbHeight.set(thumbH);
      this.sidebarThumbTop.set(thumbT);
    }
  }

  onThumbMouseDown(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingThumb = true;
    this.dragStartY = event.clientY;
    const el = this.sidebarScrollContainer?.nativeElement;
    this.dragStartScrollTop = el ? el.scrollTop : 0;
    this.isSidebarScrolling.set(true);
    if (this.sidebarScrollTimeout) {
      clearTimeout(this.sidebarScrollTimeout);
    }

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!this.isDraggingThumb || !this.sidebarScrollContainer) return;
      const containerEl = this.sidebarScrollContainer.nativeElement;
      const clientH = containerEl.clientHeight;
      const scrollH = containerEl.scrollHeight;
      const railH = Math.max(40, clientH - 24);
      const thumbH = this.sidebarThumbHeight();
      const maxThumb = railH - thumbH;
      const maxScroll = scrollH - clientH;

      const deltaY = moveEvent.clientY - this.dragStartY;
      if (maxThumb > 0) {
        containerEl.scrollTop = this.dragStartScrollTop + (deltaY / maxThumb) * maxScroll;
      }
    };

    const onMouseUp = () => {
      this.isDraggingThumb = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      this.sidebarScrollTimeout = setTimeout(() => {
        this.isSidebarScrolling.set(false);
      }, 1000);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  toggleProfileMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.isProfileMenuOpen.update((val) => !val);
  }

  closeProfileMenu(): void {
    this.isProfileMenuOpen.set(false);
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.closeProfileMenu();
  }

  triggerSync(): void {
    this.sync.syncPendingLeads();
  }
}
