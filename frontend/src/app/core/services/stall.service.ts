import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

export interface Stall {
  id: string;
  name: string;
  code: string;
  location: string;
  ownerId: string;
  ownerName: string;
  createdAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class StallService {
  private apiUrl = 'http://localhost:5000/api/stalls';

  stalls = signal<Stall[]>([]);
  activeStall = signal<Stall | null>(null);

  constructor(private http: HttpClient) {
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
        }
      },
      error: () => {
        // Fallback default Stall
        const defaultStall: Stall = {
          id: '33333333-3333-3333-3333-333333333333',
          name: 'Stall 01 - Main Exhibition',
          code: 'STALL-01',
          location: 'Hall A, Booth 12',
          ownerId: '11111111-1111-1111-1111-111111111111',
          ownerName: 'Thalaimalai',
          createdAt: new Date().toISOString()
        };
        this.stalls.set([defaultStall]);
        this.activeStall.set(defaultStall);
      }
    });
  }

  setActiveStall(stall: Stall): void {
    this.activeStall.set(stall);
  }

  createStall(data: { name: string; code: string; location: string; ownerId: string; ownerName: string }): Observable<Stall> {
    return this.http.post<Stall>(this.apiUrl, data).pipe(
      tap((newStall) => {
        this.stalls.update((list) => [newStall, ...list]);
        this.setActiveStall(newStall);
      })
    );
  }
}
