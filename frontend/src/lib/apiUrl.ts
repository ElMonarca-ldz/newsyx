/**
 * Central API URL configuration.
 * In production (Vercel), the VITE_API_URL environment variable is set.
 * In local development, falls back to localhost:4000.
 */
export const API_BASE_URL =
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_URL)
        ? (import.meta as any).env.VITE_API_URL
        : 'http://localhost:4000/api';
