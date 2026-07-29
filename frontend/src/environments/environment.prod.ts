export const environment = {
  production: true,
  apiUrl: (typeof window !== 'undefined' && (window as any).API_URL)
    ? (window as any).API_URL
    : 'https://exhibition-leads-management.onrender.com/api'
};

