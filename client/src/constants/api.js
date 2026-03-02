// In production, API calls go to the deployed backend URL.
// In development, Vite proxies /api to localhost:3000.
// Set VITE_API_URL in Vercel environment variables to your Render backend URL.
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
