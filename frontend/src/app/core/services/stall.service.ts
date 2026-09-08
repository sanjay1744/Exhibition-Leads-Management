import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { getApiUrl } from '../config/api.config';
import { FirebaseSyncService } from './firebase-sync.service';

export interface Stall {
  id: string;
  name: string;
  code: string;
  location: string;
  ownerId: string;
  ownerName: string;
  createdAt: string;
  exhibitionId?: string;
}

@Injectable({
  providedIn: 'root'
})
export class StallService {
  private http = inject(HttpClient);
  private firebaseSync = inject(FirebaseSyncService);
  private get apiUrl() { return `${getApiUrl()}/stalls`; }

  stalls = signal<Stall[]>([]);
  activeStall = signal<Stall | null>(null);

  constructor() {
    this.loadStalls();
  }

  loadStalls(): void {
    this.http.get<Stall[]>(this.apiUrl).subscribe({
      next: (list) => {
        if (list && list.length > 0) {
          this.stalls.set(list);
          if (!this.activeStall()) {
            this.activeStall.set(list[0]);
          }
          for (const item of list) {
            this.firebaseSync.saveStallToFirestore(item);
          }
        } else {
          this.loadFromFirestoreFallback();
        }
      },
      error: async () => {
        await this.loadFromFirestoreFallback();
      }
    });
  }

  private async loadFromFirestoreFallback(): Promise<void> {
    try {
      const fbList = (await this.firebaseSync.getStallsFromFirestore()) as Stall[];
      if (fbList && fbList.length > 0) {
        this.stalls.set(fbList);
        if (!this.activeStall()) {
          this.activeStall.set(fbList[0]);
        }
        return;
      }
    } catch (e) {
      console.warn('[StallService] Firestore fetch fallback notice:', e);
    }

    // Fallback default Stall
    const defaultStall: Stall = {
      id: '33333333-3333-3333-3333-333333333333',
      name: 'Stall 01 - Main Exhibition',
      code: 'STALL-01',
      location: 'Hall A, Booth 12',
      ownerId: '11111111-1111-1111-1111-111111111111',
      ownerName: 'Thalaimalai',
      createdAt: new Date().toISOString(),
      exhibitionId: '44444444-4444-4444-4444-444444444444'
    };
    this.stalls.set([defaultStall]);
    this.activeStall.set(defaultStall);
    this.firebaseSync.saveStallToFirestore(defaultStall);
  }

  setActiveStall(stall: Stall): void {
    this.activeStall.set(stall);
  }

  createStall(data: { name: string; code: string; location: string; ownerId: string; ownerName: string; exhibitionId?: string }): Observable<Stall> {
    return this.http.post<Stall>(this.apiUrl, data).pipe(
      tap((newStall) => {
        this.stalls.update((list) => [newStall, ...list]);
        this.setActiveStall(newStall);
        if (newStall) {
          this.firebaseSync.saveStallToFirestore(newStall);
        }
      })
    );
  }
}
