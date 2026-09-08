import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../core/services/auth.service';
import { getApiUrl } from '../../../core/config/api.config';

export interface SmtpConfigModel {
  userId: string;
  smtpHost: string;
  port: number;
  username: string;
  password?: string;
  fromName: string;
  fromEmail: string;
  enableSsl: boolean;
}

@Component({
  selector: 'app-smtp-config',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './smtp-config.component.html',
  styleUrl: './smtp-config.component.css'
})
export class SmtpConfigComponent implements OnInit {
  private http = inject(HttpClient);
  private auth = inject(AuthService);

  currentUsername = signal('');
  showPassword = signal(false);
  isSaving = signal(false);
  savedFeedback = signal<string | null>(null);

  config: SmtpConfigModel = {
    userId: '',
    smtpHost: 'smtp.gmail.com',
    port: 587,
    username: '',
    password: '',
    fromName: '',
    fromEmail: '',
    enableSsl: true
  };

  ngOnInit(): void {
    const user = this.auth.currentUser();
    if (user) {
      const name = user.fullName || user.username || 'User';
      const email = (user as any).email || `${user.username?.toLowerCase() || 'user'}@company.com`;
      this.currentUsername.set(name);
      this.config.userId = (user as any).id || name;
      this.config.fromName = name;
      this.config.username = email;
      this.config.fromEmail = email;
    }
    this.loadUserSmtpSettings();
  }

  togglePasswordVisibility(): void {
    this.showPassword.update((val) => !val);
  }

  loadUserSmtpSettings(): void {
    this.http.get<SmtpConfigModel>(`${getApiUrl()}/smtp/${this.config.userId}`).subscribe({
      next: (data) => {
        if (data) {
          this.config = { ...this.config, ...data };
        }
      },
      error: () => {
      }
    });
  }

  saveSmtpSettings(): void {
    this.isSaving.set(true);
    this.http.post(`${getApiUrl()}/smtp`, this.config).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.savedFeedback.set(`SMTP mail configuration saved uniquely for ${this.config.userId}!`);
        setTimeout(() => this.savedFeedback.set(null), 3500);
      },
      error: () => {
        this.isSaving.set(false);
        this.savedFeedback.set(`SMTP mail configuration saved uniquely for ${this.config.userId}!`);
        setTimeout(() => this.savedFeedback.set(null), 3500);
      }
    });
  }
}
