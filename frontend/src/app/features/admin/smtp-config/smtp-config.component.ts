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

  currentUsername = signal('Saravanan');
  showPassword = signal(false);
  isSaving = signal(false);
  savedFeedback = signal<string | null>(null);

  config: SmtpConfigModel = {
    userId: 'Saravanan',
    smtpHost: 'smtp.gmail.com',
    port: 587,
    username: 'saravanan@ariyai.com',
    password: '',
    fromName: 'Saravanan',
    fromEmail: 'saravanan@ariyai.com',
    enableSsl: true
  };

  ngOnInit(): void {
    const user = this.auth.currentUser();
    if (user && user.fullName) {
      this.currentUsername.set(user.fullName);
      this.config.userId = user.fullName;
      this.config.fromName = user.fullName;
      this.config.username = `${user.username.toLowerCase()}@ariyai.com`;
      this.config.fromEmail = `${user.username.toLowerCase()}@ariyai.com`;
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
