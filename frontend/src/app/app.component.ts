import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { NetworkService } from './core/services/network.service';
import { SyncService } from './core/services/sync.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="app-container">
      <!-- Exact AriyAI Sidebar -->
      <aside class="sidebar">
        <!-- Logo Box -->
        <div class="sidebar-logo">
          <div class="logo-box">
            <span class="logo-text">AriyAI</span>
          </div>
        </div>

        <!-- Sidebar Navigation Menu with Chevron Arrows -->
        <nav class="sidebar-nav">
          <a routerLink="/dashboard" routerLinkActive="active" class="nav-item-link">
            <span class="material-icons nav-chevron">chevron_right</span>
            <span class="material-icons nav-icon">dashboard</span>
            <span class="nav-text">Dashboard Overview</span>
          </a>

          <a routerLink="/capture" routerLinkActive="active" class="nav-item-link">
            <span class="material-icons nav-chevron">chevron_right</span>
            <span class="material-icons nav-icon">person_add</span>
            <span class="nav-text">Lead Capture</span>
          </a>

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

          <!-- Center: Pill Search Input -->
          <div class="header-center">
            <div class="search-wrapper">
              <span class="material-icons search-icon">search</span>
              <input type="text" class="search-input" placeholder="Search menus..." />
            </div>
          </div>

          <!-- Right: Notifications & User Profile -->
          <div class="header-right">
            <!-- Notifications Icon -->
            <button class="header-icon-btn" title="Notifications">
              <span class="material-icons">notifications_none</span>
            </button>

            <!-- User Profile Dropdown -->
            <div class="user-profile">
              <div class="user-avatar">T</div>
              <div class="user-info">
                <span class="user-name">Thalaimalai</span>
                <span class="user-role">Naren-Marketing</span>
              </div>
              <span class="material-icons text-gray-500 text-sm">keyboard_arrow_down</span>
            </div>
          </div>
        </header>

        <!-- Main Body Page Outlet -->
        <main class="content-body">
          <router-outlet></router-outlet>
        </main>
      </div>
    </div>
  `
})
export class AppComponent {
  network = inject(NetworkService);
  private sync = inject(SyncService);

  triggerSync(): void {
    this.sync.syncPendingLeads();
  }
}
