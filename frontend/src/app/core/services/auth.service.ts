import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, from } from 'rxjs';
import { getApiUrl } from '../config/api.config';
import { UserService } from './user.service';

export interface UserSession {
  token: string;
  id?: string;
  username: string;
  fullName: string;
  email?: string;
  role: string;
  userGroup: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private userService = inject(UserService);

  private get apiUrl() { return `${getApiUrl()}/auth`; }
  private TOKEN_KEY = 'ariyai_jwt_token';
  private USER_KEY = 'ariyai_user_session';

  currentUser = signal<UserSession | null>(this.getStoredUser());
  isAuthenticated = computed(() => !!this.currentUser());

  login(credentials: { username: string; password: string }): Observable<UserSession> {
    return from(this.authenticateUser(credentials));
  }

  private async authenticateUser(credentials: { username: string; password: string }): Promise<UserSession> {
    // 1. Authenticate against Supabase users collection and local Dexie
    const fbUser = await this.userService.authenticate(credentials.username, credentials.password);
    if (fbUser) {
      const session: UserSession = {
        token: crypto.randomUUID(),
        id: fbUser.id,
        username: fbUser.username,
        fullName: fbUser.fullName,
        email: fbUser.email,
        role: fbUser.role,
        userGroup: fbUser.userGroup || 'Sales Team'
      };
      this.saveSession(session);
      return session;
    }

    // 2. If no users exist at all in Supabase yet, ensure initial admin exists
    const initialAdmin = await this.userService.ensureInitialAdmin();
    if (
      initialAdmin.username.toLowerCase() === credentials.username.trim().toLowerCase() &&
      (!initialAdmin.password || initialAdmin.password === credentials.password)
    ) {
      const session: UserSession = {
        token: crypto.randomUUID(),
        id: initialAdmin.id,
        username: initialAdmin.username,
        fullName: initialAdmin.fullName,
        email: initialAdmin.email,
        role: initialAdmin.role,
        userGroup: initialAdmin.userGroup || 'Admin'
      };
      this.saveSession(session);
      return session;
    }

    // 3. Fallback: try backend API if reachable
    try {
      const backendSession = await this.http.post<UserSession>(`${this.apiUrl}/login`, credentials).toPromise();
      if (backendSession) {
        this.saveSession(backendSession);
        return backendSession;
      }
    } catch {
      // Backend not running or failed
    }

    throw new Error('Invalid username or password.');
  }

  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    this.currentUser.set(null);
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  saveSession(session: UserSession): void {
    localStorage.setItem(this.TOKEN_KEY, session.token);
    localStorage.setItem(this.USER_KEY, JSON.stringify(session));
    this.currentUser.set(session);
  }

  private getStoredUser(): UserSession | null {
    const data = localStorage.getItem(this.USER_KEY);
    if (!data) return null;
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }
}
