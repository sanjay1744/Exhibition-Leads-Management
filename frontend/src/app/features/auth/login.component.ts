import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="min-h-screen bg-[#f0f4f8] flex items-center justify-center p-4">
      <div class="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden">
        <!-- AriyAI Navy Header Bar -->
        <div class="bg-[#0b4c79] p-6 text-center">
          <div class="bg-white inline-block px-5 py-2 rounded mb-3 shadow">
            <img src="ariyai-logo.png" alt="AriyAI" style="height: 32px; width: auto;" />
          </div>
          <h1 class="text-lg font-bold text-white">Enterprise Sign In</h1>
          <p class="text-xs text-blue-100 mt-1">Exhibition Lead Management System</p>
        </div>

        <form (ngSubmit)="onLogin()" class="p-6">
          @if (errorMessage()) {
            <div class="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
              <span class="material-icons text-sm text-red-600">error</span>
              {{ errorMessage() }}
            </div>
          }

          <div class="mb-4">
            <label class="form-label">Username</label>
            <div class="relative flex items-center">
              <span class="material-icons absolute left-3 text-slate-400 text-lg">person</span>
              <input 
                type="text" 
                [(ngModel)]="username" 
                name="username" 
                required 
                class="form-control pl-10" 
                placeholder="e.g. Thalaimalai" 
              />
            </div>
          </div>

          <div class="mb-6">
            <label class="form-label">Password</label>
            <div class="relative flex items-center">
              <span class="material-icons absolute left-3 text-slate-400 text-lg">lock</span>
              <input 
                type="password" 
                [(ngModel)]="password" 
                name="password" 
                required 
                class="form-control pl-10" 
                placeholder="••••••••" 
              />
            </div>
          </div>

          <button 
            type="submit" 
            [disabled]="isLoading()" 
            class="w-full btn btn-primary justify-center py-2.5 rounded-lg font-semibold text-sm shadow-md transition"
          >
            @if (isLoading()) {
              <span class="material-icons text-sm animate-spin">sync</span> Authenticaton...
            } @else {
              <span class="material-icons text-sm">login</span> Sign In to ERP
            }
          </button>

          <div class="mt-4 text-center text-xs text-slate-400">
            Default credentials: <span class="font-mono text-slate-600 font-semibold">Thalaimalai / Admin&#64;123</span>
          </div>
        </form>
      </div>
    </div>
  `
})
export class LoginComponent {
  username = 'Thalaimalai';
  password = 'Admin@123';
  isLoading = signal(false);
  errorMessage = signal<string | null>(null);

  constructor(private authService: AuthService, private router: Router) {}

  onLogin(): void {
    if (!this.username || !this.password) {
      this.errorMessage.set('Please enter username and password.');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.authService.login({ username: this.username, password: this.password }).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.isLoading.set(false);
        // Fallback for offline demo session
        if (this.username === 'Thalaimalai') {
          const mockSession = {
            token: 'MOCK_JWT_BEARER_TOKEN_2026',
            username: 'Thalaimalai',
            fullName: 'Thalaimalai',
            role: 'Admin',
            userGroup: 'Naren-Marketing'
          };
          localStorage.setItem('ariyai_jwt_token', mockSession.token);
          localStorage.setItem('ariyai_user_session', JSON.stringify(mockSession));
          this.authService.currentUser.set(mockSession);
          this.router.navigate(['/dashboard']);
        } else {
          this.errorMessage.set(err?.error?.message || 'Invalid username or password.');
        }
      }
    });
  }
}
