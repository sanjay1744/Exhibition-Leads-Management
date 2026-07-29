import { Injectable, signal } from '@angular/core';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  title?: string;
  message: string;
}

@Injectable({
  providedIn: 'root',
})
export class ToastService {
  toasts = signal<ToastMessage[]>([]);

  showSuccess(message: string, title: string = 'Changes Saved'): void {
    this.addToast('success', title, message);
  }

  showError(message: string, title: string = 'Action Failed'): void {
    this.addToast('error', title, message);
  }

  showInfo(message: string, title: string = 'Information'): void {
    this.addToast('info', title, message);
  }

  private addToast(type: 'success' | 'error' | 'info', title: string, message: string): void {
    const id = crypto.randomUUID();
    const newToast: ToastMessage = { id, type, title, message };
    this.toasts.update((list) => [...list, newToast]);

    setTimeout(() => {
      this.removeToast(id);
    }, 3500);
  }

  removeToast(id: string): void {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }
}
