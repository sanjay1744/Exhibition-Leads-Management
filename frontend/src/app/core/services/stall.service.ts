import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, from, of, firstValueFrom } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ApplicationDatabase } from './db.service';
import { SupabaseSyncService } from './supabase-sync.service';
import { getApiUrl } from '../config/api.config';

export interface Stall {
  id: string;
  name: string;
  code: string;
  location: string;
  ownerId: string;
  ownerName: string;
  createdAt: string;
  exhibitionId?: string;
  hallNumber?: string;
  boothNumber?: string;
  eventName?: string;
  organizer?: string;
  durationDays?: number;
  startDate?: string;
  endDate?: string;
  status?: string;
}

@Injectable({
  providedIn: 'root'
})
export class StallService {
  private db = inject(ApplicationDatabase);
  private supabaseSync = inject(SupabaseSyncService);
  private http = inject(HttpClient);

  stalls = signal<Stall[]>([]);
  activeStall = signal<Stall | null>(null);

  constructor() {
    this.loadStalls();
  }

  async loadStalls(): Promise<void> {
    // 1. Fetch live authoritative stalls from Supabase (Primary DB)
    try {
      const cloudStalls = (await this.supabaseSync.getStallsFromSupabase()) as Stall[];
      if (cloudStalls && cloudStalls.length > 0) {
        this.stalls.set(cloudStalls);
        if (!this.activeStall()) {
          this.activeStall.set(cloudStalls[0]);
        }

        // Synchronize to local Dexie cache
        for (const s of cloudStalls) {
          await this.db.saveStall(s);
        }
        return;
      }
    } catch (cloudErr) {
      console.warn('[StallService] Supabase stalls fetch notice, falling back:', cloudErr);
    }

    // 2. Fetch live stalls from Backend SQL Server / Render API
    try {
      const apiUrl = `${getApiUrl()}/stalls`;
      const apiStalls = await firstValueFrom(this.http.get<any[]>(apiUrl).pipe(catchError(() => of([]))));
      if (apiStalls && apiStalls.length > 0) {
        const mapped: Stall[] = apiStalls.map((s) => ({
          id: s.id,
          name: s.name,
          code: s.code,
          location: s.location || '',
          ownerId: s.ownerId || '',
          ownerName: s.ownerName || '',
          createdAt: s.createdAt || new Date().toISOString(),
          exhibitionId: s.exhibitionId || '',
          hallNumber: s.hallNumber || '',
          boothNumber: s.boothNumber || '',
          eventName: s.eventName || '',
          organizer: s.organizer || '',
          durationDays: s.durationDays || 3,
          startDate: s.startDate || '',
          endDate: s.endDate || '',
          status: s.status || 'Active'
        }));
        this.stalls.set(mapped);
        if (!this.activeStall() && mapped.length > 0) {
          this.activeStall.set(mapped[0]);
        }

        // Synchronize backend stalls to Supabase and Dexie
        for (const st of mapped) {
          await this.db.saveStall(st);
          this.supabaseSync.saveStallToSupabase(st);
        }
        return;
      }
    } catch (apiErr) {
      console.warn('[StallService] Backend API stalls fetch notice:', apiErr);
    }

    // 3. Offline fallback from local Dexie
    try {
      const cached = (await this.db.getAllStalls()) as Stall[];
      if (cached && cached.length > 0) {
        this.stalls.set(cached);
        if (!this.activeStall()) {
          this.activeStall.set(cached[0]);
        }
      }
    } catch (dbErr) {
      console.warn('[StallService] Error loading local cached stalls:', dbErr);
    }
  }

  setActiveStall(stall: Stall): void {
    this.activeStall.set(stall);
  }

  addOrUpdateStallInMemory(stall: Stall): void {
    const targetId = stall.id?.toLowerCase();
    this.stalls.update((list) => {
      const idx = list.findIndex((s) => s.id?.toLowerCase() === targetId);
      if (idx >= 0) {
        const copy = [...list];
        copy[idx] = { ...copy[idx], ...stall };
        return copy;
      }
      return [stall, ...list];
    });
    this.setActiveStall(stall);
  }

  removeStallFromMemory(id: string): void {
    const targetId = id?.toLowerCase();
    this.stalls.update((list) => list.filter((s) => s.id?.toLowerCase() !== targetId));
    if (this.activeStall()?.id?.toLowerCase() === targetId) {
      const remaining = this.stalls();
      this.activeStall.set(remaining.length > 0 ? remaining[0] : null);
    }
  }

  getNextCode(): Observable<{ code: string }> {
    const year = new Date().getFullYear();
    const count = this.stalls().length + 1;
    const code = `STL-${year}-${count.toString().padStart(3, '0')}`;
    return of({ code });
  }

  createStall(data: Partial<Stall>): Observable<Stall> {
    const year = new Date().getFullYear();
    const count = this.stalls().length + 1;
    const generatedCode = data.code || `STL-${year}-${count.toString().padStart(3, '0')}`;

    const newStall: Stall = {
      id: data.id || crypto.randomUUID(),
      name: data.name || '',
      code: generatedCode,
      location: data.location || '',
      ownerId: data.ownerId || '',
      ownerName: data.ownerName || '',
      exhibitionId: data.exhibitionId || '',
      hallNumber: data.hallNumber || '',
      boothNumber: data.boothNumber || '',
      eventName: data.eventName || '',
      organizer: data.organizer || '',
      durationDays: data.durationDays || 3,
      startDate: data.startDate || new Date().toISOString(),
      endDate: data.endDate || new Date(Date.now() + 3 * 86400000).toISOString(),
      status: data.status || 'Active',
      createdAt: new Date().toISOString(),
    };

    return from(this.saveStallEverywhere(newStall));
  }

  async saveStallEverywhere(stall: Stall): Promise<Stall> {
    // 1. In-memory immediately for real-time reactivity
    this.addOrUpdateStallInMemory(stall);

    // 2. Save to local IndexedDB
    try {
      await this.db.saveStall(stall);
    } catch (localErr) {
      console.warn('[StallService] Local Dexie save warning:', localErr);
    }

    // 3. Save to Cloud Supabase
    try {
      await this.supabaseSync.saveStallToSupabase(stall);
    } catch (supErr) {
      console.warn('[StallService] Supabase save warning:', supErr);
    }

    return stall;
  }
}
