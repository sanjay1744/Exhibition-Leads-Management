import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { getApiUrl } from '../config/api.config';
import { ExtractedCardData } from './card-parser.service';

@Injectable({
  providedIn: 'root'
})
export class OcrService {
  private http = inject(HttpClient);

  /**
   * Send the business card image to Gemini 3.8 Flash for AI extraction
   * @param imageDataUrl base64 data URL of the card image
   */
  parseCardWithGemini(imageDataUrl: string): Observable<ExtractedCardData> {
    const apiUrl = getApiUrl();
    return this.http.post<ExtractedCardData>(`${apiUrl}/v1/ocr/parse`, { imageDataUrl });
  }
}
