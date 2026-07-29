import { Component, inject, signal, HostListener } from '@angular/core';
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

        <!-- Exact AriyAI Sidebar -->
        <aside class="sidebar">
          <!-- Logo Box (Clickable -> Dashboard) -->
          <div class="sidebar-logo">
            <a routerLink="/dashboard" class="logo-box cursor-pointer hover:opacity-90 transition block">
              <img src="ariyai-logo.png" alt="AriyAI" style="height: 28px; width: auto;" />
            </a>
          </div>

          <!-- Sidebar Navigation Menu -->
          <nav class="sidebar-nav">
            <!-- 1. Dashboard -->
            <a routerLink="/dashboard" routerLinkActive="active" class="nav-item-link">
              <span class="material-icons nav-chevron">chevron_right</span>
              <span class="material-icons nav-icon">dashboard</span>
              <span class="nav-text">Dashboard</span>
            </a>

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
                  <a routerLink="/admin/notification-config" routerLinkActive="active" class="nav-item-link py-2 text-xs">
                    <span class="material-icons nav-icon text-sm">notifications</span>
                    <span class="nav-text">Notification Config</span>
                  </a>
                  <a routerLink="/admin/smtp-config" routerLinkActive="active" class="nav-item-link py-2 text-xs">
                    <span class="material-icons nav-icon text-sm">mail</span>
                    <span class="nav-text">SMTP Config</span>
                  </a>
                  <a routerLink="/admin/notification-logs" routerLinkActive="active" class="nav-item-link py-2 text-xs">
                    <span class="material-icons nav-icon text-sm">history</span>
                    <span class="nav-text">Notification Logs</span>
                  </a>
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
                  <a routerLink="/ums/user" routerLinkActive="active" class="nav-item-link py-2 text-xs">
                    <span class="material-icons nav-icon text-sm">group</span>
                    <span class="nav-text">User Master</span>
                  </a>
                  <a routerLink="/stalls" routerLinkActive="active" class="nav-item-link py-2 text-xs">
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
                  <a routerLink="/leads" routerLinkActive="active" class="nav-item-link py-2 text-xs">
                    <span class="material-icons nav-icon text-sm">list_alt</span>
                    <span class="nav-text">Lead</span>
                  </a>
                  <a routerLink="/capture" routerLinkActive="active" class="nav-item-link py-2 text-xs">
                    <span class="material-icons nav-icon text-sm">add_circle_outline</span>
                    <span class="nav-text">New Lead</span>
                  </a>
                </div>
              }
            </div>

            <!-- 5. vCard Exchange -->
            <a routerLink="/exchange" routerLinkActive="active" class="nav-item-link">
              <span class="material-icons nav-chevron">chevron_right</span>
              <span class="material-icons nav-icon">qr_code_2</span>
              <span class="nav-text">vCard Exchange</span>
            </a>
          </nav>
        </aside>

        <!-- Main App Content Area -->
        <div class="main-content">
          <!-- Top Navigation Header Bar -->
          <header class="top-header">
            <!-- Left: Hamburger Toggle -->
            <div class="header-left">
              <button class="menu-toggle-btn" title="Toggle Menu">
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
                  {{ (auth.currentUser()?.fullName || 'S')[0] }}
                </div>
                <div class="user-info">
                  <span class="user-name">{{ auth.currentUser()?.fullName || 'Saravanan' }}</span>
                  <span class="user-role">{{ auth.currentUser()?.userGroup || 'Naren-Marketing' }}</span>
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
                      {{ auth.currentUser()?.fullName || 'Saravanan' }}
                    </div>
                    <div class="text-xs text-slate-400 font-medium mt-0.5">
                      {{ auth.currentUser()?.userGroup || 'Naren-Marketing' }}
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

          <!-- Main Body Page Outlet -->
          <main class="content-body">
            <router-outlet></router-outlet>
          </main>
        </div>
      </div>
    } @else {
      <!-- Login View when unauthenticated -->
      <router-outlet></router-outlet>
    }
  `
})
export class AppComponent {
  network = inject(NetworkService);
  auth = inject(AuthService);
  toastService = inject(ToastService);
  private sync = inject(SyncService);
  private router = inject(Router);

  isLeadExpanded = signal(false);
  isMasterExpanded = signal(false);
  isAdminExpanded = signal(false);
  isProfileMenuOpen = signal(false);

  toggleLeadMenu(): void {
    this.isLeadExpanded.update((val) => !val);
  }

  toggleMasterMenu(): void {
    this.isMasterExpanded.update((val) => !val);
  }

  toggleAdminMenu(): void {
    this.isAdminExpanded.update((val) => !val);
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
