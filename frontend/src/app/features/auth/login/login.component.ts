import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
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
