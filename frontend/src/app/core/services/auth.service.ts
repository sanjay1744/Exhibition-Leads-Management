import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, catchError, of } from 'rxjs';

import { getApiUrl } from '../config/api.config';

export interface UserSession {
  token: string;
  username: string;
  fullName: string;
  role: string;
  userGroup: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private get apiUrl() { return `${getApiUrl()}/auth`; }
  private TOKEN_KEY = 'ariyai_jwt_token';
  private USER_KEY = 'ariyai_user_session';


  currentUser = signal<UserSession | null>(this.getStoredUser());
  isAuthenticated = computed(() => !!this.currentUser());

  constructor(private http: HttpClient, private router: Router) {}

  login(credentials: { username: string; password: string }): Observable<UserSession> {
    return this.http.post<UserSession>(`${this.apiUrl}/login`, credentials).pipe(
      tap((session) => {
        this.saveSession(session);
      })
    );
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

  private saveSession(session: UserSession): void {
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
