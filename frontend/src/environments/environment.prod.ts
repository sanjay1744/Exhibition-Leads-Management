export const environment = {
  production: true,
  apiUrl: (typeof window !== 'undefined' && (window as any).API_URL)
    ? (window as any).API_URL
    : 'https://exhibition-leads-api.onrender.com/api'
};
