import { Injectable, inject, signal } from '@angular/core';
import { Observable, from, of } from 'rxjs';
import { ApplicationDatabase } from './db.service';
import { SupabaseSyncService } from './supabase-sync.service';

export interface ExhibitionDto {
  id: string;
  code: string;
  name: string;
  organizer: string;
  venue: string;
  startDate?: string;
  endDate?: string;
  durationDays: number;
  description: string;
  status: string;
  createdAt: string;
  stallCount: number;
  leadCount: number;
}

export interface InlineStallRequest {
  name: string;
  hallNumber?: string;
  boothNumber?: string;
  ownerId?: string;
  ownerName?: string;
}

export interface CreateExhibitionRequest {
  name: string;
  code?: string;
  organizer?: string;
  venue?: string;
  startDate?: string;
  endDate?: string;
  durationDays?: number;
  description?: string;
  status?: string;
  initialStalls?: InlineStallRequest[];
}

export interface ExhibitionDetailDto {
  exhibition: ExhibitionDto;
  stalls: any[];
}

@Injectable({
  providedIn: 'root'
})
export class ExhibitionService {
  private db = inject(ApplicationDatabase);
  private supabaseSync = inject(SupabaseSyncService);

  exhibitions = signal<ExhibitionDto[]>([]);
  activeExhibition = signal<ExhibitionDto | null>(null);

  constructor() {
    this.loadExhibitions();
  }

  async loadExhibitions(): Promise<void> {
    // 1. Fetch live authoritative exhibitions from Supabase (Primary DB)
    try {
      const cloudExhibitions = (await this.supabaseSync.getExhibitionsFromSupabase()) as ExhibitionDto[];
      if (cloudExhibitions !== undefined && cloudExhibitions !== null) {
        this.exhibitions.set(cloudExhibitions);
        this.activeExhibition.set(cloudExhibitions.length > 0 ? cloudExhibitions[0] : null);

        // Prune stale local Dexie exhibitions not present in Supabase
        const cloudIds = new Set(cloudExhibitions.map((e) => e.id));
        const localExhibitions = await this.db.getAllExhibitions();
        for (const le of localExhibitions) {
          if (!cloudIds.has(le.id)) {
            await this.db.deleteExhibition(le.id);
          }
        }
        for (const e of cloudExhibitions) {
          await this.db.saveExhibition(e);
        }
        return;
      }
    } catch (cloudErr) {
      console.warn('[ExhibitionService] Supabase exhibitions fetch notice, falling back to local:', cloudErr);
    }

    // 2. Offline fallback only if cloud unreachable
    try {
      const cached = (await this.db.getAllExhibitions()) as ExhibitionDto[];
      if (cached && cached.length > 0) {
        this.exhibitions.set(cached);
        if (!this.activeExhibition()) {
          this.activeExhibition.set(cached[0]);
        }
      }
    } catch (dbErr) {
      console.warn('[ExhibitionService] Error loading local cached exhibitions:', dbErr);
    }
  }

  setActiveExhibition(exhibition: ExhibitionDto): void {
    this.activeExhibition.set(exhibition);
  }

  getNextCode(stallNumber: number = 1): Observable<{ code: string }> {
    const yearShort = new Date().getFullYear().toString().slice(-2);
    const count = this.exhibitions().length + 1;
    const stallNum = stallNumber > 0 ? stallNumber : 1;
    const code = `EXH-STL${stallNum}-${yearShort}-${count.toString().padStart(3, '0')}`;
    return of({ code });
  }

  getExhibitionById(id: string): Observable<ExhibitionDetailDto | null> {
    const exh = this.exhibitions().find((e) => e.id === id) || null;
    return of(exh ? { exhibition: exh, stalls: [] } : null);
  }

  createExhibition(data: CreateExhibitionRequest): Observable<ExhibitionDto> {
    const yearShort = new Date().getFullYear().toString().slice(-2);
    const count = this.exhibitions().length + 1;
    const generatedCode = data.code || `EXH-STL1-${yearShort}-${count.toString().padStart(3, '0')}`;

    const newExh: ExhibitionDto = {
      id: crypto.randomUUID(),
      code: generatedCode,
      name: data.name.trim(),
      organizer: data.organizer?.trim() || '',
      venue: data.venue?.trim() || '',
      startDate: data.startDate || new Date().toISOString(),
      endDate: data.endDate || new Date(Date.now() + (data.durationDays || 3) * 86400000).toISOString(),
      durationDays: data.durationDays || 3,
      description: data.description?.trim() || '',
      status: data.status || 'Active',
      createdAt: new Date().toISOString(),
      stallCount: data.initialStalls?.length || 0,
      leadCount: 0,
    };

    return from(this.saveExhibitionEverywhere(newExh));
  }

  updateExhibition(id: string, data: CreateExhibitionRequest): Observable<ExhibitionDto> {
    const existing = this.exhibitions().find((e) => e.id === id);
    const updated: ExhibitionDto = {
      id: id,
      code: data.code || existing?.code || `EXH-STL1-26-001`,
      name: data.name.trim(),
      organizer: data.organizer?.trim() || existing?.organizer || '',
      venue: data.venue?.trim() || existing?.venue || '',
      startDate: data.startDate || existing?.startDate || new Date().toISOString(),
      endDate: data.endDate || existing?.endDate || new Date().toISOString(),
      durationDays: data.durationDays || existing?.durationDays || 3,
      description: data.description?.trim() || existing?.description || '',
      status: data.status || existing?.status || 'Active',
      createdAt: existing?.createdAt || new Date().toISOString(),
      stallCount: existing?.stallCount || 0,
      leadCount: existing?.leadCount || 0,
    };

    return from(this.saveExhibitionEverywhere(updated));
  }

  deleteExhibition(id: string): Observable<any> {
    this.exhibitions.update((list) => list.filter((e) => e.id !== id));
    return of({ success: true });
  }

  private async saveExhibitionEverywhere(exhibition: ExhibitionDto): Promise<ExhibitionDto> {
    // Save to local IndexedDB
    try {
      await this.db.saveExhibition(exhibition);
    } catch (localErr) {
      console.warn('[ExhibitionService] Local Dexie save warning:', localErr);
    }

    // Save to Cloud Supabase
    await this.supabaseSync.saveExhibitionToSupabase(exhibition);

    // Update in-memory reactive state
    this.exhibitions.update((list) => {
      const idx = list.findIndex((e) => e.id === exhibition.id);
      if (idx >= 0) {
        const copy = [...list];
        copy[idx] = exhibition;
        return copy;
      }
      return [exhibition, ...list];
    });
    this.setActiveExhibition(exhibition);

    return exhibition;
  }
}
