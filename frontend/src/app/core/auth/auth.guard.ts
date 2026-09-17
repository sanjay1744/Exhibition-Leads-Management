import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    router.navigate(['/login']);
    return false;
  }

  const role = authService.currentUser()?.role;
  const targetUrl = state?.url ? state.url.split('?')[0] : '';

  // 1. Marketing Rep can ONLY work on leads and related profile/vcard
  if (role === 'Marketing') {
    const allowed = ['/leads', '/capture', '/profile', '/exchange'];
    const isAllowed = allowed.some((prefix) => targetUrl.startsWith(prefix));
    if (!isAllowed) {
      router.navigate(['/leads']);
      return false;
    }
  }

  // 2. Stall Owner cannot access Exhibition Master or Admin configuration
  if (role === 'StallOwner') {
    if (targetUrl.startsWith('/exhibitions') || targetUrl.startsWith('/admin')) {
      router.navigate(['/stalls']);
      return false;
    }
  }

  return true;
};
