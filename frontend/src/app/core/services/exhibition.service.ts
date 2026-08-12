import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { getApiUrl } from '../config/api.config';

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
  private get apiUrl() { return `${getApiUrl()}/exhibitions`; }

  exhibitions = signal<ExhibitionDto[]>([]);
  activeExhibition = signal<ExhibitionDto | null>(null);

  constructor(private http: HttpClient) {
    this.loadExhibitions();
  }

  loadExhibitions(): void {
    this.http.get<ExhibitionDto[]>(this.apiUrl).subscribe({
      next: (list) => {
        if (list && list.length > 0) {
          this.exhibitions.set(list);
          if (!this.activeExhibition()) {
            this.activeExhibition.set(list[0]);
          }
        }
      },
      error: () => {
        // Fallback default Exhibition
        const defaultExhibition: ExhibitionDto = {
          id: '44444444-4444-4444-4444-444444444444',
          code: 'EXH-2026-001',
          name: 'International Industrial TexFair 2026',
          organizer: 'SIMA Trade Association',
          venue: 'Codissia Trade Fair Complex, Coimbatore',
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 4 * 86400000).toISOString(),
          durationDays: 4,
          description: 'Premier South India Industrial & Textile Machinery Expo 2026',
          status: 'Active',
          createdAt: new Date().toISOString(),
          stallCount: 1,
          leadCount: 0
        };
        this.exhibitions.set([defaultExhibition]);
        this.activeExhibition.set(defaultExhibition);
      }
    });
  }

  setActiveExhibition(exhibition: ExhibitionDto): void {
    this.activeExhibition.set(exhibition);
  }

  getNextCode(): Observable<{ code: string }> {
    return this.http.get<{ code: string }>(`${this.apiUrl}/next-code`);
  }

  getExhibitionById(id: string): Observable<ExhibitionDetailDto> {
    return this.http.get<ExhibitionDetailDto>(`${this.apiUrl}/${id}`);
  }

  createExhibition(data: CreateExhibitionRequest): Observable<ExhibitionDto> {
    return this.http.post<ExhibitionDto>(this.apiUrl, data).pipe(
      tap(() => this.loadExhibitions())
    );
  }

  updateExhibition(id: string, data: CreateExhibitionRequest): Observable<ExhibitionDto> {
    return this.http.put<ExhibitionDto>(`${this.apiUrl}/${id}`, data).pipe(
      tap(() => this.loadExhibitions())
    );
  }

  deleteExhibition(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`).pipe(
      tap(() => this.loadExhibitions())
    );
  }
}
