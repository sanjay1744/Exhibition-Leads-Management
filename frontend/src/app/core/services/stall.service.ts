import { Injectable, inject, signal, computed, effect } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, from, of, firstValueFrom } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ApplicationDatabase } from './db.service';
import { SupabaseSyncService } from './supabase-sync.service';
import { getApiUrl } from '../config/api.config';
import { AuthService } from './auth.service';
import { ExhibitionService } from './exhibition.service';

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
  private exhibitionService = inject(ExhibitionService);

  allStalls = signal<Stall[]>([]);

  stalls = computed<Stall[]>(() => {
    const list = this.allStalls();
    const user = this.auth.currentUser();
    if (!user) return list;
    if (user.role === 'SuperAdmin') return list;

    // Admin role: Only stalls in exhibitions assigned to this admin
    if (user.role === 'Admin') {
      const myId = user.id?.toLowerCase();
      const myUsername = user.username?.toLowerCase();
      const myFullName = user.fullName?.toLowerCase();

      const assignedExhIds = new Set(
        this.exhibitionService.exhibitions()
          .filter(e => {
            const adminId = e.adminId?.toLowerCase();
            const adminName = e.adminName?.toLowerCase();
            return (
              (adminId && myId && adminId === myId) ||
              (adminName && myUsername && adminName === myUsername) ||
              (adminName && myFullName && adminName === myFullName) ||
              ((user as any).assignedExhibitionId && (user as any).assignedExhibitionId === e.id)
            );
          })
          .map(e => e.id)
      );

      return list.filter(s => s.exhibitionId && assignedExhIds.has(s.exhibitionId));
    }

    // StallOwner role: Only stalls owned by this user
    if (user.role === 'StallOwner') {
      const myId = user.id?.toLowerCase().trim();
      const myUsername = user.username?.toLowerCase().trim();
      const myFullName = user.fullName?.toLowerCase().trim();
      return list.filter((s) => {
        const ownerId = s.ownerId?.toLowerCase().trim();
        const ownerName = s.ownerName?.toLowerCase().trim();
        return (
          (ownerId && myId && ownerId === myId) ||
          (ownerName && myUsername && ownerName === myUsername) ||
          (ownerName && myFullName && ownerName === myFullName)
        );
      });
    }

    // Marketing role: Only stalls assigned to this marketing rep
    if (user.role === 'Marketing') {
      const myId = user.id?.toLowerCase().trim();
      const myUsername = user.username?.toLowerCase().trim();
      const myFullName = user.fullName?.toLowerCase().trim();
      return list.filter((s) => {
        const repIdsList = (s.marketingRepIds || '')
          .split(',')
          .map((x) => x.trim().toLowerCase())
          .filter(Boolean);
        const repNamesList = (s.marketingRepNames || '')
          .split(',')
          .map((x) => x.trim().toLowerCase())
          .filter(Boolean);

        const matchesId = !!myId && repIdsList.includes(myId);
        const matchesUsername = !!myUsername && repNamesList.includes(myUsername);
        const matchesFullName = !!myFullName && repNamesList.includes(myFullName);

        return matchesId || matchesUsername || matchesFullName;
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
    try {
      const [cloudStalls, apiStalls, localStalls] = await Promise.all([
        this.supabaseSync.getStallsFromSupabase().catch(() => [] as any[]),
        firstValueFrom(this.http.get<any[]>(`${getApiUrl()}/stalls`).pipe(catchError(() => of([])))),
        this.db.getAllStalls().catch(() => [] as any[])
      ]);

      const apiMapById = new Map<string, any>();
      const apiMapByCode = new Map<string, any>();
      for (const a of (apiStalls || [])) {
        if (a.id) apiMapById.set(a.id.toLowerCase(), a);
        if (a.code) {
          apiMapByCode.set(a.code.toLowerCase(), a);
          const baseCode = a.code.split('-').slice(0, 3).join('-').toLowerCase();
          if (!apiMapByCode.has(baseCode)) {
            apiMapByCode.set(baseCode, a);
          }
        }
      }

      const localMapById = new Map<string, any>();
      const localMapByCode = new Map<string, any>();
      for (const l of (localStalls || [])) {
        if (l.id) localMapById.set(l.id.toLowerCase(), l);
        if (l.code) localMapByCode.set(l.code.toLowerCase(), l);
      }

      const stallMap = new Map<string, Stall>();

      const processCandidate = (candidate: any) => {
        const id = candidate.id;
        if (!id) return;
        const idKey = id.toLowerCase();
        const codeKey = (candidate.code || '').toLowerCase();
        const baseCodeKey = (candidate.code || '').split('-').slice(0, 3).join('-').toLowerCase();

        const apiMatch = apiMapById.get(idKey) || apiMapByCode.get(codeKey) || apiMapByCode.get(baseCodeKey);
        const localMatch = localMapById.get(idKey) || localMapByCode.get(codeKey);

        const repIds = candidate.marketingRepIds || apiMatch?.marketingRepIds || localMatch?.marketingRepIds || '';
        const repNames = candidate.marketingRepNames || apiMatch?.marketingRepNames || localMatch?.marketingRepNames || '';
        const ownerId = candidate.ownerId || apiMatch?.ownerId || localMatch?.ownerId || '';
        const ownerName = candidate.ownerName || apiMatch?.ownerName || localMatch?.ownerName || '';
        const exhibitionId = candidate.exhibitionId || apiMatch?.exhibitionId || localMatch?.exhibitionId || '';

        const fullStall: Stall = {
          id: candidate.id,
          name: candidate.name || apiMatch?.name || localMatch?.name || 'Unnamed Stall',
          code: candidate.code || apiMatch?.code || localMatch?.code || '',
          location: candidate.location || apiMatch?.location || localMatch?.location || '',
          ownerId: ownerId,
          ownerName: ownerName,
          createdAt: candidate.createdAt || apiMatch?.createdAt || localMatch?.createdAt || new Date().toISOString(),
          exhibitionId: exhibitionId,
          hallNumber: candidate.hallNumber || apiMatch?.hallNumber || localMatch?.hallNumber || '',
          boothNumber: candidate.boothNumber || apiMatch?.boothNumber || localMatch?.boothNumber || '',
          eventName: candidate.eventName || apiMatch?.eventName || localMatch?.eventName || '',
          organizer: candidate.organizer || apiMatch?.organizer || localMatch?.organizer || '',
          durationDays: candidate.durationDays || apiMatch?.durationDays || localMatch?.durationDays || 3,
          startDate: candidate.startDate || apiMatch?.startDate || localMatch?.startDate || '',
          endDate: candidate.endDate || apiMatch?.endDate || localMatch?.endDate || '',
          marketingRepIds: repIds,
          marketingRepNames: repNames,
          status: candidate.status || apiMatch?.status || localMatch?.status || 'Active'
        };

        stallMap.set(idKey, fullStall);
      };

      for (const cs of (cloudStalls || [])) {
        processCandidate(cs);
      }
      for (const as of (apiStalls || [])) {
        if (!stallMap.has((as.id || '').toLowerCase())) {
          processCandidate(as);
        }
      }
      for (const ls of (localStalls || [])) {
        if (!stallMap.has((ls.id || '').toLowerCase())) {
          processCandidate(ls);
        }
      }

      const mergedList = Array.from(stallMap.values());
      if (mergedList.length > 0) {
        this.allStalls.set(mergedList);
        this.ensureValidActiveStall();

        for (const st of mergedList) {
          await this.db.saveStall(st);
        }
      }
    } catch (err) {
      console.warn('[StallService] Error loading stalls:', err);
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

    // 4. Save to Backend API
    try {
      await firstValueFrom(this.http.post(`${getApiUrl()}/stalls`, stall).pipe(catchError(() => of(null))));
    } catch (apiErr) {
      console.warn('[StallService] Backend API save warning:', apiErr);
    }

    return stall;
  }
}
