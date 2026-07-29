import { environment } from '../../../environments/environment';

export function getApiUrl(): string {
  if (typeof window !== 'undefined') {
    if ((window as any).API_URL) {
      return (window as any).API_URL;
    }
    // Safety check: When deployed to Vercel/cloud (not localhost), automatically use Render API
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      return 'https://exhibition-leads-management.onrender.com/api';
    }
  }
  return environment.apiUrl;
}
