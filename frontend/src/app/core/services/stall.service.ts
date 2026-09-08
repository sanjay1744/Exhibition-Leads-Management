import { Injectable, inject, signal } from '@angular/core';
import { Observable, from, of } from 'rxjs';
import { ApplicationDatabase } from './db.service';
import { SupabaseSyncService } from './supabase-sync.service';

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

  stalls = signal<Stall[]>([]);
  activeStall = signal<Stall | null>(null);

  constructor() {
    this.loadStalls();
  }

  async loadStalls(): Promise<void> {
    // 1. Fetch live authoritative stalls from Supabase (Primary DB)
    try {
      const cloudStalls = (await this.supabaseSync.getStallsFromSupabase()) as Stall[];
      if (cloudStalls !== undefined && cloudStalls !== null) {
        this.stalls.set(cloudStalls);
        this.activeStall.set(cloudStalls.length > 0 ? cloudStalls[0] : null);

        // Prune stale local Dexie stalls not present in Supabase
        const cloudIds = new Set(cloudStalls.map((s) => s.id));
        const localStalls = await this.db.getAllStalls();
        for (const ls of localStalls) {
          if (!cloudIds.has(ls.id)) {
            await this.db.deleteStall(ls.id);
          }
        }
        for (const s of cloudStalls) {
          await this.db.saveStall(s);
        }
        return;
      }
    } catch (cloudErr) {
      console.warn('[StallService] Supabase stalls fetch notice, falling back to local:', cloudErr);
    }

    // 2. Offline fallback only if cloud unreachable
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

  private async saveStallEverywhere(stall: Stall): Promise<Stall> {
    // Save to local IndexedDB
    try {
      await this.db.saveStall(stall);
    } catch (localErr) {
      console.warn('[StallService] Local Dexie save warning:', localErr);
    }

    // Save to Cloud Supabase
    await this.supabaseSync.saveStallToSupabase(stall);

    // Update in-memory reactive state
    this.stalls.update((list) => [stall, ...list]);
    this.setActiveStall(stall);

    return stall;
  }
}
