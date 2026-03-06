const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

export async function fetchCurrentITL(country: string = 'AR') {
    const response = await fetch(`${API_URL}/itl/current?country=${country}`);
    if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error('Failed to fetch ITL score');
    }
    return response.json();
}

export async function fetchITLHistory(country: string = 'AR', limit: number = 24) {
    const response = await fetch(`${API_URL}/itl/history?country=${country}&limit=${limit}`);
    if (!response.ok) {
        throw new Error('Failed to fetch ITL history');
    }
    return response.json();
}
