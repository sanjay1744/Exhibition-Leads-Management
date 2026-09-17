import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.getToken();
  const role = authService.currentUser()?.role || '';
  const userId = authService.currentUser()?.id || '';
  const username = authService.currentUser()?.username || '';

  let headers = req.headers;
  if (token) {
    headers = headers.set('Authorization', `Bearer ${token}`);
  }
  if (role) {
    headers = headers.set('X-User-Role', role);
  }
  if (userId) {
    headers = headers.set('X-User-Id', userId);
  }
  if (username) {
    headers = headers.set('X-User-Name', username);
  }

  const cloned = req.clone({ headers });
  return next(cloned);
};
