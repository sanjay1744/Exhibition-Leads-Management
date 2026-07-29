import { environment } from '../../../environments/environment';

export function getApiUrl(): string {
  if (typeof window !== 'undefined' && (window as any).API_URL) {
    return (window as any).API_URL;
  }
  return environment.apiUrl;
}
