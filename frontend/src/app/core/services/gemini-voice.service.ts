import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, from } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { getApiUrl } from '../config/api.config';

export interface VoiceTranscribeResult {
  transcript: string;
  name?: string | null;
  designation?: string | null;
  company?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  address?: string | null;
  interestLevel?: 'Hot' | 'Warm' | 'Cold' | null;
  priority?: 'High' | 'Medium' | 'Low' | null;
  budget?: number | null;
  purchaseTimeline?: string | null;
  productCategory?: string[] | null;
  remarks?: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class GeminiVoiceService {
  private http = inject(HttpClient);

  isTranscribing = signal<boolean>(false);
  statusMessage = signal<string>('');

  /**
   * Convert an audio Blob to a Base64 DataURL string.
   */
  blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Transcribe audio and extract structured lead fields using Gemini 2.5 Flash via Vertex AI.
   * @param audioBlob Recorded audio blob (WebM, MP4, WAV, OGG)
   */
  transcribeVoiceWithGemini(audioBlob: Blob): Observable<VoiceTranscribeResult> {
    const apiUrl = getApiUrl();
    return from(this.blobToDataUrl(audioBlob)).pipe(
      switchMap((audioDataUrl) =>
        this.http.post<VoiceTranscribeResult>(`${apiUrl}/v1/voice/transcribe`, { audioDataUrl })
      )
    );
  }
}
