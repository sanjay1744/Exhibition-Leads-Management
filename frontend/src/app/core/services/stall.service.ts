import { Injectable, inject, signal, computed, effect } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, from, of, firstValueFrom } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ApplicationDatabase } from './db.service';
import { SupabaseSyncService } from './supabase-sync.service';
import { getApiUrl } from '../config/api.config';
import { AuthService } from './auth.service';

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
  marketingRepIds?: string;
  marketingRepNames?: string;
  status?: string;
}

@Injectable({
  providedIn: 'root'
})
export class StallService {
  private db = inject(ApplicationDatabase);
  private supabaseSync = inject(SupabaseSyncService);
  private http = inject(HttpClient);
  private auth = inject(AuthService);

  allStalls = signal<Stall[]>([]);

  stalls = computed<Stall[]>(() => {
    const list = this.allStalls();
    const user = this.auth.currentUser();
    if (user && user.role === 'StallOwner') {
      const myId = user.id?.toLowerCase();
      const myUsername = user.username?.toLowerCase();
      const myFullName = user.fullName?.toLowerCase();
      return list.filter((s) => {
        const ownerId = s.ownerId?.toLowerCase();
        const ownerName = s.ownerName?.toLowerCase();
        return (
          (ownerId && myId && ownerId === myId) ||
          (ownerName && myUsername && ownerName === myUsername) ||
          (ownerName && myFullName && ownerName === myFullName)
        );
      });
    }
    if (user && user.role === 'Marketing') {
      const myId = user.id?.toLowerCase();
      const myUsername = user.username?.toLowerCase();
      const myFullName = user.fullName?.toLowerCase();
      return list.filter((s) => {
        const repIds = s.marketingRepIds?.toLowerCase() || '';
        const repNames = s.marketingRepNames?.toLowerCase() || '';
        return (
          (myId && repIds.includes(myId)) ||
          (myUsername && repNames.includes(myUsername)) ||
          (myFullName && repNames.includes(myFullName))
        );
      });
    }
    return list;
  });

  activeStall = signal<Stall | null>(null);

  constructor() {
    this.loadStalls();
    effect(() => {
      this.ensureValidActiveStall();
    }, { allowSignalWrites: true });
  }

  private ensureValidActiveStall(): void {
    const visible = this.stalls();
    const current = this.activeStall();
    if (!current || !visible.some((s) => s.id?.toLowerCase() === current.id?.toLowerCase())) {
      this.activeStall.set(visible.length > 0 ? visible[0] : null);
    }
  }

  async loadStalls(): Promise<void> {
    // 1. Fetch live authoritative stalls from Supabase (Primary DB)
    try {
      const cloudStalls = (await this.supabaseSync.getStallsFromSupabase()) as Stall[];
      if (cloudStalls && cloudStalls.length > 0) {
        const localStalls = await this.db.getAllStalls().catch(() => []);
        const localMap = new Map<string, any>(localStalls.map((s: any) => [s.id?.toLowerCase(), s]));
        const merged = cloudStalls.map((s) => {
          const local = localMap.get(s.id?.toLowerCase());
          return {
            ...s,
            marketingRepIds: s.marketingRepIds || local?.marketingRepIds || '',
            marketingRepNames: s.marketingRepNames || local?.marketingRepNames || ''
          };
        });
        this.allStalls.set(merged);
        this.ensureValidActiveStall();

        // Synchronize to local Dexie cache
        for (const s of merged) {
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
          marketingRepIds: s.marketingRepIds || '',
          marketingRepNames: s.marketingRepNames || '',
          status: s.status || 'Active'
        }));
        this.allStalls.set(mapped);
        this.ensureValidActiveStall();

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
        this.allStalls.set(cached);
        this.ensureValidActiveStall();
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
    this.allStalls.update((list) => {
      const idx = list.findIndex((s) => s.id?.toLowerCase() === targetId);
      if (idx >= 0) {
        const copy = [...list];
        copy[idx] = { ...copy[idx], ...stall };
        return copy;
      }
      return [stall, ...list];
    });
    this.ensureValidActiveStall();
  }

  removeStallFromMemory(id: string): void {
    const targetId = id?.toLowerCase();
    this.allStalls.update((list) => list.filter((s) => s.id?.toLowerCase() !== targetId));
    this.ensureValidActiveStall();
  }

  getNextCode(): Observable<{ code: string }> {
    const year = new Date().getFullYear();
    const count = this.allStalls().length + 1;
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
      marketingRepIds: data.marketingRepIds || '',
      marketingRepNames: data.marketingRepNames || '',
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
